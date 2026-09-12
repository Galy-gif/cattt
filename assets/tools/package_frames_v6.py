#!/usr/bin/env python3
"""frames-v6 切帧打包：门口待机（坐着看你、歪头、洗脸）、三种情绪、喝水三段。

做法沿用 package_frames_v5.py（去底 → Lab 调色到保留的侧面走 → 描边柔化 → 统一到 40pt 头宽 → 按接触点放进公共画布），
本脚本只定义 v6 的帧表与锚点规则，切图、调色、缩放都直接调用 v5 的函数。
依据 docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md 与 assets/tuanzi/frames-v6/README.md。

写 ios/Maomao/Assets.xcassets/world-v6/ 与动作目录 cat-actions-v2 里的 v6 条目。可重复运行，结果确定。

锚点（2026-09-12 按《世界层动画连贯性-诊断与方案》调整）：
- 坐姿与情绪（H、M）：先按臀部落地线（bottom）定位，再把轮廓上 60%（躯干，不含落地的尾巴）
  配准到中继帧 N4 第 3 格。原来只用 bottom，尾巴一扫就把锚点拽走，整只猫左右滑 12–25pt。
- 喝水系列（D）：后脚着地点（hindStable —— 只在轮廓后 40% 里找最低行，低头时下巴比后脚低也不会认错），
  整段再加一个常数偏移，落到和走路同一个参照上（走路按蒙版中心定位）。
  另外记下 D1 第 6 格嘴的位置（相对锚点，pt，x 向前、y 向上），写进目录的 `mouth` 字段，场景配置用它算碗前落脚点。
- 起身 / 坐下（N4 三格）：真的在动，不配准。
"""
import importlib.util, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec); argv = sys.argv; sys.argv = [sys.argv[0]]; spec.loader.exec_module(mod); sys.argv = argv
    return mod
v5 = _load('package_frames_v5', 'assets/tools/package_frames_v5.py')
rig = v5.rig

DELIVERY = ROOT / 'outputs/frames-v6-delivery'
V5_DELIVERY = ROOT / 'outputs/frames-v5-delivery'
V5_REPORT = ROOT / 'outputs/frames-v5-review/intake-report.json'
XC = ROOT / 'ios/Maomao/Assets.xcassets/world-v6'
CATALOG = ROOT / 'ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json'
LOG = ROOT / 'outputs/frames-v6-review/package.json'
HEAD_PT, PX, CELL = v5.HEAD_PT, v5.PX, v5.CELL

# 坐姿与情绪：锚点改成对中继帧做躯干配准（诊断第 2.2 节）。起身 / 坐下是真的在动，不配准。
RELAY = ('N4-settle', 3, 'bottom')
ALIGN_TO_RELAY = {'sitLook', 'headTilt', 'groom', 'moodHappy', 'moodSulk', 'moodSad', 'moodSadIn', 'moodSadOut'}

# 动作表：(动作 id, [(张, 格, 接触方式)], 每帧时长, 循环方式)
ACTIONS = [
    ('sitLook',   [('H1-sit-look', k, 'bottom') for k in range(1, 7)], [1.60, 0.10, 0.14, 0.90, 1.00, 0.80], 'loop'),
    ('headTilt',  [('H2-head-tilt', k, 'bottom') for k in range(1, 7)], [0.80, 0.12, 0.90, 0.50, 0.90, 0.60], 'loop'),
    ('groom',     [('H3-groom', k, 'bottom') for k in range(1, 7)], [0.60, 0.15, 0.25, 0.25, 0.25, 0.20], 'loop'),
    ('moodHappy', [('M1-happy', k, 'bottom') for k in range(1, 7)], [1.20, 0.30, 0.30, 0.60, 0.50, 0.50], 'loop'),
    ('moodSulk',  [('M2-sulk', k, 'bottom') for k in range(1, 7)], [1.50, 0.15, 0.15, 0.15, 0.15, 1.20], 'loop'),
    # 委屈：第 1、2 格是从坐姿缩下去的过渡，只播一次；第 3–6 格才是循环。
    ('moodSadIn', [('M3-sad', 1, 'bottom'), ('M3-sad', 2, 'bottom')], [0.12, 0.14], 'once'),
    ('moodSad',   [('M3-sad', k, 'bottom') for k in range(3, 7)], [2.00, 1.20, 1.00, 1.20], 'loop'),
    # 从委屈回到坐姿：同两格倒放。
    ('moodSadOut', [('M3-sad', 2, 'bottom'), ('M3-sad', 1, 'bottom')], [0.14, 0.12], 'once'),
    # 起身 / 坐下：v5 的 N4 第 1–3 格是"侧身站着（朝右）→ 转向观众 → 坐下"，倒放就是从坐姿起身转向右。
    # 离开蘑菇屋、去喝水前播起身；走到门口后播坐下。尺度与坐姿枢纽同一张，不会跳。
    ('sitToStand', [('N4-settle', 3, 'bottom'), ('N4-settle', 2, 'bottom'), ('N4-settle', 1, 'bottom')], [0.12, 0.12, 0.12], 'once'),
    ('standToSit', [('N4-settle', 1, 'bottom'), ('N4-settle', 2, 'bottom'), ('N4-settle', 3, 'bottom')], [0.12, 0.12, 0.12], 'once'),
    ('drinkDown', [('D1-drink-down', k, 'hindStable') for k in range(1, 7)], [0.14, 0.12, 0.12, 0.12, 0.12, 0.16], 'once'),
    ('drinkLap',  [('D2-drink-lap', k, 'hindStable') for k in range(1, 7)], [0.12] * 6, 'loop'),
    # 出窝那张的第 4、5 格有拖影和"＞＜"眼，作废（README）。
    ('drinkUp',   [('D3-drink-up', k, 'hindStable') for k in (1, 2, 3, 6)], [0.14, 0.16, 0.30, 0.20], 'once'),
]


