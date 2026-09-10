#!/usr/bin/env python3
"""横条 → 六帧 RGBA + 逐帧量测。

用法：
    python3 slice_sheet.py --sheet-dir ../tuanzi/felt-world-pack-v1/actions \
        --out ../tuanzi/felt-world-pack-v1/frames [--probe]

每张横条：
1. 底色取四边 12px 边框的中位色。
2. 前景 = 与底色 RGB 欧氏距离 > tol_hi 的像素；列投影分帧（帧间空白列）。
3. 每帧：从裁片外框泛洪「像底色」的像素得到外部区域；内部 alpha 255，
   边带按距离渐变（tol_lo..tol_hi）并反混色，保留毛毡毛边、去掉绿晕。
4. 同一动作六帧放到同一画布：脚底对齐到同一行、按 alpha 质心水平居中。
5. 量：bbox、可见高、脚底 y、面积、主色 H/S、离主体 8px 外的杂点。

`--probe` 只打印底色统计和分帧结果，不写文件。
"""
import argparse
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 动作 id ← 文件名前缀。fps / loop 是预览页与 App 的起始值，用户看过预览后再调。
ACTIONS = {
    "01-walk": dict(id="walk", name="走路", fps=8, loop="loop", anchor="torso"),
    "02-sleepy-nod": dict(id="sleepyNod", name="困倦点头", fps=4, loop="pingpong", anchor="feet"),
    "03-blink-look": dict(id="blinkLook", name="眨眼看你", fps=10, loop="once", anchor="feet"),
    "04-stretch": dict(id="stretch", name="伸懒腰", fps=6, loop="once", anchor="hindfeet"),
    "05-tree-scratch-cat-only": dict(id="treeScratch", name="树干磨爪", fps=8, loop="loop", anchor="feet"),
    "06-tail-chase": dict(id="tailChase", name="追尾巴", fps=8, loop="loop", anchor="centroid"),
    "07-run": dict(id="run", name="奔跑", fps=12, loop="loop", anchor="torso"),
    "08-sleep-breathe": dict(id="sleepBreathe", name="蜷睡呼吸", fps=3, loop="pingpong", anchor="feet"),
}

# 水平锚点（2026-09-09 叠影发现：按整猫质心居中，头一动身体就跟着挪，脚在晃）：
#   centroid  整猫 alpha 质心（只给转圈的追尾巴）
#   feet      最下 14% 高度带的质心：站着 / 坐着 / 趴着时脚不动
#   hindfeet  脚掌带里靠左 40% 的质心：伸懒腰前爪往前滑，后脚不动
#   torso     半径 40 开运算去掉腿和尾后的躯干质心：走路奔跑腿在摆
def anchor_x(alpha: np.ndarray, kind: str) -> float:
    solid = alpha > 128
    ys, xs = np.where(solid)
    if kind == "centroid":
        return float(xs.mean())
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if kind in ("feet", "hindfeet"):
        band = solid.copy()
        band[: int(y1 - (y1 - y0) * 0.14)] = False
        if kind == "hindfeet":
            band[:, int(x0 + (x1 - x0) * 0.40):] = False
        by, bx = np.where(band)
        return float(bx.mean()) if len(bx) else float(xs.mean())
    if kind == "torso":
        im = Image.frombytes("L", (solid.shape[1], solid.shape[0]), (solid.astype("uint8") * 255).tobytes())
        opened = np.asarray(im.filter(ImageFilter.MinFilter(81)).filter(ImageFilter.MaxFilter(81))) > 0
        ty, tx = np.where(opened)
        return float(tx.mean()) if len(tx) else float(xs.mean())
    raise ValueError(kind)

MARGIN = 16          # 裁片四周留白（源像素）
TOL_LO, TOL_HI = 10.0, 34.0   # 边带渐变：距底色 < lo 视为纯底，> hi 视为纯猫
GAP_MIN = 12         # 分帧时允许的最小空白列宽


def border_color(rgb: np.ndarray, w: int = 12) -> np.ndarray:
    ring = np.concatenate([
        rgb[:w].reshape(-1, 3), rgb[-w:].reshape(-1, 3),
        rgb[:, :w].reshape(-1, 3), rgb[:, -w:].reshape(-1, 3),
    ])
    return np.median(ring, axis=0)


