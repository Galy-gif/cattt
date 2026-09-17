"""信箱 v2（P1 r2，用户 2026-09-16 确认造型材质）整理成运行时贴图。

近似洋红底 → 真 alpha（边缘去洋红溢色）→ 等比放进旧信箱同尺寸画布 540×1010：
可见高度、落地行、立杆水平中心都与 world-v5-mailbox 一致，场景里 mailbox 的 rect/hitRect 不用改。
源图不改动；输出 ios/Maomao/Resources/WorldTextures/world-v7-mailbox.png。
"""
import hashlib, json, sys
import numpy as np
from PIL import Image

SRC = "outputs/mailbox-v2-delivery/P1-mailbox/P1-mailbox__r2.png"
OUT = "ios/Maomao/Resources/WorldTextures/world-v7-mailbox.png"
CANVAS = (540, 1010)
# 旧贴图 world-v5-mailbox 实测：不透明区 y 282..994，立杆中心 x=270。
OLD_TOP, OLD_BOTTOM, POST_X = 282, 994, 270

src = Image.open(SRC).convert("RGB")
sha = hashlib.sha256(open(SRC, "rb").read()).hexdigest()
assert sha.startswith("508b5397e892"), f"源图 SHA 不符：{sha}"
a = np.asarray(src).astype(np.float32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
magenta = np.minimum(R, B) - G              # 纯洋红≈245，橙红毡≈0 以下，木头更低
alpha = np.clip((170 - magenta) / 80, 0, 1)  # ≥170 全透明，≤90 全不透明
spill = np.clip(np.minimum(R, B) - G, 0, None) * (1 - alpha)
a[..., 0] -= spill; a[..., 2] -= spill
rgba = np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)
img = Image.fromarray(rgba, "RGBA")

ys, xs = np.nonzero(alpha > 0.5)
top, bottom = ys.min(), ys.max()
post = np.nonzero(alpha[bottom - int(0.2 * (bottom - top)):bottom] .max(0) > 0.5)[0]
post_x = (post.min() + post.max()) / 2
scale = (OLD_BOTTOM - OLD_TOP) / (bottom - top)
w, h = round(src.width * scale), round(src.height * scale)
small = img.resize((w, h), Image.LANCZOS)
ox, oy = round(POST_X - post_x * scale), round(OLD_BOTTOM - bottom * scale)
canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
canvas.alpha_composite(small, (ox, oy)) if ox >= 0 and oy >= 0 else canvas.paste(small, (ox, oy), small)
canvas.save(OUT, optimize=True)

def to_canvas(x, y): return ((x * scale + ox) / CANVAS[0], (y * scale + oy) / CANVAS[1])
report = {
    "source": SRC, "source_sha256": sha, "output": OUT,
    "output_sha256": hashlib.sha256(open(OUT, "rb").read()).hexdigest(),
    "source_bbox": [int(xs.min()), int(top), int(xs.max()), int(bottom)],
    "scale": round(scale, 4), "offset": [ox, oy],
    # 以下两点在源图上人工标注（投信口开口中心、右侧旗座上沿中心），换算到画布归一化坐标供场景配置用。
    "slot_center": [round(v, 3) for v in to_canvas(405, 385)],
    "flag_mount": [round(v, 3) for v in to_canvas(772, 312)],
}
print(json.dumps(report, ensure_ascii=False, indent=1))
