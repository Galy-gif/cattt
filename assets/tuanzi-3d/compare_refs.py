"""3D 渲染与 R3 侧面站姿的剪影对比（方案第 6 节"身份比例"）。

用法（仓库根目录，系统 python3，需要 Pillow 和 numpy）：
    python3 assets/tuanzi-3d/compare_refs.py <渲染标签> [输出目录]

读 assets/tuanzi-3d/renders/<标签>-side.png，按"地面到最高点"的高度缩放到与 R3 同高、脚底对齐、
头前沿对齐，输出叠影图和几项比例。红 = 只有 R3 有，蓝 = 只有 3D 有，灰 = 重合。

R3 是走路中间帧、3D 是站姿，腿部差异是预期内的；比例只量腿以上的部分。
"""

import json
import os
import sys

import numpy as np
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
R3 = os.path.join(REPO, "assets/tuanzi/frames-v5/refs/R3-cat-side-standing.png")


def r3_mask():
    a = np.asarray(Image.open(R3).convert("RGB")).astype(int)
    return ~((a[..., 0] > 200) & (a[..., 1] < 80) & (a[..., 2] > 200))


def render_mask(path):
    a = np.asarray(Image.open(path).convert("RGBA"))
    return a[..., 3] > 128


def crop(mask):
    ys, xs = np.nonzero(mask)
    return mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def measure(mask):
    """mask 已裁到包围盒，头朝右。返回与总高相除的几项比例。"""
    h, w = mask.shape
    rows_from_ground = lambda row: (h - 1 - row) / h
    # 屁股后沿：离地 30% 高度那一行最左的像素（尾巴在更高处，腿在更低处）
    row = int(h * 0.70)
    rump = int(np.argmax(mask[row]))
    front = w - 1
    length = front - rump
    # 背高：屁股到头前沿 40% 处那一列最高点
    col = rump + int(length * 0.40)
    back = rows_from_ground(int(np.argmax(mask[:, col])))
    # 下巴：最右 10% 长度内的最低点（再往后会碰到前爪）
    head_cols = mask[:, front - int(length * 0.10):]
    head_rows = np.nonzero(head_cols.any(axis=1))[0]
    chin = rows_from_ground(head_rows.max())
    # 肚子：屁股到头前沿 30%–70% 之间，从背往下第一段身体的末端。
    # R3 的毛糙描边里有细缝，小于总高 3% 的缝当作连着
    gap = max(2, int(h * 0.03))
    bellies = []
    for c in range(rump + int(length * 0.30), rump + int(length * 0.70)):
        rows = np.nonzero(mask[:, c])[0]
        if len(rows) == 0:
            continue
        end = rows[0]
        for r in rows[1:]:
            if r - end > gap:
                break
            end = r
        bellies.append(rows_from_ground(end))
    return {
        "长／高": length / h,
        "背高／高": back,
        "下巴离地／高": chin,
        "肚子离地／高": float(np.max(bellies)),
    }


def main():
    tag = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(REPO, "assets/tuanzi-3d/renders")
    ref = crop(r3_mask())
    ours = crop(render_mask(os.path.join(REPO, f"assets/tuanzi-3d/renders/{tag}-side.png")))

    scale = ref.shape[0] / ours.shape[0]
    resized = np.asarray(Image.fromarray(ours.astype(np.uint8) * 255).resize(
        (max(1, round(ours.shape[1] * scale)), ref.shape[0]), Image.NEAREST)) > 127

    width = max(ref.shape[1], resized.shape[1])
    canvas_ref = np.zeros((ref.shape[0], width), bool)
    canvas_ours = np.zeros((ref.shape[0], width), bool)
    canvas_ref[:, width - ref.shape[1]:] = ref  # 头前沿对齐（右对齐）
    canvas_ours[:, width - resized.shape[1]:] = resized

    both = canvas_ref & canvas_ours
    iou = both.sum() / (canvas_ref | canvas_ours).sum()
    image = np.full((ref.shape[0], width, 3), 255, np.uint8)
    image[canvas_ref & ~canvas_ours] = (220, 60, 50)
    image[canvas_ours & ~canvas_ref] = (60, 110, 220)
    image[both] = (170, 170, 170)
    Image.fromarray(image).save(os.path.join(out_dir, f"{tag}-side-overlay.png"))

    m_ref, m_ours = measure(ref), measure(ours)
    report = {"IoU": round(float(iou), 3), "比例": {}}
    for key in m_ref:
        diff = (m_ours[key] - m_ref[key]) / m_ref[key]
        report["比例"][key] = {"R3": round(m_ref[key], 3), "3D": round(m_ours[key], 3), "相差": f"{diff:+.1%}"}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
