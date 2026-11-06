"""真实模拟器→正式HTTP/SSE→PG/Redis/worker；只用独立验收账号。
先跑 server/scripts/test-diary-http.ts 生成0600凭据，再构建安装当前App。
本脚本独立管理8791端口的API进程，断网用关闭自己的进程模拟。
"""
import hashlib
import json
import os
import subprocess
import time
import uuid
from pathlib import Path
from urllib.request import Request, urlopen

DEVICE = '5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD'
APP = 'com.maomao.app'
ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = json.loads(Path('/tmp/maomao-diary-sync-account.json').read_text())
BASE = 'http://localhost:8791'
RUN = 'sync-' + uuid.uuid4().hex[:8]
API = None
LOG = open('/tmp/maomao-diary-simulator-api.log', 'a')
checks = []


def sim(*args, check=True):
    return subprocess.run(['xcrun', 'simctl', *args], capture_output=True, text=True, check=check).stdout.strip()


def start_api():
    global API
    env = dict(os.environ, DATABASE_URL='postgres://maomao:maomao@127.0.0.1:5432/maomao_diary_sync_review_20261019',
               REDIS_URL='redis://127.0.0.1:16392', MODEL_PROVIDER='mock', MOCK_DELAY_MS='2', PORT='8791')
    API = subprocess.Popen(['node', '--import', 'tsx', 'src/api.ts'], cwd=ROOT / 'server', env=env, stdout=LOG, stderr=LOG)
    until(lambda: bool(urlopen(BASE + '/healthz', timeout=2).read()), 'API启动')


def stop_api():
    global API
    if API:
        API.terminate()
        API.wait(timeout=25)
        API = None


def until(read, name, seconds=35):
    end = time.monotonic() + seconds
    last = None
    while time.monotonic() < end:
        try:
            value = read()
            if value:
                return value
        except (OSError, ValueError) as error:
            last = type(error).__name__
        time.sleep(.25)
    raise RuntimeError('超时：' + name + (' / ' + last if last else ''))


def records():
    request = Request(BASE + '/v1/diary', headers={'Authorization': 'Bearer ' + ACCOUNT['token']})
    return json.loads(urlopen(request, timeout=3).read())['entries']


def launch(script, label):
    sim('terminate', DEVICE, APP, check=False)
    # 同一个快照路径按多个时点刷新，用条件等待而非假设网络固定耗时。
    repeated = ';'.join(f'{delay}:diarySync;{delay+150}:diarySnapshot:{RUN}-{label}' for delay in [1400, 3000, 6000, 10000, 16000, 22000])
    sim('launch', DEVICE, APP, '-backendMode', 'local', '-backendURL', BASE,
        '-backendToken', ACCOUNT['token'], '-script', '100:time:12;' + script + ';' + repeated)


def snapshot(label):
    return json.loads((documents / f'diary-{RUN}-{label}.json').read_text())


def entry_in_snapshot(value, text):
    return value['texts'].index(text) if text in value['texts'] else None


container = Path(sim('get_app_container', DEVICE, APP, 'data'))
documents = container / 'Documents'
private = '模拟器验收：只留给自己的记录。' + RUN
shared = '模拟器验收：今天在窗边读科幻小说。' + RUN
try:
    start_api()
    launch('500:diaryCapture:' + private + ';700:screen:mailbox', 'private')
    until(lambda: next((r for r in records() if r['text'] == private and not r['cat_allowed']), None), '私密同步')
    def synced_private():
        state = snapshot('private')
        i = entry_in_snapshot(state, private)
        return i is not None and state['cloudIDs'][i] and not state['needsSync'][i]
    until(synced_private, '私密回执落盘')
    checks.append('App保存私密记录并同步，未开放模型读取')
    stop_api()
    launch('500:diaryCaptureShared:' + shared + ';700:screen:mailbox', 'offline')
    def offline_saved():
        state = snapshot('offline')
        i = entry_in_snapshot(state, shared)
        return i is not None and not state['cloudIDs'][i] and state['needsSync'][i]
    until(offline_saved, '离线记录落盘')
    launch('500:screen:mailbox', 'offline-reopen')
    until(lambda: shared in snapshot('offline-reopen')['texts'], '断网强退恢复')
    checks.append('断网仍保存，强退重开保留待同步记录')
    start_api()
    launch('500:screen:mailbox', 'online')
    def read_done():
        state = snapshot('online')
        i = entry_in_snapshot(state, shared)
        return i is not None and state['visits'][i] == 2 and not state['needsSync'][i]
    until(read_done, '联网后同步与真实worker留言')
    rows = records()
    assert len([r for r in rows if r['text'] == shared]) == 1
    record = next(r for r in rows if r['text'] == shared)
    assert record['note'] == '在这里陪你坐一会儿。'
    assert next(r for r in rows if r['text'] == private)['visit'] == 0
    checks.append('恢复网络自动同步一次，常驻worker读取开放记录并回传留言')
    sim('io', DEVICE, 'screenshot', '/tmp/maomao-diary-sync-comment.png')
    sim('terminate', DEVICE, APP, check=False)
    identity = hashlib.sha256((BASE + '\n' + ACCOUNT['token']).encode()).hexdigest()
    file = container / 'Library/Application Support/DiaryRecords' / (identity + '.json')
    # 仅移动本轮测试账号的缓存，模拟另一设备首次读取，保留原件。
    backup = Path('/tmp') / (RUN + '-cache-backup.json')
    file.rename(backup)
    launch('500:screen:mailbox', 'restored')
    until(lambda: private in snapshot('restored')['texts'] and shared in snapshot('restored')['texts'], '空缓存云端恢复')
    assert file.exists()
    checks.append('空本地缓存从后端恢复正文、权限、猫留言，未混入示例')
    launch('500:diaryChat;800:send:[diary] 接着这条聊', 'chat')
    def chat_done():
        request = Request(BASE + '/v1/messages', headers={'Authorization': 'Bearer ' + ACCOUNT['token']})
        history = json.loads(urlopen(request, timeout=3).read())['messages']
        return history if any(m['role'] == 'cat' and shared in m['text'] for m in history) else None
    history = until(chat_done, '日记来源进入实际聊天模型')
    assert any(m.get('diary_entry_id') == record['id'] for m in history)
    checks.append('实际App携带日记来源发送，HTTP/SSE回复确认拿到该条正文')
    launch('500:diaryShare:no;700:screen:mailbox', 'revoked')
    until(lambda: any(r['id'] == record['id'] and not r['cat_allowed'] and r['visit'] == 0 and not r['note'] for r in records()), '撤回服务端许可')
    def revoked_local():
        state = snapshot('revoked'); i = entry_in_snapshot(state, shared)
        return i is not None and state['private'][i] and not state['needsSync'][i] and not state['notes'][i]
    until(revoked_local, '撤回回执落盘')
    request = Request(BASE + '/v1/messages', headers={'Authorization': 'Bearer ' + ACCOUNT['token']})
    history = json.loads(urlopen(request, timeout=3).read())['messages']
    assert all(not m['context_allowed'] for m in history if m['diary_entry_id'] == record['id'] or m['role'] == 'cat')
    checks.append('App撤回后后端停止读取、清空留言，派生聊天停止进入上下文')
    sim('io', DEVICE, 'screenshot', '/tmp/maomao-diary-sync-revoked.png')
    report = {'evidence': '真实模拟器客户端→正式HTTP/SSE→真实PG/Redis/常驻worker；回复与留言模型均为mock', 'passed': len(checks), 'checks': checks}
    (ROOT / 'outputs/diary-sync-review/模拟器检查.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
finally:
    stop_api()
    LOG.close()
