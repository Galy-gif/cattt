#!/usr/bin/env python3
"""frames-v5 切帧打包：去底 → 调色到保留的侧面走 → 描边柔化 → 按张统一到 40pt 头宽 → 按接触点放进各动作的公共画布 → 写资源与动作目录。

依据 docs/方案/逐帧v5-出图与播放规则-方案-2026-09-11.md 与 outputs/frames-v5-review/验收报告.md。
只读 outputs/frames-v5-delivery/ 与验收数值；写 ios/Maomao/Assets.xcassets/world-v5/、动作目录 cat-actions-v2，
以及 Resources/WorldTextures 下的绳子与绳结贴图。可重复运行，结果确定。

画布约定与 v4 相同：锚点在画布水平中线、距顶 footY 处；朝左时整张图绕中线镜像。
坐标一律是"画面坐标"：x 向右为猫的前方（素材都朝右画），y 向下。单位 pt，导出 3 倍像素。
"""
import importlib.util, json, sys, glob
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('rig', ROOT / 'assets/tools/intake_rig_v1.py')
rig = importlib.util.module_from_spec(_spec); _argv = sys.argv; sys.argv = [sys.argv[0]]; _spec.loader.exec_module(rig); sys.argv = _argv

DELIVERY = ROOT / 'outputs/frames-v5-delivery'
REPORT = ROOT / 'outputs/frames-v5-review/intake-report.json'
XC = ROOT / 'ios/Maomao/Assets.xcassets/world-v5'
CATALOG = ROOT / 'ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json'
TEX = ROOT / 'ios/Maomao/Resources/WorldTextures'
LOG = ROOT / 'outputs/frames-v5-review/package.json'

HEAD_PT = 40.0     # 所有动作统一的头宽
PX = 3             # 导出像素 / pt
FLOOR_D = 12.0     # 窝里：猫的底部比抓沿点低多少 pt
INSIDE_FWD = 22.0  # 窝里：猫的中心在抓沿点前方多少 pt（进窝时朝左，所以是世界里的左边）
CELL = 512

# 人工标注的接触点（猫自身包围盒内的像素坐标，源图尺度）。标注图见 outputs/frames-v5-review/annot-*.png。
MANUAL = {
    ('N2-jump', 5): (360, 178),    # 前爪钩在窝沿上
    ('N2-jump', 6): (372, 198),
    ('N3-climb', 2): (318, 236),   # 前臂压在窝沿上
    ('N3-climb', 3): (300, 247),
    ('N3-climb', 4): (250, 224),   # 肚子趴在窝沿上，窝沿在胸口下方
    ('N3-climb', 5): (215, 231),   # 蹲在窝沿上
    ('N3-climb', 6): (105, 290),   # 后脚还在窝沿上，身体往窝里下去
    ('N7-out', 4): (45, 345),      # 后脚在窝沿上，探身往外
    ('N7-out', 5): (95, 310),      # 后脚蹬窝沿
}

