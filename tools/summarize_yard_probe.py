#!/usr/bin/env python3
"""只读汇总实测 JSON；单组数字不能替代真机完整验收。"""
import argparse
import json
from pathlib import Path


def summarize(path):
    record = json.loads(path.read_text())
    if record.get("schemaVersion") != 2 or not record.get("pageReports"):
        return None
    pages = list(record["pageReports"].values())
    seconds = sum(page["seconds"] for page in pages)
    frames = sum(page["frames"] for page in pages)
    # 不对多页的百分位取平均：进程重载时保留原始分页面数据。
    median = pages[0]["medianFps"] if len(pages) == 1 else "分页面"
    low1 = pages[0]["low1Fps"] if len(pages) == 1 else "分页面"
    scales = [page["minScale"] for page in pages if page["minScale"] is not None]
    memory = [sample["mb"] for sample in record["appFootprintMB"] if sample["mb"] is not None]
    thermal = "/".join(dict.fromkeys(sample["state"] for sample in record["thermal"]))
    environment = record.get("environment", [])
    charging = "/".join(sorted(set(sample["batteryState"] for sample in environment))) or "缺测"
    return [path.name, record["status"], f"{seconds:.3f}", f"{frames / seconds:.2f}" if seconds else "—",
            str(median), str(low1), f"{min(scales):.2f}" if scales else "缺测", thermal,
            f"{max(memory):.2f}" if memory else "缺测", charging,
            "；".join(record["failures"]) or "无（仍需完整验收）"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    args = parser.parse_args()
    print("| 文件 | 原始判定 | 有效秒 | 平均 fps | 中位 fps | 最慢 1% fps | 最低倍率 | 热状态 | App 峰值 MiB | 充电状态 | 失败原因 |")
    print("|" + "---|" * 11)
    for path in args.files:
        row = summarize(path)
        if row:
            print("| " + " | ".join(row) + " |")
