#!/usr/bin/env python3
"""走路帧尾巴修周期：把 donor 帧的尾巴移植到 target 帧。

用法：
    python3 fix_walk_tail.py --frames ../tuanzi/felt-world-pack-v1/frames/walk --donor 5 --target 6

原因：毛毡走路六帧里 1、2、5 尾巴左倾，3、4、6 竖直，循环 6→1 会跳。换掉第 6 帧的尾巴后
序列是 倾、倾、直、直、倾、倾，首尾接上。

做法：
1. 用半径 r 的形态学开运算去掉细长部位得到「身体」；尾巴 = 主体 − 身体，限定在 bbox 左上区域（避开腿和耳朵）。
2. 关节 = 尾巴掩膜膨胀后与身体的交集的质心；donor 尾巴按两帧关节差平移。
3. target 抹掉自己的尾巴（掩膜膨胀 3px），donor 尾巴放底下、身体盖上面。
原图备份到 `_orig/`。
"""
import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def open_mask(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype("uint8") * 255, "L")
    k = 2 * r + 1
    return np.asarray(im.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))) > 0


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    im = Image.fromarray(mask.astype("uint8") * 255, "L")
    return np.asarray(im.filter(ImageFilter.MaxFilter(2 * r + 1))) > 0


def split(rgba: np.ndarray, r: int = 34):
    a = rgba[..., 3]
    solid = a > 128
    ys, xs = np.where(solid)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    body = dilate(open_mask(solid, r), 5) & solid
    region = np.zeros_like(solid)
    region[: int(y0 + (y1 - y0) * 0.62), : int(x0 + (x1 - x0) * 0.45)] = True
    tail = (a > 0) & ~body & region
    joint = dilate(tail, 6) & body
    jy, jx = np.where(joint)
    return body, tail, (float(jx.mean()), float(jy.mean()))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", type=Path, required=True)
    ap.add_argument("--donor", type=int, required=True)
    ap.add_argument("--target", type=int, required=True)
    ap.add_argument("--radius", type=int, default=34)
    args = ap.parse_args()

    name = lambda i: args.frames / f"walk-r-{i:02d}.png"
    backup = args.frames / "_orig"
    backup.mkdir(exist_ok=True)
    if not (backup / name(args.target).name).exists():
        shutil.copy(name(args.target), backup / name(args.target).name)

    donor = np.asarray(Image.open(backup / name(args.donor).name if (backup / name(args.donor).name).exists() else name(args.donor)).convert("RGBA")).copy()
    target = np.asarray(Image.open(backup / name(args.target).name).convert("RGBA")).copy()
    d_body, d_tail, d_joint = split(donor, args.radius)
    t_body, t_tail, t_joint = split(target, args.radius)
    print(f"donor 尾巴 {int(d_tail.sum())}px 关节 ({d_joint[0]:.0f},{d_joint[1]:.0f})；target 尾巴 {int(t_tail.sum())}px 关节 ({t_joint[0]:.0f},{t_joint[1]:.0f})")

    # target 去尾：尾巴掩膜膨胀 3px 内、且不属于身体的像素清空
    erase = dilate(t_tail, 3) & ~t_body
    body_layer = target.copy()
    body_layer[erase] = 0

    # donor 尾巴层（带 4px 软边），按关节差平移
    keep = dilate(d_tail, 4)
    tail_layer = donor.copy()
    tail_layer[~keep] = 0
    dx, dy = int(round(t_joint[0] - d_joint[0])), int(round(t_joint[1] - d_joint[1]))
    tail_im = Image.fromarray(tail_layer, "RGBA")
    shifted = Image.new("RGBA", tail_im.size, (0, 0, 0, 0))
    shifted.paste(tail_im, (dx, dy))

    out = shifted.copy()
    out.alpha_composite(Image.fromarray(body_layer, "RGBA"))
    out.save(name(args.target), optimize=True)
    print(f"→ {name(args.target)}  位移 ({dx},{dy})；原图在 {backup}")


if __name__ == "__main__":
    main()
