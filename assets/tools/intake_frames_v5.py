#!/usr/bin/env python3
"""frames-v5 收图验收：清点、哈希、格式、逐格指纹。依据 docs/specs/逐帧v5-出图与播放规则-2026-09-11.md 第 4 节。

大小一致性不直接量头宽（同一只猫侧面、正面、趴卧的轮廓差太多），而是拿"同一姿势"的两格做缩放 + 平移拟合，
得出两格之间的相对缩放；接力帧、循环内各格、站姿彼此串起来，所有张落到同一把尺子上，
最后用侧面站姿对 R3（P00，头宽人工标注 390px）换算成头宽。

用法: python3 assets/tools/intake_frames_v5.py [交付目录]
只读交付目录；写 assets/registry/sha256.txt 与 outputs/frames-v5-review/。
"""
import importlib.util, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('rig', ROOT / 'assets/tools/intake_rig_v1.py')
rig = importlib.util.module_from_spec(_spec); sys.argv, _argv = [sys.argv[0]], sys.argv; _spec.loader.exec_module(rig); sys.argv = _argv

DELIVERY = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'outputs/frames-v5-delivery'
OUT = ROOT / 'outputs/frames-v5-review'
REFS = ROOT / 'assets/tuanzi/frames-v5/refs'
SHEETS = ['N1-prepare', 'N2-jump', 'N3-climb', 'N4-settle', 'N5-look', 'N6-sleep', 'N7-out', 'N8-land',
          'W1-walk-toward', 'W2-walk-away', 'W3-turn']
IDS = SHEETS + ['K1-rope']
P00_HEAD = 390.0          # R3 = P00 头宽，人工标注
TARGET_HEAD = 110.0
CELL = 512
# 同姿势配对：(甲, 乙, 性质)。性质 relay = 接力帧，需 IoU ≥ 0.85；same = 同姿势，只用来串尺子
PAIRS = [
    (('N1-prepare', 6), ('N2-jump', 1), 'relay'),
    (('N2-jump', 6), ('N3-climb', 1), 'relay'),
    (('N3-climb', 6), ('N4-settle', 1), 'relay'),
    (('N5-look', 1), ('N7-out', 1), 'relay'),
    (('N7-out', 6), ('N8-land', 1), 'relay'),
    (('N4-settle', 5), ('N5-look', 1), 'same'),
    (('N4-settle', 6), ('N6-sleep', 1), 'same'),
    (('W3-turn', 1), ('N8-land', 6), 'same'),
    (('W3-turn', 1), ('N1-prepare', 1), 'same'),
    (('W3-turn', 1), ('R3', 0), 'same'),
    (('W3-turn', 3), ('W1-walk-toward', 1), 'same'),
    (('W3-turn', 1), ('W2-walk-away', 1), 'same'),
]


def cells(rgb):
    out = []
    for r in range(2):
        for c in range(3):
            out.append(rgb[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL])
    return out


def key_mask(rgb):
    """背景是轻微渐变的洋红：用格子四边的像素估本格背景色，再按色距取前景。"""
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3), rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
    bg = np.median(border.astype(float), 0)
    d = np.sqrt(((rgb.astype(float) - bg) ** 2).sum(-1))
    return d > 80, bg