# 动作表：(动作 id, [(张, 格, 接触方式, 目标位置 pt)], 每帧时长, 循环方式)
# 接触方式：hind 后脚（旧规则，v5 原样保留）、hindStable 后脚（低头也稳，见 contact）、front 前爪、bottom 底部中心、manual 人工标注、centroid 重心（腾空帧）
ORIGIN = (0.0, 0.0)
INSIDE_L = (INSIDE_FWD, FLOOR_D)      # 朝左进窝时的窝里位置（画面坐标的前方 = 世界左）
INSIDE_R = (-INSIDE_FWD, FLOOR_D)     # 朝右出窝时，同一个世界位置在画面坐标里是后方
ACTIONS = [
    ('v5Prepare', [('N1-prepare', k, 'hind', ORIGIN) for k in range(1, 7)] + [('N2-jump', 2, 'hind', ORIGIN)],
     [0.16, 0.10, 0.10, 0.10, 0.12, 0.12, 0.08], 'once'),
    ('v5Air', [('N2-jump', 3, 'centroid', ORIGIN), ('N2-jump', 4, 'centroid', ORIGIN)], [0.12, 0.13], 'once'),
    # 挂在窝外、爬上窝沿、蹲在窝沿上：都在整个窝前面画
    ('v5Grip', [('N2-jump', 5, 'manual', ORIGIN), ('N2-jump', 6, 'manual', ORIGIN), ('N3-climb', 2, 'manual', ORIGIN),
                ('N3-climb', 3, 'manual', ORIGIN), ('N3-climb', 4, 'manual', ORIGIN), ('N3-climb', 5, 'manual', ORIGIN)],
     [0.10, 0.14, 0.12, 0.12, 0.12, 0.12], 'once'),
    # 往窝里下去之后在窝壁后面。N4 第 3、4 格是坐直的，比这个小窝高，耳朵会冒出窝顶，不用。
    ('v5Enter', [('N3-climb', 6, 'manual', ORIGIN), ('N4-settle', 2, 'bottom', INSIDE_L), ('N4-settle', 5, 'bottom', INSIDE_L)],
     [0.12, 0.16, 0.30], 'once'),
    ('v5Look', [('N5-look', k, 'bottom', INSIDE_L) for k in range(1, 7)], [1.60, 0.10, 0.14, 0.90, 1.00, 0.80], 'loop'),
    ('v5Sleep', [('N6-sleep', k, 'bottom', INSIDE_L) for k in range(1, 7)], [0.50, 0.45, 0.50, 0.40, 0.45, 0.40], 'loop'),
    # 在窝里站起来（窝壁后面），然后站上窝沿、探身、蹬出（窝前面）
    # 第 1 格（趴在窝里、朝着观众）原来没用，出窝只有一格，读起来是"直接跳上窝沿"（v5 实施记录的遗留）。
    ('v5Out', [('N7-out', 1, 'bottom', INSIDE_R), ('N7-out', 2, 'bottom', INSIDE_R)], [0.20, 0.16], 'once'),
    ('v5Leap', [('N7-out', 3, 'bottom', ORIGIN), ('N7-out', 4, 'manual', ORIGIN), ('N7-out', 5, 'manual', ORIGIN)],
     [0.20, 0.18, 0.12], 'once'),
    ('v5Fall', [('N7-out', 6, 'centroid', ORIGIN), ('N8-land', 1, 'centroid', ORIGIN)], [0.14, 0.14], 'once'),
    ('v5Land', [('N8-land', k, 'front', ORIGIN) for k in range(2, 7)], [0.08, 0.08, 0.10, 0.10, 0.12], 'once'),
    ('walkToward', [('W1-walk-toward', k, 'walk', ORIGIN) for k in range(1, 7)], None, 'loop'),
    ('walkAway', [('W2-walk-away', k, 'walk', ORIGIN) for k in range(1, 7)], None, 'loop'),
    ('turn', [('W3-turn', k, 'walk', ORIGIN) for k in range(1, 7)], [0.06, 0.06, 0.08, 0.07, 0.07, 0.06], 'once'),
]
# 腾空动作：弧线起止处重心相对"支撑锚点"的偏移，由这两帧推出（画面坐标 pt）
AIR = {'v5Air': (('N2-jump', 2, 'hind'), ('N2-jump', 5, 'manual')),
       'v5Fall': (('N7-out', 5, 'manual'), ('N8-land', 2, 'front'))}


# ---------- 颜色 ----------
def lab2rgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    def finv(t): return np.where(t ** 3 > 216 / 24389, t ** 3, (116 * t - 16) / (24389 / 27))
    xyz = np.stack([finv(fx) * 0.95047, finv(fy), finv(fz) * 1.08883], -1)
    M = np.linalg.inv(np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]))
    c = xyz @ M.T; c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
    return np.clip(c * 255, 0, 255)


def target_stats():
    """目标：运行时保留的侧面走路 6 帧。"""
    px = []
    for i in range(1, 7):
        g = [p for p in glob.glob(str(ROOT / f'ios/Maomao/Assets.xcassets/**/cat-walk-0{i}.imageset/*.png'), recursive=True) if '@3x' in p][0]
        a = np.asarray(Image.open(g).convert('RGBA')); m = a[..., 3] > 200
        px.append(rig.srgb_to_lab(a[..., :3])[m])
    px = np.concatenate(px)
    return px.mean(0), px.std(0)


