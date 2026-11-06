#!/usr/bin/env python3
"""运行真实 iOS 构图预览并判定单组性能；不代替画面、手感和完整验收。"""
import argparse
import json
import math
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]


def verdict(record, duration, build, diagnostic=False):
    failures = []
    missing = ["用户画面与手感确认", "两进程合计内存", "冷启动与恢复录屏", "独立能耗采样"]
    report = record.get("report", {})
    for key in ["seconds", "frames", "medianFps", "low1Fps", "minScale"]:
        value = report.get(key)
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            failures.append(f"{key} 缺失或无效")
    if failures:
        return {"performance": "未通过", "failures": failures, "missing": missing}
    if record.get("isSimulator") is not False:
        failures.append("不是真机证据")
    if report["seconds"] < duration:
        failures.append("有效采样时长不足")
    if report["medianFps"] < 55:
        failures.append("中位帧率低于55")
    if report["low1Fps"] < 40:
        failures.append("最慢1%帧率低于40")
    if report["minScale"] <= .75:
        failures.append("自适应倍率触底")
    if report.get("trajectoryClearance", {}).get("violations", 0) > 0:
        failures.append("实际轨迹穿透")
    if report.get("pauses"):
        failures.append("持续性能组有暂停，须单列恢复组")
    if any(e.get("type") in ["error", "contextLost", "processTerminated"] for e in record.get("events", [])):
        failures.append("运行期错误或进程/上下文丢失")
    provenance = record.get("build", {})
    for key in ["sourceHash", "modelHashes"]:
        if provenance.get(key) != build.get(key):
            failures.append(f"{key} 与指定构建不一致")
    environment = record.get("environment", [])
    if not environment:
        missing.append("亮度/充电/热状态时间序列")
        if not diagnostic:
            failures.append("缺少测试环境时间序列")
    else:
        if any(s.get("thermal") in ["serious", "critical"] for s in environment):
            failures.append("热状态超过fair")
        if not diagnostic:
            if any(s.get("batteryState") != "unplugged" for s in environment):
                failures.append("不满足不充电条件")
            if any(s.get("lowPowerMode") is not False for s in environment):
                failures.append("低电量模式未关闭或缺测")
            # UIScreen 的 Float 转 Double 后，60% 会成为 0.6000000238。
            # 只容纳浮点表示误差，不放宽实际亮度范围。
            if any(not isinstance(s.get("brightness"), (int, float)) or not .4 - 1e-6 <= s["brightness"] <= .6 + 1e-6 for s in environment):
                failures.append("亮度不在约半亮度范围（40%至60%）")
            if any(s.get("thermal") not in ["nominal", "fair"] for s in environment):
                failures.append("热状态缺测或无效")
        memory = [s.get("appFootprintMiB") for s in environment if isinstance(s.get("appFootprintMiB"), (int, float))]
        if memory and max(memory) > 450:
            failures.append("App单进程已超过450MiB")
    if diagnostic:
        missing.append("本组为诊断采样，不能代替正式矩阵")
    return {"performance": "未通过" if failures else "单组通过", "failures": failures,
            "missing": missing, "fullCloseout": "未完成", "diagnostic": diagnostic,
            "seconds": report["seconds"], "medianFps": report["medianFps"],
            "low1Fps": report["low1Fps"], "minScale": report["minScale"]}


def command(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=45)