def split_cats(full):
    """整张前景按连通块分猫（忽略小于最大块 2% 的碎屑），碎屑并入最近的猫；按质心所在格子排序。"""
    step = 2
    small = full[::step, ::step].astype(np.uint8) * 255
    arr = np.asarray(Image.frombytes('L', (small.shape[1], small.shape[0]), small.tobytes())).copy()
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
    def cell_of(q): return int(q[0] * step // CELL) * 3 + int(q[1] * step // CELL)
    order = sorted(range(len(cats)), key=lambda i: cell_of(cents[i]))
    out = []
    for i in order:
        m = np.asarray(Image.fromarray(cats[i].astype(np.uint8) * 255).resize((full.shape[1], full.shape[0]), Image.NEAREST)) > 127
        m &= full
        ys, xs = np.nonzero(m)
        out.append((m, (xs.min(), ys.min(), xs.max(), ys.max())))
    return out


def crop_mask(m):
    ys, xs = np.nonzero(m)
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit_scale(a, b):
    """先按面积平方根把 a 预缩放到 b 的量级，再在 ±25% 与平移范围内找重合度最大的缩放。返回 (总缩放, iou)。"""
    pre = float(np.sqrt(b.sum() / max(1, a.sum())))
    if abs(pre - 1) > 0.2:
        ai = Image.fromarray(a.astype(np.uint8) * 255)
        a = np.asarray(ai.resize((max(1, round(a.shape[1] * pre)), max(1, round(a.shape[0] * pre))), Image.LANCZOS)) > 127
    else:
        pre = 1.0
    s, iou = _fit_scale(a, b)
    return s * pre, iou


def _fit_scale(a, b):
    f = 2
    bi = Image.fromarray(b.astype(np.uint8) * 255); B = np.asarray(bi.resize((max(1, b.shape[1] // f), max(1, b.shape[0] // f)))) > 127
    best = (1.0, 0.0)
    for s in np.concatenate([np.arange(0.75, 1.335, 0.02)]):
        ai = Image.fromarray(a.astype(np.uint8) * 255)
        A = np.asarray(ai.resize((max(1, round(a.shape[1] * s / f)), max(1, round(a.shape[0] * s / f))))) > 127
        H = max(A.shape[0], B.shape[0]) + 40; W = max(A.shape[1], B.shape[1]) + 40
        canvasB = np.zeros((H, W), bool); by, bx = (H - B.shape[0]) // 2, (W - B.shape[1]) // 2
        canvasB[by:by + B.shape[0], bx:bx + B.shape[1]] = B
        for dy in range(-16, 17, 4):
            for dx in range(-16, 17, 4):
                canvasA = np.zeros((H, W), bool)
                ay, ax = (H - A.shape[0]) // 2 + dy, (W - A.shape[1]) // 2 + dx
                if ay < 0 or ax < 0 or ay + A.shape[0] > H or ax + A.shape[1] > W: continue
                canvasA[ay:ay + A.shape[0], ax:ax + A.shape[1]] = A
                iou = (canvasA & canvasB).sum() / max(1, (canvasA | canvasB).sum())
                if iou > best[1]: best = (float(s), float(iou))
    # 细搜
    s0 = best[0]
    for s in np.arange(s0 - 0.02, s0 + 0.021, 0.005):
        ai = Image.fromarray(a.astype(np.uint8) * 255)
        A = np.asarray(ai.resize((max(1, round(a.shape[1] * s / f)), max(1, round(a.shape[0] * s / f))))) > 127
        H = max(A.shape[0], B.shape[0]) + 40; W = max(A.shape[1], B.shape[1]) + 40
        canvasB = np.zeros((H, W), bool); by, bx = (H - B.shape[0]) // 2, (W - B.shape[1]) // 2
        canvasB[by:by + B.shape[0], bx:bx + B.shape[1]] = B
        for dy in range(-8, 9, 2):
            for dx in range(-8, 9, 2):
                canvasA = np.zeros((H, W), bool)
                ay, ax = (H - A.shape[0]) // 2 + dy, (W - A.shape[1]) // 2 + dx
                if ay < 0 or ax < 0 or ay + A.shape[0] > H or ax + A.shape[1] > W: continue
                canvasA[ay:ay + A.shape[0], ax:ax + A.shape[1]] = A
                iou = (canvasA & canvasB).sum() / max(1, (canvasA | canvasB).sum())
                if iou > best[1]: best = (float(s), float(iou))
    return best


def style(rgb, m):
    h, s, v = rig.hsv(rgb[m])
    orange = (h >= 18) & (h <= 40) & (s >= 0.4)
    L = rig.srgb_to_lab(rgb)[..., 0]
    ring = m & ~rig.erode(m, 4)
    g = L.copy(); inner = rig.erode(m, 10)
    blur = np.asarray(Image.fromarray(np.clip(g * 2.55, 0, 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(3)), float) / 2.55
    return {'hue_median': float(np.median(h[orange])), 'outline_L_p25': float(np.percentile(L[ring], 25)),
            'texture_std': float((g - blur)[inner].std())}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    man = json.load(open(DELIVERY / 'delivery.json'))
    items = {it['id']: it for it in man['items']}
    rep = {'gates': {}, 'sheets': {}, 'pairs': [], 'k1': {}}
    g1 = [f"{i}: 清单缺条目" for i in IDS if i not in items] + [f"{i}: 未知编号" for i in items if i not in IDS]
    on_disk = {str(p.relative_to(DELIVERY)) for p in DELIVERY.rglob('*.png') if '_rejected' not in p.parts}
    listed = {items[i]['file'] for i in items if items[i].get('file')}
    g1 += [f"多出文件 {f}" for f in sorted(on_disk - listed)] + [f"清单文件不存在 {f}" for f in sorted(listed - on_disk)]
    rep['gates']['1_inventory'] = g1
    rig.DELIVERY = DELIVERY; registry = rig.build_registry()
    g2 = []; seen = {}
    for i, it in items.items():
        if it.get('status') != 'new': continue
        h = rig.sha256(DELIVERY / it['file'])
        if it.get('sha256') and it['sha256'] != h: g2.append(f"{i}: 清单哈希不符")
        if h in registry: g2.append(f"{i}: 撞历史素材 {registry[h]}")
        if h in seen: g2.append(f"{i}: 与 {seen[h]} 重复")
        seen[h] = i
    rep['gates']['2_hash'] = g2; rep['registry_count'] = len(registry)

    masks = {}
    r2 = np.asarray(Image.open(REFS / 'R2-cat-walk-side.png').convert('RGB'))
    rep['r2_style'] = style(r2, key_mask(r2)[0])
    p00 = np.asarray(Image.open(REFS / 'R3-cat-side-standing.png').convert('RGB'))
    m00 = key_mask(p00)[0]; masks[('R3', 0)] = crop_mask(m00)
    for sid in SHEETS:
        im = Image.open(DELIVERY / f'{sid}/{sid}__r1.png'); rgb = np.asarray(im.convert('RGB'))
        e = {'size': list(im.size), 'fails': [], 'cells': []}
        if im.size != (1536, 1024): e['fails'].append(f"画布 {im.size}")
        full_mask, bg = key_mask(rgb)
        e['bg_rgb'] = [round(x) for x in bg]
        # 跨格：格子分界线上不应有前景
        seam = np.concatenate([full_mask[:, CELL - 1:CELL + 1].ravel(), full_mask[:, 2 * CELL - 1:2 * CELL + 1].ravel(), full_mask[CELL - 1:CELL + 1, :].ravel()])
        e['crosses_cell_lines'] = bool(seam.any())
        cats = split_cats(full_mask)
        if len(cats) != 6: e['fails'].append(f"整张分出 {len(cats)} 只猫，应为 6（有猫相碰或碎块）")
        for k, (cm, box) in enumerate(cats, 1):
            x0, y0, x1, y1 = box
            sub = rgb[y0:y1 + 1, x0:x1 + 1]; m = cm[y0:y1 + 1, x0:x1 + 1]
            ce = {'cell': k, 'bbox': [int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)], 'area': int(m.sum()),
                  'crosses_own_cell': bool(not (x0 >= ((k - 1) % 3) * CELL and x1 < ((k - 1) % 3 + 1) * CELL and y0 >= ((k - 1) // 3) * CELL and y1 < ((k - 1) // 3 + 1) * CELL))}
            ce.update({kk: round(vv, 3) for kk, vv in style(sub, m).items()})
            e['cells'].append(ce); masks[(sid, k)] = crop_mask(m)
        st = {kk: float(np.median([c[kk] for c in e['cells']])) for kk in ('hue_median', 'outline_L_p25', 'texture_std')}
        e['style_median'] = {kk: round(v, 3) for kk, v in st.items()}
        for kk, v in st.items():
            ref = rep['r2_style'][kk]
            if abs(v / ref - 1) > 0.10: e['fails'].append(f"{kk} {v:.3f} 与 R2 {ref:.3f} 相差 {abs(v / ref - 1) * 100:.0f}%")
        # 循环内各格同尺：拟合每格对第 1 格的缩放
        if sid in ('N5-look', 'N6-sleep', 'W1-walk-toward', 'W2-walk-away'):
            sc = [fit_scale(masks[(sid, k)], masks[(sid, 1)]) for k in range(2, 7)]
            e['loop_scale_vs_cell1'] = [round(s, 3) for s, _ in sc]
            dev = max(abs(s - 1) for s, _ in sc)
            if dev > 0.04: e['fails'].append(f"循环内缩放偏差 {dev * 100:.1f}% > 4%")
        rep['sheets'][sid] = e

    # 配对：相对缩放（甲缩放 s 与乙重合 → 乙的尺子 = 甲 × s）
    edges = {}
    for a, b, kind in PAIRS:
        s, iou = fit_scale(masks[a], masks[b])
        rep['pairs'].append({'a': f"{a[0]}#{a[1]}", 'b': f"{b[0]}#{b[1]}", 'kind': kind, 'scale_a_to_b': round(s, 3), 'iou': round(iou, 3)})
        edges.setdefault(a[0], []).append((b[0], s)); edges.setdefault(b[0], []).append((a[0], 1 / s))
    # 以 W3 为根，广度优先求各张相对 W3 的尺子（值 = 该张里的猫比 W3 大多少倍）
    rel = {'W3-turn': 1.0}; queue = ['W3-turn']
    while queue:
        n = queue.pop(0)
        for m_, s in edges.get(n, []):
            if m_ not in rel:
                rel[m_] = rel[n] * s; queue.append(m_)
    head_w3 = P00_HEAD / rel['R3']   # R3 相对 W3 的倍数 → W3 头宽
    rep['head_width_est'] = {k: round(head_w3 * v, 1) for k, v in rel.items() if k != 'R3'}
    rep['relative_scale_vs_W3'] = {k: round(v, 3) for k, v in rel.items()}
    med = float(np.median([v for k, v in rep['head_width_est'].items()]))
    rep['head_width_median'] = round(med, 1)
    for k, v in rep['head_width_est'].items():
        if abs(v / med - 1) > 0.04: rep['sheets'][k]['fails'].append(f"估算头宽 {v}px 与全体中位数 {med:.0f}px 相差 {abs(v / med - 1) * 100:.0f}%")
    for p in rep['pairs']:
        if p['kind'] == 'relay' and p['iou'] < 0.85:
            rep['sheets'][p['b'].split('#')[0]]['fails'].append(f"接力帧与 {p['a']} 重合度 {p['iou']} < 0.85")

    # K1 绳子
    k = np.asarray(Image.open(DELIVERY / 'K1-rope/K1-rope__r1.png').convert('RGB'))
    m, _ = key_mask(k); ys, xs = np.nonzero(m)
    rows = [y for y in range(0, k.shape[0], 4) if m[y].any()]
    mids = [(np.nonzero(m[y])[0][0] + np.nonzero(m[y])[0][-1]) / 2 for y in rows]
    tilt = float(np.degrees(np.arctan(np.polyfit(rows, mids, 1)[0])))
    widths = [np.nonzero(m[y])[0][-1] - np.nonzero(m[y])[0][0] for y in rows]
    L = rig.srgb_to_lab(k)[..., 0]
    top, bot = L[:12][m[:12]].mean(), L[-12:][m[-12:]].mean()
    rep['k1'] = {'size': [k.shape[1], k.shape[0]], 'tilt_deg': round(tilt, 2), 'width_median': int(np.median(widths)),
                 'spans_full_height': bool(m[0].any() and m[-1].any()), 'seam_L_diff': round(float(abs(top - bot)), 2), 'fails': []}
    if abs(tilt) > 2: rep['k1']['fails'].append(f"偏离竖直 {tilt:.1f}°")
    if abs(top - bot) > 5: rep['k1']['fails'].append(f"上下拼接明暗差 {abs(top - bot):.1f} > 5")
    if not rep['k1']['spans_full_height']: rep['k1']['fails'].append('没有贯穿上下边')
    json.dump(rep, open(OUT / 'intake-report.json', 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(rep, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    main()
