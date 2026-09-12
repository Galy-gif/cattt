#!/usr/bin/env python3
"""情绪、喝水、时段与雨天：贴图与场景配置。原地修改 world-scene-v4 与 courtyard-v4/scene.json，不重跑 v4 配置脚本。

做四件事（幂等）：
1. 水面：从 atmosphere-v1 的 P2 里取碗口的水面椭圆，缩放贴进房子贴图里那只蓝碗的碗口，存成 world-v6-water.png。
   碗身不换（验收报告：新碗材质与旁边的红碗不配）。
2. 亮窗：S5 按木框十字对齐房子贴图的圆窗，存成 world-v6-window-lit.png，傍晚和夜晚盖在窗上。
3. 天上的东西：太阳、月亮、五颗星星、两朵雨云，去底后存进 WorldTextures，由 WorldView 的天空层按时段画。
4. 场景配置：加碗前落脚点 `bowl`（用动作目录里 drinkDown 的 mouth 偏移算）、水面与亮窗两个带 visibility 的物件、碗的点击热区 bowlHit。

数值来源：
- 房子贴图 world-v2-house.png 1437×1094，世界矩形 (0.055, 0.34, 0.205, 0.3075)。
- 蓝碗在贴图里的包围盒 x 973–1145、y 940–1049；圆窗木框十字包围盒 x 892–1199、y 600–898（outputs/atmosphere-v1-review/验收报告.md 叠图测试）。
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = ROOT / 'outputs/atmosphere-v1-delivery'
TEX = ROOT / 'ios/Maomao/Resources/WorldTextures'
FILES = [ROOT / 'ios/Maomao/Assets.xcassets/world-scene-v4.dataset/data.json', ROOT / 'assets/scenes/courtyard-v4/scene.json']
CATALOG = ROOT / 'ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json'
PREVIEW = ROOT / 'outputs/atmosphere-v1-review/sheets/house-water-window.jpg'

HOUSE = (0.055, 0.34, 0.205, 0.3075)
HOUSE_PX = (1437, 1094)
BOWL_PX = (973, 940, 1145, 1049)
WINDOW_PX = (892, 600, 1199, 898)
BG_W_PT, BG_H_PT = 844 * 1.5, 844


def key(path, feather=1.0):
    """洋红底去底：按色距取前景，边缘羽化一像素，反混色去掉洋红毛边。"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    bg = np.array([255.0, 0.0, 255.0])
    d = np.sqrt(((a - bg) ** 2).sum(-1)); alpha = np.clip((d - 40) / 70, 0, 1)
    fg = (a - (1 - alpha)[..., None] * bg) / np.maximum(alpha, 0.05)[..., None]
    fg = np.clip(fg, 0, 255)
    edge = (alpha > 0) & (alpha < 1)
    fg[edge, 0] = np.minimum(fg[edge, 0], fg[edge, 1] * 1.15 + 40); fg[edge, 2] = np.minimum(fg[edge, 2], fg[edge, 1] * 1.15 + 40)
    am = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    rgba = np.dstack([fg, np.asarray(am)]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    ys, xs = np.nonzero(rgba[..., 3] > 8)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def house_px_to_world(x, y):
    return HOUSE[0] + HOUSE[2] * x / HOUSE_PX[0], HOUSE[1] + HOUSE[3] * y / HOUSE_PX[1]


def rect(x, y, w, h): return {'x': round(x, 5), 'y': round(y, 5), 'width': round(w, 5), 'height': round(h, 5)}


def water_surface():
    """P2 的水面：碗口内偏蓝偏亮的区域。"""
    p2 = np.asarray(Image.open(DELIVERY / 'P2-bowl-full/P2-bowl-full__r1.png').convert('RGB')).astype(float)
    r, g, b = p2[..., 0], p2[..., 1], p2[..., 2]
    water = (b > 150) & (r > 90) & (r < 200) & (g > 150) & (b - r > 30) & ~((r > 200) & (b > 200) & (g < 80))
    ys, xs = np.nonzero(water)
    # 只留最大的一片（碗口），去掉碗身上零星像素
    x0, x1 = np.percentile(xs, 1), np.percentile(xs, 99); y0, y1 = np.percentile(ys, 1), np.percentile(ys, 99)
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    yy, xx = np.mgrid[0:p2.shape[0], 0:p2.shape[1]]
    ell = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    alpha = np.clip((1.0 - ell) * 6, 0, 1)   # 椭圆内为 1，边缘一圈羽化
    rgba = np.dstack([p2, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA').crop((int(cx - rx) - 2, int(cy - ry) - 2, int(cx + rx) + 3, int(cy + ry) + 3))
    print('water ellipse in P2', round(cx), round(cy), 'r', round(rx), round(ry))
    return im


def build_textures():
    house = Image.open(TEX / 'world-v2-house.png').convert('RGBA')
    # 1. 水面 → 贴图蓝碗的碗口。碗口：包围盒顶到约 42% 高处（碗沿椭圆），左右各收 6px。
    bx0, by0, bx1, by1 = BOWL_PX
    ox0, oy0, ox1, oy1 = bx0 + 8, by0 + 2, bx1 - 8, by0 + int((by1 - by0) * 0.40)
    w = water_surface().resize((ox1 - ox0, oy1 - oy0), Image.LANCZOS)
    w.save(TEX / 'world-v6-water.png', optimize=True)
    wx0, wy0 = house_px_to_world(ox0, oy0); wx1, wy1 = house_px_to_world(ox1, oy1)
    water_rect = rect(wx0, wy0, wx1 - wx0, wy1 - wy0)
    # 2. 亮窗：按木框十字包围盒对齐
    s5 = key(DELIVERY / 'S5-window-lit/S5-window-lit__r1.png')
    a = np.asarray(s5).astype(int); al = a[..., 3] > 128
    brown = (a[..., 0] > 90) & (a[..., 0] < 200) & (a[..., 1] > 50) & (a[..., 1] < 140) & (a[..., 2] < 90) & al
    ys, xs = np.nonzero(brown); px0, py0, px1, py1 = xs.min(), ys.min(), xs.max(), ys.max()
    sx = (WINDOW_PX[2] - WINDOW_PX[0]) / (px1 - px0); sy = (WINDOW_PX[3] - WINDOW_PX[1]) / (py1 - py0)
    win = s5.resize((int(s5.width * sx), int(s5.height * sy)), Image.LANCZOS)
    left, top = WINDOW_PX[0] - px0 * sx, WINDOW_PX[1] - py0 * sy
    win.save(TEX / 'world-v6-window-lit.png', optimize=True)
    lx0, ly0 = house_px_to_world(left, top); lx1, ly1 = house_px_to_world(left + win.width, top + win.height)
    window_rect = rect(lx0, ly0, lx1 - lx0, ly1 - ly0)
    # 3. 天上的东西
    sizes = {'S1-sun': ('world-v6-sun', 320), 'S2-moon': ('world-v6-moon', 300), 'S4-raincloud-a': ('world-v6-raincloud-a', 640), 'S4-raincloud-b': ('world-v6-raincloud-b', 560)}
    for sid, (name, px) in sizes.items():
        im = key(DELIVERY / f'{sid}/{sid}__r1.png')
        im = im.resize((px, round(im.height * px / im.width)), Image.LANCZOS)
        im.save(TEX / f'{name}.png', optimize=True)
    stars = key(DELIVERY / 'S3-stars/S3-stars__r1.png')
    sa = np.asarray(stars)[..., 3] > 128
    from PIL import ImageDraw
    arr = Image.fromarray(sa.astype(np.uint8) * 255)
    comps = []
    work = np.asarray(arr).copy()
    while True:
        ys, xs = np.nonzero(work == 255)
        if len(ys) == 0: break
        w_ = Image.frombytes('L', (work.shape[1], work.shape[0]), work.tobytes())
        ImageDraw.floodfill(w_, (int(xs[0]), int(ys[0])), 128)
        m = np.asarray(w_) == 128; comps.append(m); work = np.where(m, 0, np.asarray(w_)).astype(np.uint8)
    comps = sorted([c for c in comps if c.sum() > 200], key=lambda c: -c.sum())
    assert len(comps) == 5, len(comps)
    for i, c in enumerate(comps, 1):
        ys, xs = np.nonzero(c)
        star = stars.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
        star = star.resize((96, round(star.height * 96 / star.width)), Image.LANCZOS)
        star.save(TEX / f'world-v6-star-{i}.png', optimize=True)
    # 预览：房子 + 水面 + 亮窗
    comp = house.copy()
    comp.alpha_composite(w, (ox0, oy0)); comp.alpha_composite(win, (int(left), int(top)))
    comp.crop((380, 560, 1220, 1094)).convert('RGB').save(PREVIEW, quality=88)
    return water_rect, window_rect


def configure(water_rect, window_rect):
    catalog = json.load(open(CATALOG))
    mouth = next(a for a in catalog['actions'] if a['id'] == 'drinkDown')['mouth']
    # 嘴的目标：碗口偏左（猫朝右从近侧喝），碗沿高度
    mx, my = house_px_to_world(BOWL_PX[0] + (BOWL_PX[2] - BOWL_PX[0]) * 0.30, BOWL_PX[1] + 12)
    foot = {'x': round(mx - mouth[0] / BG_W_PT, 5), 'y': round(my + mouth[1] / BG_H_PT, 5)}
    hx0, hy0 = house_px_to_world(BOWL_PX[0] - 60, BOWL_PX[1] - 70); hx1, hy1 = house_px_to_world(BOWL_PX[2] + 60, BOWL_PX[3] + 40)
    for f in FILES:
        s = json.load(open(f))
        s['nodes'] = [n for n in s['nodes'] if n['id'] != 'bowl'] + [{'id': 'bowl', 'point': foot}]
        s['edges'] = [e for e in s['edges'] if 'bowl' not in (e['a'], e['b'])] + [{'a': 'm0', 'b': 'bowl', 'width': 0.033, 'main': False}]
        objs = [o for o in s['objects'] if o['id'] not in ('water', 'window-lit')]
        objs.append({'id': 'water', 'image': 'world-v6-water', 'rect': water_rect, 'depth': 0.631, 'target': 0, 'visibility': 'water'})
        objs.append({'id': 'window-lit', 'image': 'world-v6-window-lit', 'rect': window_rect, 'depth': 0.632, 'target': 0, 'visibility': 'lit'})
        s['objects'] = objs
        s['bowlHit'] = rect(hx0, hy0, hx1 - hx0, hy1 - hy0)
        json.dump(s, open(f, 'w'), indent=2, ensure_ascii=False)
    print('bowl foot', foot, 'mouth target', round(mx, 4), round(my, 4), 'water', water_rect, 'window', window_rect)


if __name__ == '__main__':
    configure(*build_textures())
