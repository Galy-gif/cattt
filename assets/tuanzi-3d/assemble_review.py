"""把 Blender 同机位渲染拼成前后对照，复制量测并记录最终文件哈希。"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
renders = ROOT / "assets/tuanzi-3d/renders"
out = ROOT / "outputs/web-tuanzi-refinement-review"
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 24)
canvas = Image.new("RGB", (1440, 1040), (246, 241, 229))
draw = ImageDraw.Draw(canvas)
for row, label in enumerate(("before", "after")):
    for col, (pose, view, caption) in enumerate((("idle", "front", "正面"), ("idle", "three-quarter", "四分之三侧"), ("sit_idle", "three-quarter", "坐姿"))):
        image = Image.open(renders / label / f"{pose}-{view}.png").convert("RGBA").resize((480, 480), Image.Resampling.LANCZOS)
        canvas.paste(image, (col * 480, row * 520 + 40), image)
        draw.text((col * 480 + 18, row * 520 + 12), ("优化前" if row == 0 else "优化后") + " · " + caption, font=font, fill=(79, 64, 49))
canvas.save(out / "01-模型与坐姿前后对照.jpg", quality=89)
for label in ("before", "after"):
    data = json.loads((renders / label / "metrics.json").read_text())
    (out / f"{label}-metrics.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
paths = ["assets/tuanzi-3d/tuanzi.blend", "assets/tuanzi-3d/textures/tuanzi_color.png", "web/public/models/tuanzi.glb", "assets/tuanzi-3d/build_tuanzi.py"]
receipt = {p: {"sha256": hashlib.sha256((ROOT / p).read_bytes()).hexdigest(), "bytes": (ROOT / p).stat().st_size} for p in paths}
(out / "artifact-hashes.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