# ---------- 切猫 ----------
def cell_bg(rgb, box):
    x0, y0 = (box[0] // CELL) * CELL, (box[1] // CELL) * CELL
    c = rgb[y0:y0 + CELL, x0:x0 + CELL]
    border = np.concatenate([c[:6].reshape(-1, 3), c[-6:].reshape(-1, 3), c[:, :6].reshape(-1, 3), c[:, -6:].reshape(-1, 3)])
    return np.median(border.astype(float), 0)


def load_sheet(sid):
    rgb = np.asarray(Image.open(DELIVERY / f'{sid}/{sid}__r1.png').convert('RGB')).astype(float)
    # 硬蒙版只用来分猫；每只猫的软 alpha 用它所在格的背景色单独算
    border_bg = np.median(np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3)]), 0)
    hard = np.sqrt(((rgb - border_bg) ** 2).sum(-1)) > 80
    cats = []
    for m, box in split_cats(hard):
        bg = cell_bg(rgb, box)
        x0, y0, x1, y1 = box; pad = 6
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad); x1, y1 = min(rgb.shape[1] - 1, x1 + pad), min(rgb.shape[0] - 1, y1 + pad)
        sub = rgb[y0:y1 + 1, x0:x1 + 1]
        own = rig.dilate(m[y0:y1 + 1, x0:x1 + 1], 3)
        d = np.sqrt(((sub - bg) ** 2).sum(-1))
        alpha = np.clip((d - 35) / 75, 0, 1) * own
        fg = (sub - (1 - alpha)[..., None] * bg) / np.maximum(alpha, 0.05)[..., None]
        cats.append({'rgb': np.clip(fg, 0, 255), 'alpha': alpha, 'hard': m[y0:y1 + 1, x0:x1 + 1], 'origin': (x0, y0)})
    return cats


