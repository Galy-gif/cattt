#!/usr/bin/env python3
"""团子逐帧 v6 收图验收：清点、哈希、格式、接力、剪影与喝水高度。"""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "outputs/frames-v6-delivery"
OUT = ROOT / "outputs/frames-v6-review"
IDS = [
    "H1-sit-look", "H2-head-tilt", "H3-groom",
    "M1-happy", "M2-sulk", "M3-sad",
    "D1-drink-down", "D2-drink-lap", "D3-drink-up",
]
CELL = 512


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    old = sys.argv
    sys.argv = [old[0]]
    spec.loader.exec_module(module)
    sys.argv = old
    return module


v5 = load_module("frames_v5", ROOT / "assets/tools/intake_frames_v5.py")
rig = v5.rig


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalized(mask, size=256):
    ys, xs = np.nonzero(mask)
    crop = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    scale = min((size - 16) / crop.shape[0], (size - 16) / crop.shape[1])
    im = Image.fromarray(crop.astype(np.uint8) * 255)
    im = im.resize((max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))), Image.NEAREST)
    arr = np.asarray(im) > 127
    canvas = np.zeros((size, size), bool)
    y = (size - arr.shape[0]) // 2
    x = (size - arr.shape[1]) // 2
    canvas[y:y + arr.shape[0], x:x + arr.shape[1]] = arr
    return canvas


def iou(a, b):
    return float((a & b).sum() / max(1, (a | b).sum()))


def nose_height(mask):
    """右侧面喝水姿势中，用最右侧轮廓的中位 y 近似嘴／鼻高度。"""
    ys, xs = np.nonzero(mask)
    right = xs.max()
    edge_y = ys[xs >= right - 7]
    return float(np.median(edge_y))