def split_columns(fg: np.ndarray) -> list[tuple[int, int]]:
    """列投影 → [(x0, x1)] 前景列区间（闭开）。"""
    cols = fg.any(axis=0)
    runs, start = [], None
    for x, v in enumerate(cols):
        if v and start is None:
            start = x
        elif not v and start is not None:
            runs.append((start, x))
            start = None
    if start is not None:
        runs.append((start, len(cols)))
    # 合并被窄空隙隔开的段（尾巴尖之类）
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < GAP_MIN:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    # 过宽的段（两帧挨在一起）：在中段最细的一列切开
    widths = sorted(x1 - x0 for x0, x1 in merged)
    median_w = widths[len(widths) // 2]
    final = []
    for x0, x1 in merged:
        if x1 - x0 > 1.5 * median_w:
            counts = fg[:, x0:x1].sum(axis=0)
            lo, hi = int((x1 - x0) * 0.3), int((x1 - x0) * 0.7)
            cut = x0 + lo + int(np.argmin(counts[lo:hi]))
            final += [(x0, cut), (cut, x1)]
        else:
            final.append((x0, x1))
    return final


def flood(mask: np.ndarray, seed: tuple[int, int], fill: int = 128) -> np.ndarray:
    """对 0/255 掩膜从 seed 泛洪，返回被填到的布尔区域。
    注意：Pillow 12 里 Image.fromarray 得到的图 floodfill 不生效，必须 frombytes 复制。"""
    h, w = mask.shape
    im = Image.frombytes("L", (w, h), np.ascontiguousarray(mask, dtype="uint8").tobytes())
    ImageDraw.floodfill(im, seed, fill, thresh=0)
    return np.asarray(im) == fill


def cut_frame(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """返回 RGBA（float→uint8），边带反混色。"""
    dist = np.linalg.norm(rgb - bg, axis=2)
    like_bg = dist < TOL_HI
    # 从外框泛洪：只有和外框连通的「像底色」区域才是外部，猫身上的浅色不受影响
    pad = np.pad(like_bg.astype("uint8"), 1, constant_values=1) * 255
    outside = flood(pad, (0, 0))[1:-1, 1:-1]
    # 边带：外部区域里贴近主体的像素允许半透明（毛边）；主体内部 alpha=1
    ramp = np.clip((dist - TOL_LO) / (TOL_HI - TOL_LO), 0, 1)
    alpha = np.where(outside, ramp, 1.0)
    # 外部远离主体（8px 外）的半透明杂点压掉，避免底纹噪声
    core = Image.fromarray((~outside).astype("uint8") * 255, "L").filter(ImageFilter.MaxFilter(9))
    near = np.asarray(core) > 0
    alpha = np.where(near, alpha, 0.0)
    # 反混色：c = (p - (1-a)·bg) / a
    a3 = alpha[..., None]
    with np.errstate(divide="ignore", invalid="ignore"):
        unmixed = np.where(a3 > 0.02, (rgb - (1 - a3) * bg) / np.maximum(a3, 1e-6), rgb)
    unmixed = np.clip(unmixed, 0, 255)
    out = np.concatenate([unmixed, alpha[..., None] * 255], axis=2)
    return np.round(out).astype("uint8")


def measure(rgba: np.ndarray, bg: np.ndarray) -> dict:
    a = rgba[..., 3]
    solid = a > 128
    ys, xs = np.where(solid)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # 主体连通域：从质心泛洪
    cx, cy = int(round(xs.mean())), int(round(ys.mean()))
    if not solid[cy, cx]:
        # 质心可能落在空处（蜷睡的环），换成最近的实心像素
        d = (xs - cx) ** 2 + (ys - cy) ** 2
        i = int(np.argmin(d))
        cx, cy = int(xs[i]), int(ys[i])
    main = flood(solid.astype("uint8") * 255, (cx, cy))
    main_d = np.asarray(Image.fromarray(main.astype("uint8") * 255, "L").filter(ImageFilter.MaxFilter(17))) > 0
    specks = int(((a > 8) & ~main_d).sum())
    # 主色：实心且偏橘（H 10–50°）的像素取中位 HSV
    rgb = rgba[..., :3][solid] / 255.0
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in rgb[:: max(1, len(rgb) // 4000)]])
    orange = hsv[(hsv[:, 0] * 360 > 10) & (hsv[:, 0] * 360 < 50) & (hsv[:, 1] > 0.3)]
    h = float(np.median(orange[:, 0]) * 360) if len(orange) else None
    s = float(np.median(orange[:, 1])) if len(orange) else None
    return dict(
        bbox=[int(x0), int(y0), int(x1), int(y1)],
        width=int(x1 - x0), height=int(y1 - y0),
        foot_y=int(y1), area=int(solid.sum()),
        centroid_x=float(xs.mean()),
        hue=h, sat=s, specks=specks,
    )


def process_sheet(path: Path, out_dir: Path, probe: bool) -> dict | None:
    key = next((k for k in ACTIONS if path.name.startswith(k)), None)
    if key is None:
        print(f"跳过（未登记）：{path.name}")
        return None
    meta = ACTIONS[key]
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype("float32")
    bg = border_color(rgb)
    dist_all = np.linalg.norm(rgb - bg, axis=2)
    ring = np.concatenate([dist_all[:12].ravel(), dist_all[-12:].ravel(), dist_all[:, :12].ravel(), dist_all[:, -12:].ravel()])
    fg = dist_all > TOL_HI
    runs = split_columns(fg)
    print(f"{path.name}: 底色 #{int(bg[0]):02X}{int(bg[1]):02X}{int(bg[2]):02X}  边框最大偏差 {ring.max():.1f}  "
          f"P99 {np.percentile(ring, 99):.1f}  分帧 {len(runs)} 段 {runs}")
    expected = meta.get("frame_count", 6)
    if probe or len(runs) != expected:
        if len(runs) != expected:
            print("  !! 不是六段，跳过写文件")
        return None

    frames = []
    for i, (x0, x1) in enumerate(runs):
        rows = np.where(fg[:, x0:x1].any(axis=1))[0]
        y0, y1 = rows.min(), rows.max() + 1
        cx0, cx1 = max(0, x0 - MARGIN), min(rgb.shape[1], x1 + MARGIN)
        cy0, cy1 = max(0, y0 - MARGIN), min(rgb.shape[0], y1 + MARGIN)
        crop = rgb[cy0:cy1, cx0:cx1].copy()
        crop[:, : x0 - cx0] = bg
        crop[:, x1 - cx0 :] = bg
        rgba = cut_frame(crop, bg)
        m = measure(rgba, bg)
        m["anchor_x"] = anchor_x(rgba[..., 3], meta.get("anchor", "centroid"))
        m["sheet_x"] = int(cx0)
        m["sheet_y"] = int(cy0)
        frames.append((rgba, m))

    # 公共画布：脚底对齐到同一行，质心水平居中
    max_w = 2 * max(max(m["anchor_x"] - m["bbox"][0], m["bbox"][2] - m["anchor_x"]) for _, m in frames)
    max_above = max(m["foot_y"] - m["bbox"][1] for _, m in frames)  # 脚底以上高度
    max_below = max(rgba.shape[0] - m["foot_y"] for rgba, m in frames)
    canvas_w = int(max_w + 2 * MARGIN + 8)
    foot_row = int(max_above + MARGIN)
    canvas_h = int(foot_row + max_below + 2)
    action_dir = out_dir / meta["id"]
    action_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for i, (rgba, m) in enumerate(frames, start=1):
        canvas = np.zeros((canvas_h, canvas_w, 4), dtype="uint8")
        dx = int(round(canvas_w / 2 - m["anchor_x"]))
        dy = foot_row - m["foot_y"]
        h, w = rgba.shape[:2]
        ys0, xs0 = max(0, dy), max(0, dx)
        ys1, xs1 = min(canvas_h, dy + h), min(canvas_w, dx + w)
        canvas[ys0:ys1, xs0:xs1] = rgba[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        name = f"{meta['id']}-r-{i:02d}.png"
        Image.fromarray(canvas, "RGBA").save(action_dir / name, optimize=True)
        rec = dict(file=name, **{k: v for k, v in m.items() if k not in ("centroid_x", "anchor_x")})
        rec["bbox"] = [m["bbox"][0] + dx, m["bbox"][1] + dy, m["bbox"][2] + dx, m["bbox"][3] + dy]
        rec["foot_y"] = foot_row
        rec["foot_y_src"] = m["foot_y"] + m["sheet_y"]
        records.append(rec)

    heights = np.array([r["height"] for r in records])
    areas = np.array([r["area"] for r in records])
    return dict(
        id=meta["id"], name=meta["name"], source=path.name,
        fps=meta["fps"], loop=meta["loop"], anchor=meta.get("anchor", "centroid"),
        background=f"#{int(bg[0]):02X}{int(bg[1]):02X}{int(bg[2]):02X}",
        canvas=[canvas_w, canvas_h], foot_row=foot_row,
        height_median=float(np.median(heights)),
        height_spread_pct=float((heights.max() - heights.min()) / heights.max() * 100),
        area_sqrt_median=float(np.median(np.sqrt(areas))),
        foot_y_src_spread=int(max(r["foot_y_src"] for r in records) - min(r["foot_y_src"] for r in records)),
        frames=records,
    )


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet-dir", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--probe", action="store_true")
    args = ap.parse_args()

    results = []
    for path in sorted(args.sheet_dir.glob("*.png")):
        r = process_sheet(path, args.out, args.probe)
        if r:
            results.append(r)
    if args.probe or not results:
        return
    # 统一缩放：以走路帧的 sqrt(面积) 为 1，其它动作按比值缩放（预览后可手改）
    walk = next((r for r in results if r["id"] == "walk"), results[0])
    ref = walk["area_sqrt_median"]
    for r in results:
        r["scale_auto"] = round(ref / r["area_sqrt_median"], 4)
        r["scale"] = r["scale_auto"]
    manifest = dict(
        generated_from="assets/tuanzi/felt-world-pack-v1/actions",
        reference="walk（sqrt 面积中位数 = 1.0）",
        tolerance=[TOL_LO, TOL_HI], margin=MARGIN,
        actions=results,
    )
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print("\n动作 | 帧高中位 | 高度极差% | 脚底源y极差 | sqrt面积 | scale | H° | S | 杂点")
    for r in results:
        hs = [f["hue"] for f in r["frames"] if f["hue"] is not None]
        ss = [f["sat"] for f in r["frames"] if f["sat"] is not None]
        print(f"{r['id']:12s} | {r['height_median']:6.0f} | {r['height_spread_pct']:5.1f} | {r['foot_y_src_spread']:4d} | "
              f"{r['area_sqrt_median']:6.1f} | {r['scale']:.3f} | {min(hs):.1f}–{max(hs):.1f} | {min(ss):.3f}–{max(ss):.3f} | "
              f"{sum(f['specks'] for f in r['frames'])}")


if __name__ == "__main__":
    main()
