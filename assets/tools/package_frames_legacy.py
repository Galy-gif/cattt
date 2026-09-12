#!/usr/bin/env python3
"""老帧统一：把 v5 之前几代的猫帧调色到和现行帧同一套颜色与描边，几何一点不动。

为什么：门口待机池里 `sleepyNod` 占平静时的 0.45、夜里全是它，点猫和四个地点的默认待机是 `blinkLook`，
它们和 v6 的坐姿并排出现时，描边更硬、颜色更艳，读起来像换了一只猫
（诊断见 docs/specs/世界层动画连贯性-诊断与方案-2026-09-12.md 第 2.6 节，用户选了"重打包老帧"这一条）。

做什么：按"画风代"（cat / cat-v2 / cat-v3 / cat-v4）分别求源图的 Lab 统计，迁移到运行时保留的侧面走路
（和 v5/v6 用的是同一个目标），再按 v5 的做法提亮暗描边、压一点描边饱和；半透明边缘的颜色用内部颜色往外糊一圈盖掉
——老帧是早就切好的 PNG，边缘像素的 RGB 不可靠，直接调色会留一圈青边。

**不动的东西**：像素尺寸、alpha、画布、footY、动作目录。所以场景里那些手调过的接触点（水边、栅栏、树窝）不受影响。
`walk` 是调色的目标，`run` 和它同一张交付，两个都不动。

源图快照在 assets/legacy-frames/（第一次跑 `--snapshot` 生成，之后脚本只读它），所以可重复运行、结果确定。
"""
import argparse, importlib.util, json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('package_frames_v5', ROOT / 'assets/tools/package_frames_v5.py')
v5 = importlib.util.module_from_spec(_spec); _argv = sys.argv; sys.argv = [sys.argv[0]]; _spec.loader.exec_module(v5); sys.argv = _argv
rig = v5.rig

XC = ROOT / 'ios/Maomao/Assets.xcassets'
SRC = ROOT / 'assets/legacy-frames'
CATALOG = XC / 'cat-actions-v2.dataset/data.json'
REPORT = ROOT / 'outputs/legacy-regrade/report.json'

# 调色的目标就是这两个动作的帧，所以它们自己不动。
KEEP = {'walk', 'run'}
GROUPS = {'cat': 'cat', 'cat-v2': 'world-v2', 'cat-v3': 'world-v3', 'cat-v4': 'world-v4'}


def legacy_actions():
    catalog = json.load(open(CATALOG))
    out = []
    for a in catalog['actions']:
        prefix = a.get('imagePrefix', 'cat')
        if prefix in GROUPS and a['id'] not in KEEP:
            out.append((prefix, a['id'], a['frameCount']))
    return sorted(out)


def frame_files(prefix, aid, count):
    """一格可能有 @2x / @3x 两个文件，都要处理。"""
    group = XC / GROUPS[prefix]
    files = []
    for i in range(1, count + 1):
        d = group / f'{prefix}-{aid}-{i:02d}.imageset'
        pngs = sorted(d.glob('*.png'))
        if not pngs: raise SystemExit(f'缺帧：{d}')
        files += pngs
    return files


def snapshot(force=False):
    if SRC.exists() and not force: raise SystemExit(f'{SRC} 已存在；要重建加 --force')
    if SRC.exists(): shutil.rmtree(SRC)
    n = 0
    for prefix, aid, count in legacy_actions():
        for p in frame_files(prefix, aid, count):
            # world-v2/v3/v4 里每个 imageset 的文件都叫 image.png，快照必须按 imageset 名分目录，不然互相覆盖
            dst = SRC / GROUPS[prefix] / p.parent.name / p.name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(p, dst); n += 1
    print(f'快照 {n} 个文件 → {SRC}')


def box(a, r, passes=3):
    """三次盒式模糊近似高斯；只用 numpy。"""
    out = a.astype(np.float64)
    for _ in range(passes):
        for axis in (0, 1):
            pad = [(r + 1, r) if i == axis else (0, 0) for i in range(2)]
            c = np.cumsum(np.pad(out, pad, mode='edge'), axis=axis)
            lo = np.take(c, range(0, out.shape[axis]), axis=axis)
            hi = np.take(c, range(2 * r + 1, out.shape[axis] + 2 * r + 1), axis=axis)
            out = (hi - lo) / (2 * r + 1)
    return out


def load(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(float)
    alpha = a[..., 3] / 255
    return {'rgb': a[..., :3], 'alpha': alpha, 'hard': alpha > 0.5}


def stats(paths):
    px = [rig.srgb_to_lab(c['rgb'])[rig.erode(c['hard'], 2)] for c in (load(p) for p in paths)]
    px = np.concatenate([p for p in px if len(p)])
    return px.mean(0), px.std(0)


def grade(cat, src, tgt):
    (ms, ss), (mt, st) = src, tgt
    lab = rig.srgb_to_lab(cat['rgb'])
    lab = (lab - ms) / ss * st + mt
    hard = cat['hard']
    ring = hard & ~rig.erode(hard, 7)
    L = lab[..., 0]; lift = ring & (L < 50); L[lift] = 50 + (L[lift] - 50) * 0.45; lab[..., 0] = L
    lab[ring, 1] *= 0.85
    rgb = v5.lab2rgb(lab)
    # 半透明边缘：颜色取内部的加权模糊值，盖掉抠图残留
    a = cat['alpha']; solid = (a > 0.9).astype(np.float64)
    num = np.dstack([box(rgb[..., i] * solid, 3) for i in range(3)])
    den = box(solid, 3)
    spread = num / np.maximum(den, 1e-3)[..., None]
    t = np.clip((a - 0.55) / 0.35, 0, 1)[..., None]
    out = np.where(solid[..., None] > 0.5, rgb, t * rgb + (1 - t) * spread)
    return np.clip(out, 0, 255), a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--snapshot', action='store_true', help='把当前 Assets.xcassets 里的老帧复制成源图快照')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    if args.snapshot: snapshot(args.force); return
    if not SRC.exists(): raise SystemExit(f'没有源图快照；先跑 `python3 {Path(__file__).name} --snapshot`')
    tgt = v5.target_stats()
    actions = legacy_actions()
    log = {'target_lab': [round(x, 2) for x in np.concatenate(tgt)], 'groups': {}, 'actions': {}}
    for prefix in sorted({p for p, _, _ in actions}):
        group_actions = [(a, n) for p, a, n in actions if p == prefix]
        srcs = [SRC / GROUPS[prefix] / f.parent.name / f.name for a, n in group_actions for f in frame_files(prefix, a, n)]
        missing = [str(p) for p in srcs if not p.exists()]
        if missing: raise SystemExit(f'源图快照缺文件：{missing[:3]}')
        src = stats(srcs)
        log['groups'][prefix] = {'source_lab': [round(x, 2) for x in np.concatenate(src)], 'frames': len(srcs),
                                 'actions': [a for a, _ in group_actions]}
        print(f'{prefix}: {len(group_actions)} 个动作 / {len(srcs)} 个文件，源 Lab {np.round(src[0],1)}')
        for aid, count in group_actions:
            for dst in frame_files(prefix, aid, count):
                c = load(SRC / GROUPS[prefix] / dst.parent.name / dst.name)
                rgb, a = grade(c, src, tgt)
                Image.fromarray(np.dstack([rgb, np.clip(a, 0, 1) * 255]).astype(np.uint8), 'RGBA').save(dst, optimize=True)
            log['actions'][aid] = count
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    json.dump(log, open(REPORT, 'w'), indent=1, ensure_ascii=False)
    print(f'调色完成：{len(actions)} 个动作；报告 {REPORT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
