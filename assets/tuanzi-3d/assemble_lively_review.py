"""同标尺六视图对照与本轮交付哈希；渲染输入由 review_tuanzi.py 生成。"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs/web-tuanzi-lively-review"
RENDERS = ROOT / "assets/tuanzi-3d/renders"
OUT.mkdir(exist_ok=True)
font = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 24)
small = ImageFont.truetype("/System/Library/Fonts/STHeiti Light.ttc", 18)
canvas = Image.new("RGB", (1440, 1060), (246, 241, 229))
draw = ImageDraw.Draw(canvas)
for row, label in enumerate(("lively-before", "lively-after")):
    for col, (pose, view, caption) in enumerate((("idle", "side", "侧面"), ("idle", "three-quarter", "四分之三"), ("sit_idle", "three-quarter", "坐姿"))):
        src = Image.open(RENDERS / label / f"{pose}-{view}.png").convert("RGBA").resize((480, 480), Image.Resampling.LANCZOS)
        canvas.paste(src, (col*480, row*510+34), src)
        draw.text((col*480+20,row*510+8), ("调整前" if row==0 else "调整后")+" · "+caption, font=font, fill=(79,64,49))
    data=json.loads((RENDERS / label / "metrics.json").read_text())
    (OUT / f"{label}-metrics.json").write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")
draw.text((22,1030),"同机位、同标尺、同灯光的 Blender 渲染；网页细绒另由实时材质绘制。",font=small,fill=(94,81,67))
canvas.save(OUT / "01-轻巧体态前后对照.jpg",quality=91)
src=Image.open(RENDERS / "lively-after/idle-three-quarter.png").convert("RGBA")
hero=Image.new("RGBA",src.size,(246,241,229,255))
hero.alpha_composite(src)
hero.convert("RGB").save(OUT / "02-团子新体态.jpg",quality=94)
paths=["assets/tuanzi-3d/tuanzi.blend","assets/tuanzi-3d/textures/tuanzi_color.png","web/public/models/tuanzi.glb","assets/tuanzi-3d/build_tuanzi.py","web/src/tuanzi/model.ts","web/src/tuanzi/tuanzi.ts"]
receipt={p:{"sha256":hashlib.sha256((ROOT/p).read_bytes()).hexdigest(),"bytes":(ROOT/p).stat().st_size} for p in paths}
(OUT / "artifact-hashes.json").write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+"\n")
