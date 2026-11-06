"""隔离的开发身份验日记落盘；不重置模拟器或改动已有账号文件。
先构建安装 App，再 python3 tools/test_diary_simulator.py。
"""
import hashlib
import json
import subprocess
import time
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

DEVICE = "5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD"
APP = "com.maomao.app"
URL = "http://localhost:8789"
RUN = "diary-review-" + uuid.uuid4().hex[:8]


def sim(*args, check=True):
    return subprocess.run(["xcrun", "simctl", *args], text=True, capture_output=True, check=check).stdout.strip()


root = Path(sim("get_app_container", DEVICE, APP, "data"))
documents = root / "Documents"
report = {}


def stop():
    sim("terminate", DEVICE, APP, check=False)


def launch(identity, script):
    stop()
    sim("launch", DEVICE, APP, "-backendMode", "local", "-backendURL", URL,
        "-backendToken", identity, "-script", "200:time:12;" + script)


def snapshot(name):
    path = documents / ("diary-" + RUN + "-" + name + ".json")
    deadline = time.monotonic() + 20
    while not path.exists():
        if time.monotonic() > deadline:
            raise RuntimeError("等待模拟器快照超时：" + name)
        time.sleep(0.2)
    return json.loads(path.read_text())


def command(name, delay=900):
    return str(delay) + ":diarySnapshot:" + RUN + "-" + name


a = RUN + "-a"
b = RUN + "-b"
try:
    launch(a, command("empty"))
    assert snapshot("empty")["texts"] == []
    report["新身份无演示记录"] = True
    text = "验收记录：今天在窗边看书。"
    launch(a, "600:diaryCapture:" + text + ";" + command("saved", 1100))
    saved = snapshot("saved")
    assert saved["texts"] == [text] and saved["private"] == [True] and not saved["draft"]
    launch(a, command("restored"))
    restored = snapshot("restored")
    assert restored["ids"] == saved["ids"] and restored["texts"] == saved["texts"]
    report["保存后强退重开恢复"] = True
    launch(b, command("other"))
    assert snapshot("other")["texts"] == []
    launch(a, command("back"))
    assert snapshot("back")["ids"] == saved["ids"]
    report["切换开发身份相互隔离"] = True
    digest = hashlib.sha256((URL + "\n" + a).encode()).hexdigest()
    file = root / "Library/Application Support/DiaryRecords" / (digest + ".json")
    valid = file.read_bytes()
    stop()
    file.write_text("故障验收：损坏文件")
    launch(a, "500:diaryEditor;600:diaryCapture:读取失败时不可覆盖;" + command("corrupt", 1000))
    corrupt = snapshot("corrupt")
    assert corrupt["failed"] and not corrupt["texts"] and corrupt["draft"] == "读取失败时不可覆盖"
    assert file.read_text() == "故障验收：损坏文件"
    report["读取失败保留原件并阻止覆盖"] = True
    stop()
    file.write_bytes(valid)
    launch(a, "500:diaryEditor;" + command("loaded", 800) + ";4000:diaryCapture:保存失败后保留的草稿;" + command("writeFailed", 4400))
    assert snapshot("loaded")["texts"] == [text]
    backup = file.with_suffix(".review-backup")
    file.rename(backup)
    file.mkdir()
    try:
        failed = snapshot("writeFailed")
        assert failed["draft"] == "保存失败后保留的草稿" and failed["capturing"] and failed["saveFailed"]
        assert failed["texts"] == [text]
        report["落盘失败保留草稿和旧记录"] = True
    finally:
        stop()
        file.rmdir()
        backup.rename(file)
    # 注入旧日期夹具，再由真实客户端显示。只操作本轮新建的身份。
    archive = json.loads(valid)
    for day, body in [("2026-10-17", "验收用旧记录：周六下过雨。"), ("2026-10-18", "验收用旧记录：周日读了一本书。")]:
        old = dict(archive["entries"][0])
        created = datetime.fromisoformat(day + "T12:00:00").replace(tzinfo=ZoneInfo("Asia/Shanghai")).timestamp() - 978307200
        old.update(id="review-" + day, dayKey=day, text=body, createdAt=created, timeZoneID="Asia/Shanghai")
        archive["entries"].append(old)
    file.write_text(json.dumps(archive, ensure_ascii=False))
    launch(a, "600:diaryDay:2026-10-18;" + command("oldDay", 1000) + ";1200:screen:mailbox")
    assert snapshot("oldDay")["shown"] == ["验收用旧记录：周日读了一本书。"]
    report["真实客户端按旧日期筛选"] = True
    report["验收身份"] = a
    report["模拟器"] = "iPhone 17 Pro / iOS 26.5"
    Path("outputs/diary-local-review/模拟器检查.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
finally:
    # 测试启动参数没有写入 UserDefaults；原有账号和文件不变。
    stop()
