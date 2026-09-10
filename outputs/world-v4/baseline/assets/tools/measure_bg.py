#!/usr/bin/env python3
"""背景规则 1 量测：沿行走带逐列量地面色相，与猫主色算角距。

用法：
    python3 measure_bg.py --image ../scenes/tuanzi-courtyard-v1/02-....png \
        [--band 0.72 0.95] [--step 60] [--cat-hue 30 --cat-sat 0.76] [--out report.md]

规则（README 第 0 节）：猫与周围地面色相角距 ≥ 55°，且猫饱和度比地面高 ≥ 0.2。
band 用图高的比例给，换分辨率不用改参数。
"""
import argparse
import colorsys
from pathlib import Path

import numpy as np
from PIL import Image


def hue_dist(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--band", type=float, nargs=2, default=(0.72, 0.95), help="行走带 y 范围（图高比例）")
    ap.add_argument("--step", type=int, default=60, help="列宽（像素，按 1821 宽给；其它宽度按比例缩放）")
    ap.add_argument("--cat-hue", type=float, default=30.0)
    ap.add_argument("--cat-sat", type=float, default=0.76)
    ap.add_argument("--min-dist", type=float, default=55.0)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    im = Image.open(args.image).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im).astype("float32") / 255.0
    y0, y1 = int(h * args.band[0]), int(h * args.band[1])
    step = max(8, int(round(args.step * w / 1821)))
    rows = []
    fails = 0
    for x0 in range(0, w, step):
        x1 = min(w, x0 + step)
        block = rgb[y0:y1, x0:x1].reshape(-1, 3)
        block = block[:: max(1, len(block) // 3000)]
        hsv = np.array([colorsys.rgb_to_hsv(*p) for p in block])
        # 只量「地面色」：排除饱和度很低（石径、纸色）的像素，避免石头拉偏
        ground = hsv[hsv[:, 1] > 0.10]
        if len(ground) < 50:
            ground = hsv
        # 色相取圆均值再转角度，避免 0/360 断裂
        ang = ground[:, 0] * 2 * np.pi
        hue = (np.degrees(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) + 360) % 360
        sat = float(np.median(ground[:, 1]))
        lum = float(np.median(ground[:, 2]))
        d = hue_dist(hue, args.cat_hue)
        ok = d >= args.min_dist and (args.cat_sat - sat) >= 0.2
        fails += 0 if ok else 1
        rows.append((x0, x1, hue, sat, lum, d, ok))

    lines = [
        f"# 规则 1 量测 · {args.image.name}",
        "",
        f"- 尺寸 {w}×{h}；行走带 y {y0}–{y1}（{args.band[0]:.2f}–{args.band[1]:.2f}）；列宽 {step}px",
        f"- 猫主色 H {args.cat_hue:.1f}° / S {args.cat_sat:.2f}；阈值：角距 ≥ {args.min_dist:.0f}°，S 差 ≥ 0.20",
        f"- **结果：{len(rows)} 列中 {fails} 列不过**",
        "",
        "| 列 x | 地面 H° | 地面 S | 地面 V | 角距 | S 差 | 判定 |",
        "|---:|---:|---:|---:|---:|---:|---|",
    ]
    for x0, x1, hue, sat, lum, d, ok in rows:
        lines.append(f"| {x0}–{x1} | {hue:.1f} | {sat:.2f} | {lum:.2f} | {d:.1f} | {args.cat_sat - sat:+.2f} | {'过' if ok else '✗'} |")
    hues = [r[2] for r in rows]
    dists = [r[5] for r in rows]
    lines += [
        "",
        f"地面 H 范围 {min(hues):.1f}–{max(hues):.1f}°；角距范围 {min(dists):.1f}–{max(dists):.1f}°。",
    ]
    text = "\n".join(lines)
    print(text)
    if args.out:
        args.out.write_text(text + "\n")


if __name__ == "__main__":
    main()