def split_cats(full):
    step = 2
    small = (full[::step, ::step] * 255).astype(np.uint8)
    arr = np.asarray(Image.frombytes('L', (small.shape[1], small.shape[0]), small.tobytes())).copy()
    from PIL import ImageDraw
    comps = []
    while True:
        ys, xs = np.nonzero(arr == 255)
        if len(ys) == 0: break
        work = Image.frombytes('L', (arr.shape[1], arr.shape[0]), arr.tobytes())
        ImageDraw.floodfill(work, (int(xs[0]), int(ys[0])), 128)
        w = np.asarray(work); c = w == 128
        comps.append(c); arr = np.where(c, 0, w).astype(np.uint8)
    big = max(c.sum() for c in comps)
    cats = [c for c in comps if c.sum() >= 0.02 * big]
    crumbs = [c for c in comps if c.sum() < 0.02 * big]
    cents = [np.array(np.nonzero(c)).mean(1) for c in cats]
    for cr in crumbs:
        p = np.array(np.nonzero(cr)).mean(1)
        i = int(np.argmin([np.hypot(*(p - q)) for q in cents])); cats[i] = cats[i] | cr
    order = sorted(range(len(cats)), key=lambda i: int(cents[i][0] * step // CELL) * 3 + int(cents[i][1] * step // CELL))
    out = []
    for i in order:
        m = np.asarray(Image.fromarray(cats[i].astype(np.uint8) * 255).resize((full.shape[1], full.shape[0]), Image.NEAREST)) > 127
        m &= full
        ys, xs = np.nonzero(m)
        out.append((m, (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))))
    assert len(out) == 6, f'split into {len(out)} cats'
    return out


def grade(cat, src, tgt):
    (ms, ss), (mt, st) = src, tgt
    lab = rig.srgb_to_lab(cat['rgb'])
    lab = (lab - ms) / ss * st + mt
    hard = cat['hard']
    ring = hard & ~rig.erode(hard, 7)
    L = lab[..., 0]; lift = ring & (L < 50); L[lift] = 50 + (L[lift] - 50) * 0.45; lab[..., 0] = L
    lab[ring, 1] *= 0.85
    rgb = lab2rgb(lab)
    edge = (cat['alpha'] > 0) & ~rig.erode(hard, 2)
    rgb[edge, 2] = np.minimum(rgb[edge, 2], rgb[edge, 1] * 0.9)   # 压掉偏紫的毛边
    a = Image.fromarray((cat['alpha'] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    return rgb, np.asarray(a).astype(float) / 255


# ---------- 接触点（猫包围盒内像素，源图尺度） ----------
def ground_runs(hard):
    ys, xs = np.nonzero(hard); ymax = ys.max()
    band = hard[max(0, ymax - 8):ymax + 1].any(0)
    runs, start = [], None
    for x, v in enumerate(band):
        if v and start is None: start = x
        if not v and start is not None: runs.append((start, x - 1)); start = None
    if start is not None: runs.append((start, len(band) - 1))
    runs = [r for r in runs if r[1] - r[0] >= 6]
    return runs, ymax


def rear_ground_runs(hard, rear=0.40):
    """只看轮廓后 40% 横向范围里的最低行，再在那一行附近取着地段。

    `ground_runs` 从**整只猫的最低行**往上取 8px 的带。低头喝水这种姿势下巴比后脚低，
    后脚会掉出这条带，`runs[0]` 就换成了前面的接触段，锚点在帧之间来回跳 43pt
    （原文 2026-09-27 从当前版本删除，原件在 git 历史）。
    """
    ys, xs = np.nonzero(hard)
    cut = xs.min() + rear * (xs.max() - xs.min())
    ymax = int(ys[xs <= cut].max())
    band = hard[max(0, ymax - 8):ymax + 1].any(0)
    runs, start = [], None
    for x, v in enumerate(band):
        if v and start is None: start = x
        if not v and start is not None: runs.append((start, x - 1)); start = None
    if start is not None: runs.append((start, len(band) - 1))
    runs = [r for r in runs if r[1] - r[0] >= 6]
    return runs, ymax


def contact(cat, kind, key):
    hard = cat['hard']; ox, oy = cat['origin']
    ys, xs = np.nonzero(hard)
    if kind == 'manual':
        # 标注坐标相对"猫的连通块包围盒"，这里的蒙版多留了 pad 像素的边
        bx, by = MANUAL[key]; gx0, gy0 = xs.min(), ys.min()
        return bx + gx0, by + gy0
    if kind == 'centroid': return xs.mean(), ys.mean()
    if kind == 'hindStable':
        # 低头 / 趴姿也稳的后脚着地点。`hind` 是 v5 原样保留的旧规则（那一轮已验收，不动）。
        runs, ymax = rear_ground_runs(hard)
        r = runs[0]; return (r[0] + r[1]) / 2, ymax
    runs, ymax = ground_runs(hard)
    if kind == 'hind': r = runs[0]; return (r[0] + r[1]) / 2, ymax
    if kind == 'front': r = runs[-1]; return (r[0] + r[1]) / 2, ymax
    if kind in ('bottom', 'walk'):
        if kind == 'walk': return xs.mean(), ymax
        sel = ys >= ymax - 6
        return xs[sel].mean(), ymax
    raise ValueError(kind)


def premul_resize(rgb, alpha, scale):
    h, w = alpha.shape
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    pm = np.dstack([rgb * alpha[..., None], alpha * 255]).astype(np.float32)
    chans = [np.asarray(Image.fromarray(pm[..., i]).resize(size, Image.LANCZOS)) for i in range(4)]
    a = np.clip(chans[3], 0, 255) / 255
    rgb2 = np.dstack([c for c in chans[:3]]) / np.maximum(a, 1e-3)[..., None]
    return np.clip(rgb2, 0, 255), np.clip(a, 0, 1)


def main():
    report = json.load(open(REPORT))
    head = report['head_width_est']
    tgt = target_stats()
    sheets = {}
    needed = sorted({s for _, frames, _, _ in ACTIONS for s, _, _, _ in frames} | {s for a in AIR.values() for s, _, _ in a})
    for sid in needed:
        cats = load_sheet(sid)
        src_px = np.concatenate([rig.srgb_to_lab(c['rgb'])[rig.erode(c['hard'], 2)] for c in cats])
        src = (src_px.mean(0), src_px.std(0))
        sheets[sid] = {'cats': cats, 'src': src, 'scale': HEAD_PT * PX / head[sid]}

    def frame(sid, k, kind):
        c = sheets[sid]['cats'][k - 1]; s = sheets[sid]['scale']
        if 'graded' not in c:
            c['graded'] = premul_resize(*grade(c, sheets[sid]['src'], tgt), s)
        cx, cy = contact(c, kind, (sid, k))
        return c['graded'], (cx * s / PX, cy * s / PX), s   # 接触点换成 pt

    # 着地帧的锚点修正：蓄力段钉后脚、落地段钉前爪，但让第一 / 最后一帧的锚点落在四脚中心，和走路衔接
    def offset_for(sid, k, kind):
        if kind == 'hind':
            _, hind, _ = frame('N1-prepare', 1, 'hind'); _, mid, _ = frame('N1-prepare', 1, 'bottom')
            return mid[0] - hind[0]
        if kind == 'front':
            _, fr, _ = frame('N8-land', 6, 'front'); _, mid, _ = frame('N8-land', 6, 'bottom')
            return mid[0] - fr[0]
        return 0.0

    catalog = json.load(open(CATALOG))
    specs = catalog['actions']
    log = {}
    info = {'author': 'xcode', 'version': 1}
    # world-v5 目录完全由本脚本生成：先清空，免得帧数变少时留下旧帧
    import shutil
    if XC.exists(): shutil.rmtree(XC)
    XC.mkdir(parents=True, exist_ok=True)
    json.dump({'info': info}, open(XC / 'Contents.json', 'w'), indent=2)
    for aid, frames, durations, loop in ACTIONS:
        placed = []
        for sid, k, kind, target in frames:
            (rgb, a), (cx, cy), s = frame(sid, k, kind)
            ax = cx + offset_for(sid, k, kind)
            # 这一帧左上角相对锚点的位置（pt）
            left, top = target[0] - ax, target[1] - cy
            placed.append((rgb, a, left, top, a.shape[1] / PX, a.shape[0] / PX, (sid, k, kind)))
        half = max(max(-p[2], p[2] + p[4]) for p in placed) + 4
        top = min(p[3] for p in placed) - 4; bottom = max(p[3] + p[5] for p in placed) + 4
        cw, ch = float(np.ceil(half * 2)), float(np.ceil(bottom - top)); foot = float(-top)
        W, H = int(round(cw * PX)), int(round(ch * PX))
        for i, (rgb, a, left, t, w, h, src) in enumerate(placed, 1):
            canvas = np.zeros((H, W, 4), np.float32)
            x0 = int(round((cw / 2 + left) * PX)); y0 = int(round((foot + t) * PX))
            hh, ww = a.shape
            canvas[y0:y0 + hh, x0:x0 + ww, :3] = rgb; canvas[y0:y0 + hh, x0:x0 + ww, 3] = a * 255
            name = f'cat-v5-{aid}-{i:02d}'
            d = XC / f'{name}.imageset'; d.mkdir(parents=True, exist_ok=True)
            Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), 'RGBA').save(d / 'image.png', optimize=True)
            json.dump({'images': [{'idiom': 'universal', 'filename': 'image.png'}], 'info': info}, open(d / 'Contents.json', 'w'), indent=2)
        old = next((x for x in specs if x['id'] == aid), None)
        spec = {'id': aid, 'name': aid, 'frameCount': len(placed), 'fps': 8 if loop == 'loop' and durations is None else 12, 'loop': loop,
                'size': [cw, ch], 'footY': round(foot, 2), 'bodyLength': (old or {}).get('bodyLength', 100.9),
                'hitInset': (old or {}).get('hitInset', 5), 'imagePrefix': 'cat-v5'}
        if old and 'stride' in old: spec['stride'] = old['stride']
        if durations: spec['frameDurations'] = durations
        if aid in AIR:
            (sa, ka, kinda), (sb, kb, kindb) = AIR[aid]
            (ra, aa), ca, _ = frame(sa, ka, kinda); (rb, ab), cb, _ = frame(sb, kb, kindb)
            ga = centroid_pt(aa); gb = centroid_pt(ab)
            spec['airFrom'] = [round(ga[0] - ca[0] - offset_for(sa, ka, kinda), 2), round(ga[1] - ca[1], 2)]
            spec['airTo'] = [round(gb[0] - cb[0] - offset_for(sb, kb, kindb), 2), round(gb[1] - cb[1], 2)]
        specs = [x for x in specs if x['id'] != aid] + [spec]
        log[aid] = {'size': [cw, ch], 'footY': foot, 'frames': [f'{s}#{k} {kind}' for s, k, kind, _ in frames],
                    **({'airFrom': spec['airFrom'], 'airTo': spec['airTo']} if aid in AIR else {})}
        print(aid, spec['size'], 'footY', spec['footY'], spec.get('airFrom', ''), spec.get('airTo', ''))
    catalog['actions'] = specs
    json.dump(catalog, open(CATALOG, 'w'), indent=2, ensure_ascii=False, sort_keys=True)
    rope_textures()
    felt_grain()
    json.dump(log, open(LOG, 'w'), indent=1, ensure_ascii=False)


def centroid_pt(alpha):
    ys, xs = np.nonzero(alpha > 0.5)
    return xs.mean() / PX, ys.mean() / PX


def rope_textures():
    """K1 竖向平铺成吊绳；从吊窝贴图裁下窝顶绳结，盖在树枝绳圈的切口上。"""
    k = np.asarray(Image.open(DELIVERY / 'K1-rope/K1-rope__r1.png').convert('RGB')).astype(float)
    bg = np.median(np.concatenate([k[:, :8].reshape(-1, 3), k[:, -8:].reshape(-1, 3)]), 0)
    d = np.sqrt(((k - bg) ** 2).sum(-1)); a = np.clip((d - 35) / 75, 0, 1)
    fg = (k - (1 - a)[..., None] * bg) / np.maximum(a, 0.05)[..., None]
    xs = np.nonzero(a.max(0) > 0.5)[0]; x0, x1 = xs.min() - 4, xs.max() + 4
    strip = np.dstack([np.clip(fg, 0, 255), a * 255])[:, x0:x1 + 1]
    tile = Image.fromarray(strip.astype(np.uint8), 'RGBA')
    # 调到吊窝绳子的颜色：用窝顶绳圈的 Lab 均值 / 方差
    nest = np.asarray(Image.open(TEX / 'world-v4-nest.png').convert('RGBA')).astype(float)
    loop = nest[0:180, 250:530]; lm = loop[..., 3] > 200
    lt = rig.srgb_to_lab(loop[..., :3])[lm]
    tr = np.asarray(tile).astype(float); tm = tr[..., 3] > 200
    ls = rig.srgb_to_lab(tr[..., :3])
    ls = (ls - ls[tm].mean(0)) / ls[tm].std(0) * lt.std(0) + lt.mean(0)
    tr[..., :3] = lab2rgb(ls)
    tile = Image.fromarray(np.clip(tr, 0, 255).astype(np.uint8), 'RGBA')
    # 世界里绳宽约 26px、长约 250px；按 2 倍存
    w = 52; scale = w / tile.size[0]; tile = tile.resize((w, round(tile.size[1] * scale)), Image.LANCZOS)
    rope = Image.new('RGBA', (w, 520))
    y = 0
    while y < 520: rope.paste(tile, (0, y)); y += tile.size[1]
    rope.save(TEX / 'world-v5-rope.png', optimize=True)
    knot = Image.fromarray(nest.astype(np.uint8), 'RGBA').crop((320, 168, 466, 250))
    knot.save(TEX / 'world-v5-rope-knot.png', optimize=True)
    print('rope', rope.size, 'knot', knot.size)


def felt_grain():
    """rig-v1 的 F01 → 去色、均值拉到中灰 128（柔光下中灰不改变底色）、做成四边无缝，缩到 512。"""
    src = np.asarray(Image.open(ROOT / 'outputs/rig-v1-delivery/F01-felt-grain/F01-felt-grain__r1.png').convert('L')).astype(float)
    g = (src - src.mean()) / src.std() * 20 + 128
    n = g.shape[0]; rolled = np.roll(np.roll(g, n // 2, 0), n // 2, 1)
    # 离边越近越用错位半幅的那张，接缝处两张各取一半，四边就连得上
    t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)
    w = np.clip(np.minimum.outer(t, t) * 3, 0, 1)
    tile = g * w + rolled * (1 - w)
    tile = (tile - tile.mean()) / tile.std() * 20 + 128
    im = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
    im.convert('RGB').save(TEX / 'world-v5-felt-grain.png', optimize=True)
    print('felt grain', im.size)


if __name__ == '__main__':
    main()
