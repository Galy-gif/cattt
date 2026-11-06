"""用独立开发身份验创建恢复，不调用模型、不重置现有账号。先构建安装 App。"""
import hashlib
import json
import os
import subprocess
import time
import uuid
from pathlib import Path

DEVICE = os.environ.get("MAOMAO_REVIEW_DEVICE", "5D171DD3-720E-4FC4-BEB5-BF7B73A25ECD")
APP = "com.maomao.app"
URL = "http://localhost:8789"
RUN = "creation-review-" + uuid.uuid4().hex[:8]


def sim(*args, check=True):
    return subprocess.run(["xcrun", "simctl", *args], text=True, capture_output=True, check=check).stdout.strip()


root = Path(sim("get_app_container", DEVICE, APP, "data"))
documents = root / "Documents"
report = {}
a, b = RUN + "-a", RUN + "-b"


def stop():
    sim("terminate", DEVICE, APP, check=False)


def launch(script="", identity=a):
    stop()
    sim("launch", DEVICE, APP, "-backendMode", "local", "-backendURL", URL,
        "-backendToken", identity, "-script", "100:time:12;" + script)


def snap(name, delay=700):
    return f"{delay}:creationSnapshot:{RUN}-{name}"


def read(name):
    path = documents / f"creation-{RUN}-{name}.json"
    deadline = time.monotonic() + 20
    while not path.exists():
        if time.monotonic() > deadline:
            raise RuntimeError("等待快照超时：" + name)
        time.sleep(0.05)
    return json.loads(path.read_text())


def archive(identity=a):
    digest = hashlib.sha256((URL + "\n" + identity).encode()).hexdigest()
    return root / "Library/Application Support/CreationRecords" / (digest + ".json")


try:
    launch("200:creationStart;" + snap("welcome"))
    assert read("welcome")["step"] == "welcome"
    launch(snap("welcome-reopen"))
    assert read("welcome-reopen")["step"] == "welcome"
    launch("200:creationNext;300:temperament:curious;400:trait:energy=2;" + snap("temperament"))
    assert read("temperament")["step"] == "temperament"
    launch(snap("temperament-reopen"))
    t = read("temperament-reopen")
    assert t["step"] == "temperament" and t["temperament"] == "curious" and t["traits"]["energy"] == 2
    launch("200:creationNext;300:creationName:云朵;" + snap("naming"))
    assert read("naming")["nameDraft"] == "云朵"
    launch(snap("naming-reopen"))
    n = read("naming-reopen")
    assert n["step"] == "naming" and n["nameDraft"] == "云朵"
    report["欢迎、气质、名字草稿逐步强退恢复"] = True
    launch("200:creationName:;300:creationNext;" + snap("blank", 450)
           + ";600:creationName:一二三四五六七八九;700:creationNext;" + snap("too-long", 850))
    assert read("blank")["step"] == "naming" and read("too-long")["step"] == "naming"
    report["空名与超长名字不可进入初见"] = True
    launch("200:creationName:云朵;300:creationNext;" + snap("greeting", 450))
    assert read("greeting")["lines"] == ["你来了。"]
    launch(snap("question", 1900))
    q = read("question")
    assert q["step"] == "firstMeeting" and q["lines"] == ["你来了。", "我要怎么叫你？"]
    launch("200:creationInput:叫我小林;" + snap("input"))
    assert read("input")["input"] == "叫我小林"
    launch(snap("input-reopen"))
    assert read("input-reopen")["input"] == "叫我小林"
    launch("200:creationSend;220:creationSend;" + snap("pending", 350))
    p = read("pending")
    assert p["pending"] and p["lines"].count("叫我小林") == 1
    launch(snap("done", 1500))
    d = read("done")
    assert d["done"] and d["firstReply"] == "叫我小林" and len(d["lines"]) == 4
    launch(snap("done-reopen"))
    assert read("done-reopen")["lineIDs"] == d["lineIDs"]
    report["初见未发输入、问候中断、发送中断恢复且不重复"] = True
    launch("200:creationEnter;300:creationEnter;" + snap("entered"))
    e = read("entered")
    assert e["step"] == "home" and e["name"] == "云朵" and e["profileID"] and e["createdAt"] > 0
    launch("200:creationEnter;" + snap("entered-reopen"))
    er = read("entered-reopen")
    for key in ["name", "temperament", "traits", "firstReply", "profileID", "createdAt", "lineIDs"]:
        assert er[key] == e[key], key
    report["完成后身份、气质、称呼、领养日期稳定且重复确认幂等"] = True
    launch(snap("other"), identity=b)
    other = read("other")
    assert other["nameDraft"] == "" and other["firstReply"] == "" and not other["profileID"]
    launch(snap("back"))
    assert read("back")["profileID"] == e["profileID"]
    report["不同开发身份及切回原身份隔离"] = True
    # 只破坏本轮刚创建的隔离文件，随后恢复原字节。
    file = archive()
    stop()
    valid = file.read_bytes()
    try:
        file.write_text("故障验收：损坏的创建文件")
        launch("200:creationName:不可覆盖;300:creationNext;" + snap("corrupt"))
        corrupt = read("corrupt")
        assert corrupt["loadFailed"] and corrupt["step"] == "welcome"
        assert file.read_text() == "故障验收：损坏的创建文件"
        stop()
        future = json.loads(valid)
        future["version"] = 99
        future_bytes = json.dumps(future, ensure_ascii=False).encode()
        file.write_bytes(future_bytes)
        launch("200:creationStart;" + snap("future"))
        assert read("future")["loadFailed"] and file.read_bytes() == future_bytes
    finally:
        stop()
        file.write_bytes(valid)
    report["损坏文件与未来版本保护原件并阻止覆盖"] = True
    launch("200:creationStart;300:creationNext;400:creationNext;500:creationName:旧草稿;" + snap("before-failure", 750)
           + ";2400:creationName:保存失败草稿;2500:creationNext;" + snap("write-failed", 2750)
           + ";5000:creationRetry;5200:creationNext;" + snap("write-retried", 5500))
    assert read("before-failure")["step"] == "naming"
    backup = file.with_suffix(".review-backup")
    file.rename(backup)
    file.mkdir()
    try:
        failed = read("write-failed")
        assert failed["saveFailed"] and failed["step"] == "naming" and failed["nameDraft"] == "保存失败草稿"
        assert json.loads(backup.read_bytes())["profile"]["name"] == "云朵"
    finally:
        file.rmdir()
        backup.rename(file)
    retried = read("write-retried")
    assert not retried["saveFailed"] and retried["step"] == "firstMeeting"
    report["写入失败保留草稿与旧档案，重试成功后才能前进"] = True
    report["模拟器"] = "iPhone 17 Pro / iOS 26.5"
    report["模型调用"] = False
    output = Path("outputs/creation-recovery-review/模拟器检查.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
finally:
    stop()
