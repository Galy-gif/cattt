#!/usr/bin/env python3
"""rig-v1 收图验收：五道关的前四道（清点、哈希、格式、内容指纹），第五道人眼另看。

依据 docs/specs/团子分件动画与场景融合-出图识别接入-2026-09-11.md 第 3 节。
只读交付目录；写 assets/registry/sha256.txt（历史素材哈希库）和 outputs/rig-v1-review/ 下的报告。

用法:
  python3 assets/tools/intake_rig_v1.py [交付目录] [--with-rejected]
  --with-rejected  对 _rejected/ 里的 T 图也做配准和指纹测量（只报告，不改变状态）
"""
import hashlib, json, os, sys, glob
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else ROOT / 'outputs/rig-v1-delivery'
WITH_REJECTED = '--with-rejected' in sys.argv
OUT = ROOT / 'outputs/rig-v1-review'
REFS = ROOT / 'assets/tuanzi/rig-v1/refs'
REGISTRY = ROOT / 'assets/registry/sha256.txt'
HISTORY_DIRS = [ROOT, Path.home() / 'Documents/Codex', Path.home() / 'Documents/ChatGPT/猫/outputs']

IDS = {
    'P00-rest-pose': (1536, 1024), 'P01-head': (1024, 1024), 'P02-ear-near': (1024, 1024),
    'P03-ear-far': (1024, 1024), 'P04-torso': (1536, 1024), 'P05-foreleg-upper': (1024, 1024),
    'P06-foreleg-lower': (1024, 1024), 'P07-hindleg-thigh': (1024, 1024), 'P08-hindleg-lower': (1024, 1024),
    'P09-tail': (1536, 1024), 'T01-nest-crouch': (1536, 1024), 'T02-nest-air': (1536, 1024),
    'T03-nest-grip': (1536, 1024), 'T04-nest-inside': (1536, 1024), 'T05-rail-perch': (1536, 1024),
    'T06-rail-reach': (1536, 1024), 'F01-felt-grain': (1024, 1024),
}
T_REF = {'T01': 'R3-scene-nest', 'T02': 'R3-scene-nest', 'T03': 'R3-scene-nest', 'T04': 'R3-scene-nest',
         'T05': 'R4-scene-fence', 'T06': 'R4-scene-fence'}
T_FACING = {'T01': 'left', 'T02': 'left', 'T03': 'left', 'T04': 'left', 'T05': 'right', 'T06': 'right'}
IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp')
# P00 人工标注（2026-09-11，P00-rest-pose__r1）：身体从臀部 x≈400 到头下 x≈1050，背线 y≈355 到腹线 y≈755
P00_TORSO_ASPECT = 1.62


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


# ---------- 颜色工具 ----------
def srgb_to_lab(rgb):
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def hsv(rgb):
    c = rgb.astype(np.float64) / 255.0
    mx, mn = c.max(-1), c.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    nz = d > 1e-9
    i = nz & (mx == r); h[i] = ((g - b)[i] / d[i]) % 6
    i = nz & (mx == g) & (mx != r); h[i] = (b - r)[i] / d[i] + 2
    i = nz & (mx == b) & (mx != r) & (mx != g); h[i] = (r - g)[i] / d[i] + 4
    s = np.where(mx > 0, d / np.maximum(mx, 1e-9), 0)
    return h * 60, s, mx


# ---------- 蒙版工具 ----------
def magenta_mask(rgb):
    d = np.sqrt(((rgb.astype(np.float64) - [255, 0, 255]) ** 2).sum(-1))
    return d > 90