def longest_row_run(mask):
    best = 0
    for row in mask:
        xs = np.flatnonzero(row)
        if not len(xs):
            continue
        cuts = np.where(np.diff(xs) > 1)[0]
        starts = np.r_[0, cuts + 1]
        ends = np.r_[cuts, len(xs) - 1]
        best = max(best, int(np.max(xs[ends] - xs[starts] + 1)))
    return best


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.load(open(DELIVERY / "delivery.json"))
    items = {item["id"]: item for item in manifest["items"]}
    report = {"delivery": str(DELIVERY), "gates": {}, "sheets": {}, "relay": [], "emotion_silhouette": {}, "drink_mouth_y": {}}

    inventory = [f"缺清单条目 {item}" for item in IDS if item not in items]
    inventory += [f"未知清单条目 {item}" for item in items if item not in IDS]
    listed = {item["file"] for item in items.values() if item.get("file")}
    on_disk = {str(p.relative_to(DELIVERY)) for p in DELIVERY.rglob("*.png") if "_rejected" not in p.parts}
    inventory += [f"多出文件 {p}" for p in sorted(on_disk - listed)]
    inventory += [f"清单文件不存在 {p}" for p in sorted(listed - on_disk)]
    report["gates"]["1_inventory"] = inventory

    rig.DELIVERY = DELIVERY
    history = rig.build_registry()
    hash_fails = []
    seen = {}
    for item_id, item in items.items():
        path = DELIVERY / item["file"]
        digest = sha256(path)
        if item.get("sha256") != digest:
            hash_fails.append(f"{item_id}: 清单哈希不符")
        if digest in history:
            hash_fails.append(f"{item_id}: 撞历史素材 {history[digest]}")
        if digest in seen:
            hash_fails.append(f"{item_id}: 与 {seen[digest]} 重复")
        seen[digest] = item_id
    report["gates"]["2_hash"] = hash_fails

    masks = {}
    raw_cell_masks = {}
    format_fails = []
    for item_id in IDS:
        path = DELIVERY / items[item_id]["file"]
        im = Image.open(path)
        rgb = np.asarray(im.convert("RGB"))
        full_mask, bg = v5.key_mask(rgb)
        exact_bg = np.all(rgb == [255, 0, 255], axis=-1)
        exact_background_share = float(exact_bg[~full_mask].mean())
        seam = np.concatenate([
            full_mask[:, CELL - 1:CELL + 1].ravel(),
            full_mask[:, 2 * CELL - 1:2 * CELL + 1].ravel(),
            full_mask[CELL - 1:CELL + 1, :].ravel(),
        ])
        cats = v5.split_cats(full_mask)
        entry = {
            "size": list(im.size),
            "mode": im.mode,
            "background_border_rgb": [round(float(v), 1) for v in bg],
            "exact_FF00FF_share": round(exact_background_share, 4),
            "cat_components": len(cats),
            "crosses_cell_lines": bool(seam.any()),
            "fails": [],
        }
        if im.size != (1536, 1024):
            entry["fails"].append(f"画布 {im.size}，应为 1536x1024")
        if len(cats) != 6:
            entry["fails"].append(f"分出 {len(cats)} 个主体，应为 6")
        if seam.any():
            entry["fails"].append("主体跨过格子分界")
        if exact_background_share < 0.99:
            entry["fails"].append("背景不是纯 #FF00FF 平涂")
        for index, (mask, _) in enumerate(cats, 1):
            masks[(item_id, index)] = v5.crop_mask(mask)
        for index, cell_rgb in enumerate(v5.cells(rgb), 1):
            raw_cell_masks[(item_id, index)] = v5.key_mask(cell_rgb)[0]
        report["sheets"][item_id] = entry
        format_fails += [f"{item_id}: {failure}" for failure in entry["fails"]]
    report["gates"]["3_format"] = format_fails

    n4 = np.asarray(Image.open(ROOT / "outputs/frames-v5-delivery/N4-settle/N4-settle__r1.png").convert("RGB"))
    n4_mask, _ = v5.key_mask(n4)
    n4_cats = v5.split_cats(n4_mask)
    masks[("N4", 3)] = v5.crop_mask(n4_cats[2][0])
    r3 = np.asarray(Image.open(ROOT / "assets/tuanzi/frames-v5/refs/R3-cat-side-standing.png").convert("RGB"))
    r3_mask, _ = v5.key_mask(r3)
    masks[("R3", 1)] = v5.crop_mask(r3_mask)

    content_fails = []
    target_run = longest_row_run(v5.key_mask(v5.cells(n4)[2])[0])
    report["seated_scale_proxy"] = {"N4#3": target_run}
    for item_id in ("H1-sit-look", "H2-head-tilt", "H3-groom", "M1-happy", "M2-sulk", "M3-sad"):
        run = longest_row_run(raw_cell_masks[(item_id, 1)])
        deviation = abs(run / target_run - 1)
        report["seated_scale_proxy"][f"{item_id}#1"] = run
        if deviation > 0.04:
            content_fails.append(f"{item_id} 首格尺度代理 {run}px 与 N4 {target_run}px 相差 {deviation * 100:.1f}%")

    relay_pairs = [
        (("N4", 3), ("H1-sit-look", 1)),
        (("N4", 3), ("H2-head-tilt", 1)),
        (("N4", 3), ("H3-groom", 1)),
        (("N4", 3), ("M3-sad", 1)),
        (("R3", 1), ("D1-drink-down", 1)),
        (("D1-drink-down", 6), ("D2-drink-lap", 1)),
        (("D1-drink-down", 6), ("D3-drink-up", 1)),
        (("R3", 1), ("D3-drink-up", 6)),
    ]
    for source, target in relay_pairs:
        scale, overlap = v5.fit_scale(masks[source], masks[target])
        result = {
            "source": f"{source[0]}#{source[1]}",
            "target": f"{target[0]}#{target[1]}",
            "scale": round(scale, 3),
            "iou": round(overlap, 3),
            "pass": overlap >= 0.85,
        }
        report["relay"].append(result)
        if overlap < 0.85:
            content_fails.append(f"{result['target']} 与 {result['source']} 接力 IoU {overlap:.3f} < 0.85")

    emotions = {name: normalized(masks[(name, 3)]) for name in ("M1-happy", "M2-sulk", "M3-sad")}
    for a, b in (("M1-happy", "M2-sulk"), ("M1-happy", "M3-sad"), ("M2-sulk", "M3-sad")):
        overlap = iou(emotions[a], emotions[b])
        report["emotion_silhouette"][f"{a} vs {b}"] = round(overlap, 3)
        if overlap > 0.80:
            content_fails.append(f"{a} / {b} 剪影 IoU {overlap:.3f} > 0.80")

    drink_keys = [("D1-drink-down", 6)] + [("D2-drink-lap", i) for i in range(1, 7)] + [("D3-drink-up", 1)]
    heights = []
    for key in drink_keys:
        value = nose_height(raw_cell_masks[key])
        heights.append(value)
        report["drink_mouth_y"][f"{key[0]}#{key[1]}"] = round(value, 1)
    spread = max(heights) - min(heights)
    report["drink_mouth_y_spread"] = round(spread, 1)
    if spread > 6:
        content_fails.append(f"喝水嘴沿高度跨度 {spread:.1f}px > 6px")
    report["gates"]["4_content_fingerprint"] = content_fails
    report["gates"]["5_human"] = ["数字关完成后由用户确认美术观感；当前仅记录模型自检。"]

    json.dump(report, open(OUT / "intake-report.json", "w"), ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
