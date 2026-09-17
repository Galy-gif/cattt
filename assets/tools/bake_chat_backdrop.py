"""聊天页院子底：把整幅院子（地面瓦片＋蘑菇屋、树、猫窝、栅栏等物件）拼成一张全景，烘好虚化，放进资产目录。

聊天页按团子所在地点的 cameraX 左右取景（ChatBackground.swift），所以烘的是整幅，不是一条竖图。
亮窗、碗里的水这类随状态出现的件不烘进去；猫也不烘。

院子美术换版后重跑：python3 assets/tools/bake_chat_backdrop.py
方案见 docs/specs/聊天页院子底-实现方案-2026-09-16.md。雾层不在这里，在 ChatBackground.swift。
"""
import json
import pathlib
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCENE = ROOT / "assets/scenes/courtyard-v4/scene.json"
TILES = ROOT / "ios/Maomao/Resources/WorldTextures"
OUT = ROOT / "ios/Maomao/Assets.xcassets/chat-backdrop.imageset"

OUT_H = 2622                   # iPhone 17 Pro 3x 的屏高；宽度按院子比例推出
BLUR_PT = 12                   # 屏上等效高斯半径（pt），能认出池塘、树和屋子的轮廓
SCALE = 3


def world_rect(obj, by_id):
    r = obj["rect"]
    parent = obj.get("parent")
    if not parent:
        return r
    p = world_rect(by_id[parent], by_id)
    return {"x": p["x"] + r["x"] * p["width"], "y": p["y"] + r["y"] * p["height"],
            "width": r["width"] * p["width"], "height": r["height"] * p["height"]}


def main() -> None:
    scene = json.loads(SCENE.read_text())
    ww, wh = scene["width"], scene["height"]
    out_w = round(OUT_H * ww / wh)
    k = out_w / ww

    world = Image.new("RGBA", (out_w, OUT_H))
    for tile in scene["tiles"]:
        r = tile["rect"]
        box = (round(r["x"] * out_w), round(r["y"] * OUT_H),
               round((r["x"] + r["width"]) * out_w), round((r["y"] + r["height"]) * OUT_H))
        im = Image.open(TILES / f"{tile['image']}.png").convert("RGBA")
        world.paste(im.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS), box[:2])

    by_id = {o["id"]: o for o in scene["objects"]}
    for obj in sorted(scene["objects"], key=lambda o: o["depth"]):
        if obj.get("visibility"):
            continue
        r = world_rect(obj, by_id)
        im = Image.open(TILES / f"{obj['image']}.png").convert("RGBA")
        src = obj.get("sourceRect")
        if src:
            iw, ih = im.size
            im = im.crop((round(src["x"] * iw), round(src["y"] * ih),
                          round((src["x"] + src["width"]) * iw), round((src["y"] + src["height"]) * ih)))
        w, h = max(1, round(r["width"] * out_w)), max(1, round(r["height"] * OUT_H))
        im = im.resize((w, h), Image.LANCZOS)
        world.alpha_composite(im, (round(r["x"] * out_w), round(r["y"] * OUT_H)))

    img = world.convert("RGB")
    # 虚化前外扩边缘，避免四边被黑边渗进来。
    pad = BLUR_PT * SCALE * 3
    padded = Image.new("RGB", (out_w + pad * 2, OUT_H + pad * 2))
    padded.paste(img.resize(padded.size), (0, 0))
    padded.paste(img, (pad, pad))
    img = padded.filter(ImageFilter.GaussianBlur(BLUR_PT * SCALE)).crop((pad, pad, pad + out_w, pad + OUT_H))

    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / "chat-backdrop.jpg", quality=84, optimize=True, progressive=True)
    (OUT / "Contents.json").write_text(json.dumps({
        "images": [{"idiom": "universal", "filename": "chat-backdrop.jpg"}],
        "info": {"version": 1, "author": "xcode"},
    }, indent=2) + "\n")
    print(f"panorama {out_w}x{OUT_H}; wrote {OUT / 'chat-backdrop.jpg'} "
          f"{(OUT / 'chat-backdrop.jpg').stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