def bbox_height(sheet_cats, k):
    ys, _ = np.nonzero(sheet_cats[k - 1]['hard']); return ys.max() - ys.min()


def head_estimates():
    """源图头宽（px）。坐姿张的第 1 格是 N4 第 3 格原样贴入，尺度同 N4；喝水张按站姿高度对 W3-turn 第 1 格换算。"""
    v5head = json.load(open(V5_REPORT))['head_width_est']
    v5.DELIVERY = V5_DELIVERY
    w3 = v5.load_sheet('W3-turn'); h_w3 = bbox_height(w3, 1)
    v5.DELIVERY = DELIVERY
    d1 = v5.load_sheet('D1-drink-down'); h_d1 = bbox_height(d1, 1)
    drink = v5head['W3-turn'] * h_d1 / h_w3
    est = {s: v5head['N4-settle'] for s in ['H1-sit-look', 'H2-head-tilt', 'H3-groom', 'M1-happy', 'M2-sulk', 'M3-sad', 'N4-settle']}
    est.update({s: drink for s in ['D1-drink-down', 'D2-drink-lap', 'D3-drink-up']})
    return est


def mouth(cat):
    """嘴：轮廓最靠前（右）的点。返回猫包围盒内像素坐标。"""
    hard = cat['hard']; ys, xs = np.nonzero(hard)
    xmax = xs.max(); sel = xs >= xmax - 3
    return float(xmax), float(ys[sel].mean())