def erode(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    while px > 0:
        k = min(px, 4)
        im = im.filter(ImageFilter.MinFilter(2 * k + 1)); px -= k
    return np.asarray(im) > 127


def dilate(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    while px > 0:
        k = min(px, 4)
        im = im.filter(ImageFilter.MaxFilter(2 * k + 1)); px -= k
    return np.asarray(im) > 127


def components(mask, min_area=1, step=2):
    """返回各连通块面积（在 step 倍下采样上数，面积折回原尺度）。Pillow 12 泛洪需 frombytes 复制。"""
    m = mask[::step, ::step].astype(np.uint8) * 255
    im = Image.frombytes('L', (m.shape[1], m.shape[0]), m.tobytes())
    areas, boxes = [], []
    arr = np.asarray(im).copy()
    while True:
        ys, xs = np.nonzero(arr == 255)
        if len(ys) == 0:
            break
        work = Image.frombytes('L', (arr.shape[1], arr.shape[0]), arr.tobytes())
        ImageDraw.floodfill(work, (int(xs[0]), int(ys[0])), 128)
        w = np.asarray(work)
        comp = w == 128
        a = int(comp.sum()) * step * step
        if a >= min_area:
            yy, xx = np.nonzero(comp)
            areas.append(a); boxes.append((xx.min() * step, yy.min() * step, xx.max() * step, yy.max() * step))
        arr = np.where(comp, 0, w).astype(np.uint8)
    return areas, boxes


def principal_angle(mask):
    ys, xs = np.nonzero(mask)
    x, y = xs - xs.mean(), ys - ys.mean()
    cov = np.cov(np.stack([x, y]))
    w, v = np.linalg.eigh(cov)
    ax = v[:, np.argmax(w)]
    ang = np.degrees(np.arctan2(ax[1], ax[0])) % 180  # 0 = 水平, 90 = 竖直
    return ang


def edge_outline_share(rgb, mask, side, central=0.6, depth=6, band_center=None):
    """从 side 方向看进去，每条扫描线第一个前景像素往里 depth 像素内有无深棕描边。返回有描边的扫描线占比。"""
    L = srgb_to_lab(rgb)[..., 0]
    dark = (L < 40) & mask
    ys, xs = np.nonzero(mask)
    if side in ('top', 'bottom'):
        lo, hi = xs.min(), xs.max()
    else:
        lo, hi = ys.min(), ys.max()
    span = hi - lo
    c = band_center if band_center is not None else (lo + hi) / 2
    a, b = int(c - span * central / 2), int(c + span * central / 2)
    hits = total = 0
    for k in range(max(a, lo), min(b, hi) + 1, 2):
        line = mask[:, k] if side in ('top', 'bottom') else mask[k, :]
        dl = dark[:, k] if side in ('top', 'bottom') else dark[k, :]
        idx = np.nonzero(line)[0]
        if len(idx) == 0:
            continue
        if side in ('top', 'left'):
            s = idx[0]; seg = dl[s:s + depth]
        else:
            s = idx[-1]; seg = dl[max(0, s - depth + 1):s + 1]
        total += 1; hits += bool(seg.any())
    return hits / max(total, 1)


# ---------- 配准 ----------
def _hann(h, w):
    return np.outer(np.hanning(h), np.hanning(w))


def phase_corr(a, b):
    """返回 (dy, dx, peak)：b 平移 (dy,dx) 后与 a 对齐。"""
    win = _hann(*a.shape)
    A = np.fft.fft2((a - a.mean()) * win); B = np.fft.fft2((b - b.mean()) * win)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.fft.ifft2(R).real
    iy, ix = np.unravel_index(np.argmax(r), r.shape)
    peak = r[iy, ix]
    if iy > a.shape[0] // 2: iy -= a.shape[0]
    if ix > a.shape[1] // 2: ix -= a.shape[1]
    return iy, ix, float(peak)


def warp(img, s, ty, tx):
    """把 T 映射回 R 的坐标：A(p) = T(s*(p-c)+c+t)。"""
    w, h = img.size; cx, cy = w / 2, h / 2
    data = (s, 0, -s * cx + cx + tx, 0, s, -s * cy + cy + ty)
    return img.transform(img.size, Image.AFFINE, data, resample=Image.BICUBIC)


def gray(img, f):
    w, h = img.size
    return np.asarray(img.convert('L').resize((w // f, h // f), Image.LANCZOS), dtype=np.float64)


def register(ref, t):
    """粗搜（1/4 尺度，缩放 0.90–1.10）+ 细搜（1/2 尺度）。返回 (s, ty, tx, peak)，代入 warp 可把 t 对齐到 ref。"""
    g4 = gray(ref, 4); best = None
    for s in np.arange(0.90, 1.101, 0.01):
        dy, dx, peak = phase_corr(g4, gray(warp(t, s, 0, 0), 4))
        cand = (float(s), -s * dy * 4, -s * dx * 4, peak)
        if best is None or peak > best[3]:
            best = cand
    g2 = gray(ref, 2); cands = []
    for s in np.arange(best[0] - 0.012, best[0] + 0.0121, 0.003):
        dy, dx, peak = phase_corr(g2, gray(warp(t, s, best[1], best[2]), 2))
        cands.append((float(s), best[1] - s * dy * 2, best[2] - s * dx * 2, peak))
    return max(cands, key=lambda c: c[3])


def block_residual(ref, aligned, exclude, bs=256):
    g1 = np.asarray(ref.convert('L'), dtype=np.float64); g2 = np.asarray(aligned.convert('L'), dtype=np.float64)
    H, W = g1.shape; res = []
    for y in range(0, H - bs + 1, bs // 2):
        for x in range(0, W - bs + 1, bs // 2):
            if exclude[y:y + bs, x:x + bs].mean() > 0.05:
                continue
            a, b = g1[y:y + bs, x:x + bs], g2[y:y + bs, x:x + bs]
            if a.std() < 6:
                continue  # 天空之类的平坦块，相位相关不可靠
            dy, dx, peak = phase_corr(a, b)
            if peak < 0.03:
                continue
            res.append(float(np.hypot(dy, dx)))
    return res


# ---------- 各类检查 ----------
def check_part(pid, rgb):
    r = {}
    mask = magenta_mask(rgb)
    fg = mask.sum()
    r['foreground_share'] = round(float(fg / mask.size), 4)
    areas, boxes = components(mask, min_area=int(fg * 0.005))
    r['components'] = len(areas)
    ys, xs = np.nonzero(mask)
    bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    r['bbox'] = [int(xs.min()), int(ys.min()), int(bw), int(bh)]
    r['aspect_w_h'] = round(float(bw / bh), 3)
    h, s, v = hsv(rgb[mask])
    r['orange_share'] = round(float(((h >= 18) & (h <= 40) & (s >= 0.4)).mean()), 3)
    pink = ((h <= 22) | (h >= 330)) & (s >= 0.12) & (s <= 0.6) & (v >= 0.6)
    r['pink_share'] = round(float(pink.mean()), 3)
    inner = erode(mask, 3)
    corner = rgb[:4, :4].reshape(-1, 3)
    r['corner_rgb'] = corner[0].tolist()
    # 近端关节帽与远端
    side = {'P01': 'bottom', 'P02': 'bottom', 'P03': 'bottom', 'P05': 'top', 'P06': 'top',
            'P07': 'top', 'P08': 'top', 'P09': 'left'}.get(pid[:3])
    if side:
        center = None
        if pid.startswith('P01'):
            # 头的颈帽：取底部 15% 条带的横向质心
            yb = ys.max() - 0.15 * bh
            sel = ys >= yb
            center = float(xs[sel].mean())
            r['cap_outline_share'] = round(edge_outline_share(rgb, inner, 'bottom', central=0.3 * (xs[sel].max() - xs[sel].min()) / bw, band_center=center), 3)
        else:
            if side in ('top', 'bottom'):
                band = (ys <= ys.min() + 0.1 * bh) if side == 'top' else (ys >= ys.max() - 0.1 * bh)
                bx = xs[band]; frac = 0.6 * (bx.max() - bx.min()) / bw
                r['cap_outline_share'] = round(edge_outline_share(rgb, inner, side, central=frac, band_center=(bx.min() + bx.max()) / 2), 3)
            else:
                r['cap_outline_share'] = round(edge_outline_share(rgb, inner, side), 3)
        opp = {'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left'}[side]
        r['distal_outline_share'] = round(edge_outline_share(rgb, inner, opp), 3)
    if pid[:3] in ('P05', 'P06', 'P07', 'P08', 'P09'):
        r['axis_angle_deg'] = round(float(principal_angle(mask)), 1)
    if pid[:3] in ('P05', 'P06', 'P07', 'P08'):
        rows = [y for y in range(int(ys.min() + 0.1 * bh), int(ys.max() - 0.35 * bh)) if mask[y].any()]
        mids = [(np.nonzero(mask[y])[0][0] + np.nonzero(mask[y])[0][-1]) / 2 for y in rows]
        r['shaft_tilt_deg'] = round(float(np.degrees(np.arctan(np.polyfit(rows, mids, 1)[0]))), 2)
    if pid[:3] in ('P06', 'P08'):
        top = xs[ys <= ys.min() + 0.25 * bh]; bot = xs[ys >= ys.max() - 0.25 * bh]
        r['paw_right_protrusion'] = round(float((bot.max() - top.max()) / bw), 3)
    if pid.startswith('P01'):
        L = srgb_to_lab(rgb)[..., 0]
        interior = erode(mask, 20)
        dark = (L < 28) & interior
        a2, b2 = components(dark, min_area=30, step=1)
        dots = []
        for a, (x0, y0, x1, y1) in zip(a2, b2):
            w_, h_ = x1 - x0 + 1, y1 - y0 + 1
            if max(w_, h_) < 0.12 * bw and 0.5 < w_ / h_ < 2 and a / (w_ * h_) > 0.45:
                dots.append([int(x0), int(y0), int(w_), int(h_)])
        r['eye_like_dots'] = dots
    if pid.startswith('P09'):
        L = srgb_to_lab(rgb)[..., 0]
        cy = ys.mean(); th = bh
        band = mask[int(cy - th * 0.15):int(cy + th * 0.15)]
        Lb = L[int(cy - th * 0.15):int(cy + th * 0.15)]
        prof = np.array([Lb[:, x][band[:, x]].mean() if band[:, x].any() else np.nan for x in range(rgb.shape[1])])
        valid = ~np.isnan(prof)
        p = prof[valid]
        k = 15; p = np.convolve(p, np.ones(k) / k, mode='same')
        thr = p.mean() - 0.5 * p.std()
        below = p < thr
        runs = 0; run = 0
        for bflag in below:
            run = run + 1 if bflag else 0
            if run == 8: runs += 1
        r['ring_count'] = runs
    return r


def part_verdict(pid, r):
    fails = []
    if r['components'] != 1: fails.append(f"连通块 {r['components']} ≠ 1")
    need = 0.55 if pid.startswith('P02') else 0.70
    if r['orange_share'] < need: fails.append(f"橙色占比 {r['orange_share']} < {need}")
    if 'cap_outline_share' in r and r['cap_outline_share'] > 0.10: fails.append(f"关节帽描边占比 {r['cap_outline_share']} > 0.10")
    a = r['aspect_w_h']
    if pid.startswith('P01') and not (0.95 <= a <= 1.3): fails.append(f"宽高比 {a} 不在 0.95–1.3")
    if pid.startswith('P01') and r.get('eye_like_dots'): fails.append(f"头上仍有疑似眼睛圆点 {len(r['eye_like_dots'])} 个")
    if pid.startswith('P02') and r['pink_share'] < 0.15: fails.append(f"粉色占比 {r['pink_share']} < 0.15")
    if pid.startswith('P03') and r['pink_share'] > 0.05: fails.append(f"粉色占比 {r['pink_share']} > 0.05")
    if pid.startswith('P04') and abs(a / P00_TORSO_ASPECT - 1) > 0.10: fails.append(f"宽高比 {a} 与 P00 身体 {P00_TORSO_ASPECT} 相差超过 10%")
    if pid[:3] in ('P05', 'P06', 'P07', 'P08'):
        if abs(r['shaft_tilt_deg']) > 5: fails.append(f"腿干偏离竖直 {abs(r['shaft_tilt_deg']):.1f}° > 5°")
        if not (0.25 <= a <= 0.7): fails.append(f"宽高比 {a} 不在 0.25–0.7")
    if pid[:3] in ('P06', 'P08') and r['paw_right_protrusion'] <= 0.05: fails.append("爪子没有朝右凸出")
    if pid.startswith('P09'):
        ang = min(r['axis_angle_deg'], 180 - r['axis_angle_deg'])
        if ang > 5: fails.append(f"主轴偏离水平 {ang:.1f}° > 5°")
        if a < 3.5: fails.append(f"长宽比 {a} < 3.5")
        if r['ring_count'] < 3: fails.append(f"环纹 {r['ring_count']} 圈 < 3")
    return fails


def check_felt(rgb):
    h, s, v = hsv(rgb)
    g = np.asarray(Image.fromarray(rgb).convert('L'), dtype=np.float64)
    n = 128
    corners = [g[:n, :n], g[:n, -n:], g[-n:, :n], g[-n:, -n:]]
    c = g[g.shape[0] // 2 - n // 2:g.shape[0] // 2 + n // 2, g.shape[1] // 2 - n // 2:g.shape[1] // 2 + n // 2]
    r = {'mean_saturation': round(float(s.mean()), 4), 'luma_std': round(float(g.std()), 2),
         'corner_center_diff': round(float(max(abs(k.mean() - c.mean()) for k in corners)), 2)}
    fails = []
    if r['mean_saturation'] > 0.08: fails.append('饱和度过高')
    if not (6 <= r['luma_std'] <= 20): fails.append(f"明度标准差 {r['luma_std']} 不在 6–20")
    if r['corner_center_diff'] > 5: fails.append(f"四角与中心差 {r['corner_center_diff']} > 5")
    return r, fails


def check_scene(tid, path):
    ref = Image.open(REFS / f"{T_REF[tid[:3]]}.png").convert('RGB')
    t = Image.open(path).convert('RGB')
    s, ty, tx, peak = register(ref, t)
    al = warp(t, s, ty, tx)
    A = np.asarray(al); Rr = np.asarray(ref)
    dE = np.sqrt(((srgb_to_lab(A) - srgb_to_lab(Rr)) ** 2).sum(-1))
    h, sat, v = hsv(A)
    catlike = (h >= 15) & (h <= 42) & (sat >= 0.6) & (v >= 0.72) & (dE > 25)
    areas, boxes = components(catlike, min_area=2000)
    cat = np.zeros_like(catlike)
    catbox = None
    if areas:
        i = int(np.argmax(areas)); x0, y0, x1, y1 = boxes[i]; catbox = [x0, y0, x1 - x0, y1 - y0]
        cat[y0:y1 + 1, x0:x1 + 1] = True
    excl = dilate(cat, 40)
    valid = np.ones_like(excl); m = 24; valid[:m] = valid[-m:] = False; valid[:, :m] = valid[:, -m:] = False
    outside = (~excl) & valid
    res = block_residual(ref, al, excl)
    r = {'scale': round(s, 4), 'shift_xy': [round(tx, 1), round(ty, 1)], 'peak': round(peak, 3),
         'block_residual_px_median': round(float(np.median(res)), 2) if res else None,
         'block_residual_px_p90': round(float(np.percentile(res, 90)), 2) if res else None,
         'blocks': len(res),
         'deltaE_outside_cat_median': round(float(np.median(dE[outside])), 2),
         'cat_bbox_ref_px': catbox}
    fails = []
    if r['block_residual_px_median'] is None or r['block_residual_px_median'] > 6: fails.append(f"配准残差中位数 {r['block_residual_px_median']} > 6px")
    if r['deltaE_outside_cat_median'] > 8: fails.append(f"猫外场景 ΔE 中位数 {r['deltaE_outside_cat_median']} > 8")
    OUT.mkdir(parents=True, exist_ok=True)
    stem = Path(path).stem
    al.save(OUT / f"{stem}__aligned.png")
    diff = np.clip(dE * 4, 0, 255).astype(np.uint8)
    Image.fromarray(diff).save(OUT / f"{stem}__deltaE.png")
    return r, fails


# ---------- 历史哈希库 ----------
def build_registry():
    seen = {}
    for base in HISTORY_DIRS:
        if not base.exists():
            continue
        for dp, dn, fn in os.walk(base):
            dn[:] = [d for d in dn if d not in ('.git', 'DerivedData', 'build') and not (Path(dp) / d).resolve().is_relative_to(DELIVERY.resolve())]
            for f in fn:
                if f.lower().endswith(IMG_EXT):
                    p = Path(dp) / f
                    try:
                        seen.setdefault(sha256(p), str(p))
                    except OSError:
                        pass
    REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY, 'w') as fh:
        fh.write('# 历史素材 SHA-256 库。由 assets/tools/intake_rig_v1.py 生成；收图时新文件撞上任何一行即判为拿旧图顶替。\n')
        for k, v in sorted(seen.items(), key=lambda kv: kv[1]):
            fh.write(f"{k}  {v}\n")
    return seen


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {'delivery': str(DELIVERY), 'gates': {}, 'items': {}}
    man = json.load(open(DELIVERY / 'delivery.json'))
    items = {it['id']: it for it in man['items']}

    # 第一关：清点
    g1 = []
    for pid in IDS:
        if pid not in items: g1.append(f"{pid}: 清单缺条目")
    for pid in items:
        if pid not in IDS: g1.append(f"{pid}: 清单多出未知编号")
    listed = {items[p]['file'] for p in items if items[p].get('file')}
    on_disk = {str(p.relative_to(DELIVERY)) for p in DELIVERY.rglob('*.png') if '_rejected' not in p.parts}
    for f in sorted(on_disk - listed): g1.append(f"多出文件 {f}")
    for f in sorted(listed - on_disk): g1.append(f"清单文件不存在 {f}")
    for pid, it in items.items():
        if it.get('status') not in ('new', 'failed', 'skipped'): g1.append(f"{pid}: 非法状态 {it.get('status')}")
    report['gates']['1_inventory'] = g1

    # 第二关：哈希
    registry = build_registry()
    g2 = []; batch = {}
    for pid, it in items.items():
        if it.get('status') != 'new': continue
        p = DELIVERY / it['file']; hsh = sha256(p)
        if it.get('sha256') and it['sha256'] != hsh: g2.append(f"{pid}: 清单哈希与文件不符")
        if hsh in registry: g2.append(f"{pid}: 与历史素材重复 {registry[hsh]}")
        if hsh in batch: g2.append(f"{pid}: 与本批 {batch[hsh]} 重复")
        batch[hsh] = pid
    report['gates']['2_hash'] = g2
    report['registry_count'] = len(registry)

    # 第三、四关
    for pid, (w, h) in IDS.items():
        it = items.get(pid, {}); entry = {'status': it.get('status'), 'format': [], 'fingerprint': {}, 'fails': []}
        report['items'][pid] = entry
        if it.get('status') != 'new':
            continue
        im = Image.open(DELIVERY / it['file'])
        if im.size != (w, h): entry['format'].append(f"画布 {im.size} ≠ {(w, h)}")
        rgb = np.asarray(im.convert('RGB'))
        if pid.startswith('P'):
            if im.mode == 'RGBA' and np.asarray(im)[..., 3].min() < 255:
                bg = 'transparent'
            else:
                c = [rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]]
                bg = 'magenta' if all((abs(int(x[0]) - 255) < 3 and x[1] < 3 and abs(int(x[2]) - 255) < 3) for x in c) else 'unknown'
            entry['background'] = bg
            if bg == 'unknown': entry['format'].append('背景既不是真透明也不是纯 #FF00FF')
            fp = check_part(pid, rgb); entry['fingerprint'] = fp; entry['fails'] = part_verdict(pid, fp)
        elif pid.startswith('F'):
            fp, fails = check_felt(rgb); entry['fingerprint'] = fp; entry['fails'] = fails
        elif pid.startswith('T'):
            fp, fails = check_scene(pid, DELIVERY / it['file']); entry['fingerprint'] = fp; entry['fails'] = fails

    if WITH_REJECTED:
        report['rejected_T'] = {}
        for p in sorted((DELIVERY / '_rejected').glob('T*.png')):
            fp, fails = check_scene(p.name[:3], p)
            report['rejected_T'][p.name] = {'fingerprint': fp, 'fails': fails}

    json.dump(report, open(OUT / 'intake-report.json', 'w'), indent=1, ensure_ascii=False, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    print(json.dumps(report, indent=1, ensure_ascii=False, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o)))


if __name__ == '__main__':
    main()
