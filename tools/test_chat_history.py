"""隔离HTTP夹具 + 真实iOS客户端：125条历史、重叠页、失败重试与到头。"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, subprocess, threading, time

def sim(*args):
    return subprocess.check_output(['xcrun', 'simctl', *args], text=True).strip()

class Handler(BaseHTTPRequestHandler):
    failed = False
    earlier_requests = 0
    def log_message(self, *args): pass
    def do_POST(self):
        self.send_response(404); self.end_headers()
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/v1/messages':
            q = parse_qs(u.query); before = int(q.get('before', ['126'])[0])
            if before == 76:
                Handler.earlier_requests += 1
                if Handler.earlier_requests >= 3: time.sleep(1)
            if before == 76 and not Handler.failed:
                Handler.failed = True
                self.send_response(503); self.end_headers(); return
            seqs = list(range(max(1, before - 50), before))
            # 模拟一页内重复ID；下一页仍能补齐最早的一条。
            if before == 76: seqs = list(range(27, 76)) + [75]
            result = {'messages': [{'id': f'history-{n}', 'seq': n,
                'role': 'cat' if n % 2 == 0 else 'user',
                'text': f'历史消息 {n:03d}', 'status': 'done',
                'remembered': False, 'boundary': False} for n in seqs]}
        elif u.path == '/v1/memories': result = {'memories': []}
        elif u.path == '/v1/boundaries': result = {'boundaries': []}
        else:
            self.send_response(404); self.end_headers(); return
        body = json.dumps(result).encode()
        self.send_response(200); self.send_header('Content-Type','application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 18787), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        subprocess.run(['xcrun','simctl','terminate','booted','com.maomao.app'], capture_output=True)
        script = '500:screen:chat;1500:historySnapshot:first;2000:historyEarlier;3000:historySnapshot:failed;3500:historyEarlier;4500:historySnapshot:second;5000:historyEarlier;6000:historySnapshot:final;6500:historyReconnect;8000:historyEarlier;8010:historyEarlier;8200:historyReconnect;10000:historySnapshot:reconnected'
        sim('launch','booted','com.maomao.app','-backendMode','local','-backendURL','http://127.0.0.1:18787','-backendToken','isolated-history-fixture','-script',script)
        docs = Path(sim('get_app_container','booted','com.maomao.app','data'))/'Documents'
        deadline = time.monotonic() + 30
        started = time.time()
        while time.monotonic() < deadline:
            p = docs/'history-reconnected.json'
            if p.exists() and p.stat().st_mtime >= started: break
            time.sleep(.25)
        results = {n: json.loads((docs/f'history-{n}.json').read_text()) for n in ['first','failed','second','final','reconnected']}
        assert results['first']['sequences'] == list(range(76,126))
        assert results['failed']['failed'] and results['failed']['sequences'] == results['first']['sequences']
        assert results['second']['sequences'] == list(range(27,126))
        final = results['final']
        assert final['sequences'] == list(range(1,126))
        assert len(set(final['ids'])) == 125 and not final['hasEarlier'] and not final['loading'] and not final['failed']
        assert results['reconnected']['sequences'] == list(range(76,126))
        assert not results['reconnected']['loading'] and not results['reconnected']['failed']
        assert Handler.earlier_requests == 3, '重复点击不应发出并发分页请求'
        print('PASS: 125条完整正序；重叠ID去重；503后游标保留且重试成功；到头状态正确；并发点击合并，重连丢弃旧分页。')
    finally:
        server.shutdown()
        subprocess.run(['xcrun','simctl','terminate','booted','com.maomao.app'], capture_output=True)
        # 验收夹具只通过进程参数注入，不写入用户的后端设置。