def main():
    v5.DELIVERY = DELIVERY
    head = head_estimates()
    tgt = v5.target_stats()
    sheets = {}
    for sid in sorted({s for _, frames, _, _ in ACTIONS for s, _, _ in frames}):
        v5.DELIVERY = V5_DELIVERY if sid.startswith('N') else DELIVERY
        cats = v5.load_sheet(sid)
        src_px = np.concatenate([rig.srgb_to_lab(c['rgb'])[rig.erode(c['hard'], 2)] for c in cats])
        sheets[sid] = {'cats': cats, 'src': (src_px.mean(0), src_px.std(0)), 'scale': HEAD_PT * PX / head[sid]}

    def frame(sid, k, kind):
        c = sheets[sid]['cats'][k - 1]; s = sheets[sid]['scale']
        if 'graded' not in c:
            c['graded'] = v5.premul_resize(*v5.grade(c, sheets[sid]['src'], tgt), s)
        cx, cy = v5.contact(c, kind, (sid, k))
        return c['graded'], (cx * s / PX, cy * s / PX), s

    def drink_offset():
        """喝水整段的锚点往前挪一个常数，落到和走路同一个参照上。

        走路按整只猫的蒙版中心定位（`contact('walk')`），喝水按后脚定位（低头时只有后脚不动）。
        两种约定各有道理，缺的是衔接时的一次性补偿：不补的话"走到碗前 → 低头第 1 格"整只猫要横跳 37pt。
        用 D1 第 1 格（站姿，最接近走路）量一次中心与后脚的差，三段共用。
        """
        sid = 'D1-drink-down'; c = sheets[sid]['cats'][0]; s = sheets[sid]['scale']
        cxc, _ = v5.contact(c, 'walk', (sid, 1))
        cxh, _ = v5.contact(c, 'hindStable', (sid, 1))
        return (cxc - cxh) * s / PX

    def torso(alpha, frac=0.6):
        """轮廓上 60%（头＋肩，不含落地的尾巴）。"""
        m = alpha > 0.5
        ys, _ = np.nonzero(m)
        top, bot = ys.min(), ys.max()
        m = m.copy(); m[int(top + frac * (bot - top)):] = False
        return m

    PAD = 130 * PX

    def on_common(mask, ax, ay, shift=0):
        """把蒙版按锚点摆进一张公共画布：锚点固定在 (PAD, PAD)，shift 是锚点额外挪的像素。"""
        can = np.zeros((2 * PAD, 2 * PAD), bool)
        x0 = int(round(PAD - ax - shift)); y0 = int(round(PAD - ay))
        h, w = mask.shape
        xs0, ys0 = max(0, x0), max(0, y0)
        xs1, ys1 = min(2 * PAD, x0 + w), min(2 * PAD, y0 + h)
        if xs1 <= xs0 or ys1 <= ys0: return can
        can[ys0:ys1, xs0:xs1] = mask[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0]
        return can

    def torso_dx(ref, cur, span=45):
        """把 cur 的躯干配准到 ref（只搜水平平移），返回锚点该额外挪多少 pt。

        坐姿系列原来用 `bottom`（底部带像素的平均 x）当锚点，尾巴一落地就把锚点拽走，
        整只猫跟着反向滑 12–25pt（诊断第 2.2 节）。躯干不受尾巴影响。
        """
        base = on_common(*ref)
        best, bo = -1.0, 0
        for d in range(-span * PX, span * PX + 1):
            q = on_common(cur[0], cur[1], cur[2], d)
            u = int((base | q).sum())
            v = int((base & q).sum()) / u if u else 0.0
            if v > best: best, bo = v, d
        return bo / PX

    catalog = json.load(open(CATALOG))
    specs = [x for x in catalog['actions'] if x.get('imagePrefix') != 'cat-v6']
    info = {'author': 'xcode', 'version': 1}
    if XC.exists(): shutil.rmtree(XC)
    XC.mkdir(parents=True)
    json.dump({'info': info}, open(XC / 'Contents.json', 'w'), indent=2)
    log = {}
    # 坐姿系列的配准基准：N4 第 3 格（中继帧，三张 H 和 M3 的第 1 格都是它原样贴入）
    (_r, ra), (rx, ry), _rs = frame(*RELAY)
    align_ref = (torso(ra), rx * PX, ry * PX)
    dx_drink = drink_offset()
    offsets = {}

    for aid, frames, durations, loop in ACTIONS:
        placed = []
        for sid, k, kind in frames:
            (rgb, a), (cx, cy), s = frame(sid, k, kind)
            if aid in ALIGN_TO_RELAY:
                dx = torso_dx(align_ref, (torso(a), cx * PX, cy * PX))
            elif aid.startswith('drink'):
                dx = dx_drink
            else:
                dx = 0.0
            offsets.setdefault(aid, []).append(round(dx, 2))
            placed.append((rgb, a, -(cx + dx), -cy, a.shape[1] / PX, a.shape[0] / PX, (sid, k, kind, s)))
        half = max(max(-p[2], p[2] + p[4]) for p in placed) + 4
        top = min(p[3] for p in placed) - 4; bottom = max(p[3] + p[5] for p in placed) + 4
        cw, ch = float(np.ceil(half * 2)), float(np.ceil(bottom - top)); foot = float(-top)
        W, H = int(round(cw * PX)), int(round(ch * PX))
        for i, (rgb, a, left, t, w, h, src) in enumerate(placed, 1):
            canvas = np.zeros((H, W, 4), np.float32)
            x0 = int(round((cw / 2 + left) * PX)); y0 = int(round((foot + t) * PX))
            hh, ww = a.shape
            canvas[y0:y0 + hh, x0:x0 + ww, :3] = rgb; canvas[y0:y0 + hh, x0:x0 + ww, 3] = a * 255
            name = f'cat-v6-{aid}-{i:02d}'
            d = XC / f'{name}.imageset'; d.mkdir(parents=True, exist_ok=True)
            Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8), 'RGBA').save(d / 'image.png', optimize=True)
            json.dump({'images': [{'idiom': 'universal', 'filename': 'image.png'}], 'info': info}, open(d / 'Contents.json', 'w'), indent=2)
        spec = {'id': aid, 'name': aid, 'frameCount': len(placed), 'fps': 12, 'loop': loop, 'size': [cw, ch], 'footY': round(foot, 2),
                'bodyLength': 100.9, 'hitInset': 5, 'imagePrefix': 'cat-v6', 'frameDurations': durations}
        if aid.startswith('drink'):
            # 嘴相对锚点的位置：用 D1 第 6 格（嘴刚到碗沿）；三张的嘴高一致（验收报告：跨度 0px）。
            # 锚点是"后脚 + 和走路衔接的常数偏移"，这里要减掉同一个偏移，碗前落脚点才对。
            sid, k, kind, s = ('D1-drink-down', 6, 'hindStable', sheets['D1-drink-down']['scale'])
            c = sheets[sid]['cats'][k - 1]
            mx, my = mouth(c); ax, ay = v5.contact(c, kind, (sid, k))
            spec['mouth'] = [round((mx - ax) * s / PX - dx_drink, 2), round((ay - my) * s / PX, 2)]
        specs.append(spec)
        log[aid] = {'size': [cw, ch], 'footY': foot, 'frames': [f'{s}#{k} {kind}' for s, k, kind in frames],
                    'anchorShift': offsets[aid], 'mouth': spec.get('mouth')}
        print(aid, spec['size'], 'footY', spec['footY'], 'mouth', spec.get('mouth', ''))
    catalog['actions'] = specs
    json.dump(catalog, open(CATALOG, 'w'), indent=2, ensure_ascii=False, sort_keys=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'head_width_source_px': head, **log}, open(LOG, 'w'), indent=1, ensure_ascii=False)
    print('head estimates', {k: round(v, 1) for k, v in head.items()})


if __name__ == '__main__':
    main()
