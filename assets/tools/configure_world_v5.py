#!/usr/bin/env python3
"""树窝方案 B：窝缩到六成、窝沿高度不变、加吊绳。原地修改 world-scene-v4 与 courtyard-v4/scene.json。

不重跑 configure_world_v4.py：那个脚本从 v3 重新生成，会抹掉 09-10 直接加进配置的信箱。
本脚本幂等：每次都从当前文件读，按固定数值覆盖树窝相关字段，其余不动。

数值来源：
- 树枝旧绳圈的挖空切口：树贴图 (539, 839) → 世界 (0.3105, 0.3949)，见 outputs/frames-v5-review/knot-zoom.png。
- 窝口轮廓：assets/tuanzi/frames-v5/nest-opening.json（由吊窝贴图的暗色内壁平滑内收 12px 得到）。
- 窝沿高度保持 0.564（方案 B）；抓沿点在窝口中心右侧 22pt（与 package_frames_v5.py 的 INSIDE_FWD 一致）。
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = [ROOT / 'ios/Maomao/Assets.xcassets/world-scene-v4.dataset/data.json', ROOT / 'assets/scenes/courtyard-v4/scene.json']
OPENING = json.load(open(ROOT / 'assets/tuanzi/frames-v5/nest-opening.json'))

KNOT = (0.3105, 0.3949)                 # 摆动支点 = 树枝绳圈切口
NEST_W, NEST_H = 0.078, 0.123           # 原 0.130 × 0.205 的六成
LOOP_X_REL = 0.505                      # 吊窝贴图里窝顶绳圈的水平位置
LIP_Y = 0.564                           # 窝沿高度（方案 B 不变）
LIP_REL = OPENING['lip_y_rel'] + 8 / 1211   # 轮廓内收过；窝沿顶面比轮廓底边低约 8 贴图像素
INSIDE_FWD_PT, BG_W_PT = 22.0, 844 * 1.5
ASPECT = 1.5


def rect(x, y, w, h): return {'x': round(x, 5), 'y': round(y, 5), 'width': round(w, 5), 'height': round(h, 5)}


def lip_y_rel_at(x_rel):
    """窝口轮廓在 x_rel 处的下边缘（相对窝贴图）。"""
    poly = OPENING['poly_rel']; best = None
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (x0 - x_rel) * (x1 - x_rel) <= 0 and x0 != x1:
            y = y0 + (y1 - y0) * (x_rel - x0) / (x1 - x0)
            best = y if best is None else max(best, y)
    return best


nest_x = KNOT[0] - LOOP_X_REL * NEST_W
nest_y = LIP_Y - LIP_REL * NEST_H
center_x = nest_x + OPENING['center_rel'][0] * NEST_W
grip_x = center_x + INSIDE_FWD_PT / BG_W_PT
grip_rel = (grip_x - nest_x) / NEST_W
grip_y = nest_y + (lip_y_rel_at(grip_rel) + 8 / 1211) * NEST_H
rope_w = 26 / 5166
rope_top = KNOT[1] - 0.0015
rope_bottom = nest_y + 0.004 * NEST_H / 0.123
knot_w = 58 / 5166; knot_h = knot_w * 82 / 146 * ASPECT

for f in FILES:
    s = json.load(open(f))
    objs = [o for o in s['objects'] if o['id'] not in ('nest-rope', 'nest-knot')]
    for o in objs:
        if o['id'] in ('nest-back', 'nest-front'):
            o['rect'] = rect(nest_x, nest_y, NEST_W, NEST_H)
            o['sourceRect'] = None; o['outline'] = None
        if o['id'] == 'nest-back':
            o['cutouts'] = None; o['cutoutPaths'] = None
        if o['id'] == 'nest-front':
            # 窝前片 = 整个窝去掉窝口：猫在窝里时只从窝口露出来，窝壁挡在它前面。
            o['cutouts'] = None
            o['cutoutPaths'] = [[{'x': x, 'y': y} for x, y in OPENING['poly_rel']]]
    back = next(o for o in objs if o['id'] == 'nest-back')
    rope_h = rope_bottom - rope_top
    objs.append({'id': 'nest-rope', 'image': 'world-v5-rope', 'rect': rect(KNOT[0] - rope_w / 2, rope_top, rope_w, rope_h),
                 'depth': 0.6149, 'target': back.get('target'), 'motion': 'nest',
                 'sourceRect': rect(0, 0, 1, min(1, rope_h * 3444 / 260))})
    objs.append({'id': 'nest-knot', 'image': 'world-v5-rope-knot', 'rect': rect(KNOT[0] - knot_w / 2, KNOT[1] - knot_h * 0.45, knot_w, knot_h),
                 'depth': 0.6151, 'target': back.get('target'), 'motion': 'nest'})
    s['objects'] = objs
    s['nestSupport'] = {'x': round(grip_x, 5), 'y': round(grip_y, 5)}
    s['nestPivot'] = {'x': KNOT[0], 'y': KNOT[1]}
    json.dump(s, open(f, 'w'), indent=2, ensure_ascii=False)
print('nest rect', round(nest_x, 4), round(nest_y, 4), 'grip', round(grip_x, 4), round(grip_y, 4), 'launch x', round(grip_x + 0.013, 4),
      'rope', round(rope_top, 4), round(rope_bottom, 4))