def check_stroll(record, result):
    layout_source = (ROOT / "web/src/yard/layout.generated.ts").read_text()
    layout = json.loads(layout_source.split("export const LAYOUT = ", 1)[1].rsplit(" as const;", 1)[0])
    report = record.get("report", {})
    if report.get("journey", {}).get("arrived") is not True:
        result["failures"].append("散步行程未完成")
    missing_nodes = sorted(set(layout["stroll"]) - set(report.get("visitedNodes", [])))
    if missing_nodes:
        result["failures"].append("散步路线节点缺测：" + "、".join(missing_nodes))
    if result["failures"]:
        result["performance"] = "未通过"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--device")
    parser.add_argument("--bundle", default="com.maomao.probe.t3m28s3j8x4")
    parser.add_argument("--view", choices=["house", "bed", "tree", "grass", "pond", "fence", "overview"], default="house")
    parser.add_argument("--time", choices=["day", "night"], default="day")
    parser.add_argument("--duration", type=int, default=300)
    parser.add_argument("--stroll", action="store_true")
    parser.add_argument("--diagnostic", action="store_true")
    parser.add_argument("--build", type=Path, default=ROOT / "ios/Maomao/Resources/YardWeb/probe-build.json")
    parser.add_argument("--record", type=Path, help="只读判定已有证据，不启动设备")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs/yard-depth-review/metrics/iphone16pm-2026-10-02")
    args = parser.parse_args()
    if args.duration < 15:
        parser.error("采样至少15秒；正式组按计划使用300/600秒")
    if not args.diagnostic and args.duration < (600 if args.time == "night" else 300):
        parser.error("正式白天组至少300秒，夜雨组至少600秒；短测须显式标diagnostic")
    build = json.loads(args.build.read_text())
    if args.record:
        data = json.loads(args.record.read_text())
        result = verdict(data, args.duration, build, args.diagnostic)
        if args.stroll:
            check_stroll(data, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if result["failures"] else 0
    if not args.device:
        parser.error("运行真机需要--device")
    args.output.mkdir(parents=True, exist_ok=True)
    stem = f'{args.view}-{args.time}-{args.duration}s-{"stroll" if args.stroll else "fixed"}'
    dest = args.output / f"{stem}.json"
    # 下载中间文件只用于新runId与结束时长判定，不写成验收证据。
    temp = ROOT / "outputs/yard-depth-review/originals/iphone16pm-2026-10-02" / f"{stem}-poll.json"
    temp.parent.mkdir(parents=True, exist_ok=True)
    source = f"Documents/yard-composition/{args.view}-{args.time}-ui.json"

    def copy():
        command("xcrun", "devicectl", "device", "copy", "from", "--device", args.device,
                "--domain-type", "appDataContainer", "--domain-identifier", args.bundle,
                "--source", source, "--destination", str(temp))
        return json.loads(temp.read_text())

    try:
        old_run = copy().get("runId")
    except subprocess.CalledProcessError:
        old_run = None
    launch = command("xcrun", "devicectl", "device", "process", "launch", "--terminate-existing", "--device", args.device,
                     args.bundle, "--", "-yardComposition", "-yardCompositionView", args.view,
                     "-yardCompositionTime", args.time, "-yardCompositionUI", "YES",
                     "-yardCompositionDuration", str(args.duration), "-yardCompositionDemo", "NO",
                     "-yardCompositionRecovery", "NO", "-yardCompositionStroll", "YES" if args.stroll else "NO")
    print(f"{stem}: 本轮启动，等待有效采样；mode={'诊断' if args.diagnostic else '正式'}", flush=True)
    began = time.monotonic()
    deadline = began + args.duration + 90
    next_progress = 0
    while time.monotonic() < deadline:
        time.sleep(4)
        try:
            data = copy()
            seconds = data.get("report", {}).get("seconds", 0)
            if data.get("runId") and data["runId"] != old_run and seconds >= args.duration:
                result = verdict(data, args.duration, build, args.diagnostic)
                if args.stroll:
                    check_stroll(data, result)
                dest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
                (args.output / f"{stem}-verdict.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
                print(json.dumps(result, ensure_ascii=False), flush=True)
                return 1 if result["failures"] else 0
            if data.get("runId") != old_run and data.get("build", {}).get("sourceHash") != build["sourceHash"]:
                raise RuntimeError("设备尚未安装指定构建，停止采样")
        except subprocess.CalledProcessError:
            pass
        elapsed = time.monotonic() - began
        if elapsed >= next_progress:
            print(f"{stem}: 等待最终落盘，已等待 {elapsed:.0f}s", flush=True)
            next_progress = elapsed + 30
    raise RuntimeError("本轮真机证据超时；不使用旧文件替代")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, RuntimeError) as error:
        print(f"未完成：{error}")
        if isinstance(error, subprocess.CalledProcessError):
            print(error.output)
        raise SystemExit(2)
