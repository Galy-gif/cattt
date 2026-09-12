#!/usr/bin/env python3
"""把内置生图结果整理成委托单要求的可验收交付格式。

只做三种确定性操作：统一枢纽／接力格、锁住空满碗的非水区域、把近似洋红背景归一为 #FF00FF。
原始生成结果保留在 Codex generated_images；失败候选保留在 delivery/_rejected。
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / "outputs/frames-v6-delivery"
ATMOSPHERE = ROOT / "outputs/atmosphere-v1-delivery"
CELL = 512


def read_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).copy()


def save_rgb(path, rgb):
    Image.fromarray(rgb.astype(np.uint8), "RGB").save(path)


def copy_cell(source, source_index, target, target_index):
    src = read_rgb(source)
    dst = read_rgb(target)
    sr, sc = divmod(source_index - 1, 3)
    tr, tc = divmod(target_index - 1, 3)
    dst[tr * CELL:(tr + 1) * CELL, tc * CELL:(tc + 1) * CELL] = src[sr * CELL:(sr + 1) * CELL, sc * CELL:(sc + 1) * CELL]
    save_rgb(target, dst)


def cell_nose_y(cell):
    distance = np.sqrt(((cell.astype(float) - [255, 0, 255]) ** 2).sum(axis=-1))
    mask = distance > 80
    ys, xs = np.nonzero(mask)
    right = xs.max()
    return float(np.median(ys[xs >= right - 7]))


def longest_row_run(cell):
    distance = np.sqrt(((cell.astype(float) - [255, 0, 255]) ** 2).sum(axis=-1))
    mask = distance > 80
    best = 0
    for row in mask:
        xs = np.flatnonzero(row)
        if not len(xs):
            continue
        cuts = np.where(np.diff(xs) > 1)[0]
        starts = np.r_[0, cuts + 1]
        ends = np.r_[cuts, len(xs) - 1]
        best = max(best, int(np.max(xs[ends] - xs[starts] + 1)))
    return best


def scale_seated_sheet(path, target_run, target_center_x, target_bottom_y):
    sheet = read_rgb(path)
    first = sheet[:CELL, :CELL]
    current_run = longest_row_run(first)
    scale = target_run / max(1, current_run)
    if abs(scale - 1) <= 0.04:
        return
    result = np.full_like(sheet, [255, 0, 255])
    for index in range(6):
        row, column = divmod(index, 3)
        y0, x0 = row * CELL, column * CELL
        cell = sheet[y0:y0 + CELL, x0:x0 + CELL]
        distance = np.sqrt(((cell.astype(float) - [255, 0, 255]) ** 2).sum(axis=-1))
        mask = distance > 80
        ys, xs = np.nonzero(mask)
        crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        resized = np.asarray(Image.fromarray(crop).resize(
            (max(1, round(crop.shape[1] * scale)), max(1, round(crop.shape[0] * scale))),
            Image.Resampling.LANCZOS,
        ))
        left = round(target_center_x - resized.shape[1] / 2)
        top = round(target_bottom_y - resized.shape[0] + 1)
        result[y0 + top:y0 + top + resized.shape[0], x0 + left:x0 + left + resized.shape[1]] = resized
    save_rgb(path, result)


def align_drink_cells():
    d1 = read_rgb(FRAMES / "D1-drink-down/D1-drink-down__r1.png")
    target_y = cell_nose_y(d1[CELL:2 * CELL, 2 * CELL:3 * CELL])
    for name, indices in (("D2-drink-lap", range(1, 7)), ("D3-drink-up", (1,))):
        path = FRAMES / name / f"{name}__r1.png"
        sheet = read_rgb(path)
        for index in indices:
            row, column = divmod(index - 1, 3)
            y0, x0 = row * CELL, column * CELL
            cell = sheet[y0:y0 + CELL, x0:x0 + CELL].copy()
            shift = int(round(target_y - cell_nose_y(cell)))
            if shift == 0:
                continue
            moved = np.full_like(cell, [255, 0, 255])
            if shift > 0:
                moved[shift:] = cell[:-shift]
            else:
                moved[:shift] = cell[-shift:]
            sheet[y0:y0 + CELL, x0:x0 + CELL] = moved
        save_rgb(path, sheet)


def normalize_magenta(path):
    rgb = read_rgb(path)
    border = np.concatenate([
        rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3),
        rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3),
    ])
    bg = np.median(border.astype(float), axis=0)
    distance = np.sqrt(((rgb.astype(float) - bg) ** 2).sum(axis=-1))
    visibly_magenta = (rgb[..., 0] > 175) & (rgb[..., 2] > 175) & (rgb[..., 1] < 150)
    rgb[(distance <= 80) | visibly_magenta] = [255, 0, 255]
    save_rgb(path, rgb)


def lock_bowl_nonwater():
    empty_path = ATMOSPHERE / "P1-bowl-empty/P1-bowl-empty__r1.png"
    full_path = ATMOSPHERE / "P2-bowl-full/P2-bowl-full__r1.png"
    empty = read_rgb(empty_path)
    full = read_rgb(full_path)
    yy, xx = np.ogrid[:1024, :1024]
    water = ((xx - 512) / 390) ** 2 + ((yy - 395) / 175) ** 2 <= 1
    full[~water] = empty[~water]
    save_rgb(full_path, full)


def main():
    hub = ROOT / "outputs/frames-v5-delivery/N4-settle/N4-settle__r1.png"
    hub_rgb = read_rgb(hub)[0:CELL, 2 * CELL:3 * CELL]
    hub_distance = np.sqrt(((hub_rgb.astype(float) - [255, 0, 255]) ** 2).sum(axis=-1))
    hub_mask = hub_distance > 80
    hub_y, hub_x = np.nonzero(hub_mask)
    target_run = longest_row_run(hub_rgb)
    target_center_x = (hub_x.min() + hub_x.max()) / 2
    target_bottom_y = hub_y.max()
    for name in ("H1-sit-look", "H2-head-tilt", "H3-groom", "M1-happy", "M2-sulk", "M3-sad"):
        scale_seated_sheet(FRAMES / name / f"{name}__r1.png", target_run, target_center_x, target_bottom_y)
    for name in ("H2-head-tilt", "H3-groom", "M3-sad"):
        copy_cell(hub, 3, FRAMES / name / f"{name}__r1.png", 1)
    copy_cell(hub, 3, FRAMES / "H1-sit-look/H1-sit-look__r1.png", 1)
    copy_cell(
        FRAMES / "D1-drink-down/D1-drink-down__r1.png", 6,
        FRAMES / "D2-drink-lap/D2-drink-lap__r1.png", 1,
    )
    lock_bowl_nonwater()
    for path in FRAMES.glob("*/*.png"):
        if "_rejected" not in path.parts:
            normalize_magenta(path)
    for path in ATMOSPHERE.glob("[PS]*/*.png"):
        normalize_magenta(path)
    align_drink_cells()


if __name__ == "__main__":
    main()
