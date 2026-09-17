#!/usr/bin/env python3
"""把方向稿的页面底改成指定的冷暖，前景不动。

用法：
    python3 tint_page_bg.py --image ../../outputs/ui-style-v1-delivery/U2b/U2b__r1.png \
        --preset glow-ur --out /tmp/U2b-G3.png

为什么不重新委托出图：这一步只动背景的色相，重出会让前景再漂一次（U2a–U2d 那轮
漂了 ΔE 2.9–3.2）。在背景掩膜上做定量 Lab 位移，前景漂移是 0，量出来的 ΔE 0.457
全部来自 8 位量化 —— 位移量取 0 时同样是 0.454。

掩膜：背景 = 亮且低彩度（L≥90 且 C≤8 给权重 1，L≤84 或 C≥14 给 0，中间平滑过渡，
再高斯模糊 2px）。只改 a*/b*，L 一律不动 —— "白色为主"靠的就是 L 不动。

预设（2026-09-16 用户选定 glow-ur）：
    flat-neutral  整页中性白
    flat-blue     整页淡蓝白
    grad-top      顶蓝 → 底白
    grad-bottom   顶白 → 底蓝
    glow-ur       右上一团弥散的淡蓝光晕，其余落到暖白（选定）
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# 光晕蓝端与白端的 (a*, b*)。蓝端 b*−3.2 是"单看是白纸、和暖白并排才看得出偏蓝"那一档。
BLUE_END = (-0.30, -3.20)
WHITE_END = (-0.10, +1.20)


def to_lab(rgb: np.ndarray) -> np.ndarray:
    a = rgb.astype(np.float64) / 255.0
    a = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ m.T / np.array([0.95047, 1.0, 1.08883])
    d = 6 / 29
    f = np.where(xyz > d ** 3, np.cbrt(xyz), xyz / (3 * d * d) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def to_rgb(lab: np.ndarray) -> np.ndarray:
    fy = (lab[..., 0] + 16) / 116
    fx, fz = fy + lab[..., 1] / 500, fy - lab[..., 2] / 200
    d = 6 / 29
    g = lambda f: np.where(f > d, f ** 3, 3 * d * d * (f - 4 / 29))
    xyz = np.stack([g(fx), g(fy), g(fz)], -1) * np.array([0.95047, 1.0, 1.08883])
    mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    r = xyz @ mi.T
    r = np.where(r <= 0.0031308, 12.92 * r, 1.055 * np.power(np.clip(r, 0, None), 1 / 2.4) - 0.055)
    return np.clip(r * 255, 0, 255).astype(np.uint8)


def bg_weight(lab: np.ndarray) -> np.ndarray:
    """1 = 纯页面底，0 = 前景。中间是平滑过渡，位移小所以过渡带看不出边。"""
    L = lab[..., 0]
    C = np.hypot(lab[..., 1], lab[..., 2])
    w = np.clip((L - 84) / 6.0, 0, 1) * np.clip((14 - C) / 6.0, 0, 1)
    return np.asarray(Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), float) / 255.0


def blueness(preset: str, h: int, w: int) -> np.ndarray:
    """返回每像素的"有多蓝"，0 = 白端，1 = 蓝端。"""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    y, x = yy / (h - 1), xx / (w - 1)
    smooth = lambda t: t * t * (3 - 2 * t)
    if preset == "flat-neutral":
        return np.full((h, w), 0.43)
    if preset == "flat-blue":
        return np.full((h, w), 1.0)
    if preset == "grad-top":
        return smooth(np.clip(1 - y / 0.75, 0, 1))
    if preset == "grad-bottom":
        return smooth(np.clip((y - 0.25) / 0.75, 0, 1))
    if preset == "glow-ur":
        # 椭圆光心在画面右上（x 72%、y 12%），横向铺得比纵向宽，边缘平滑收到 0
        r = np.sqrt(((x - 0.72) / 0.85) ** 2 + ((y - 0.12) / 0.55) ** 2)
        return smooth(np.clip(1 - r, 0, 1))
    raise SystemExit(f"未知预设：{preset}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--preset", default="glow-ur")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    src = np.asarray(Image.open(args.image).convert("RGB"))
    lab = to_lab(src)
    h, w = lab.shape[:2]
    weight = bg_weight(lab)
    t = blueness(args.preset, h, w)

    bg = weight > 0.95
    a0, b0 = lab[bg][:, 1].mean(), lab[bg][:, 2].mean()
    ta = BLUE_END[0] * t + WHITE_END[0] * (1 - t)
    tb = BLUE_END[1] * t + WHITE_END[1] * (1 - t)

    out = lab.copy()
    out[..., 1] = lab[..., 1] + weight * (ta - a0)
    out[..., 2] = lab[..., 2] + weight * (tb - b0)
    rgb = to_rgb(out)
    Image.fromarray(rgb).save(args.out)

    new = to_lab(rgb)
    de = np.sqrt(((new - lab) ** 2).sum(-1))
    fg = weight < 0.05
    print(f"{args.image.name} → {args.out}  预设 {args.preset}")
    print(f"  原页面底 a*={a0:+.2f} b*={b0:+.2f}")
    print(f"  背景 ΔE 均值 {de[bg].mean():.2f}；前景 ΔE 均值 {de[fg].mean():.3f}（位移取 0 时是 0.454，即全部是量化误差）")
    print(f"  背景明度 L {new[bg][:, 0].mean():.1f}（原 {lab[bg][:, 0].mean():.1f}，L 不动）")


if __name__ == "__main__":
    main()
