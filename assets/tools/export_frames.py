#!/usr/bin/env python3
"""把 frames/manifest.json 的 48 帧导成 Xcode imageset（@2x/@3x）+ cat-actions.json。

用法：
    python3 export_frames.py --frames ../tuanzi/felt-world-pack-v1/frames \
        --xcassets ../../ios/Maomao/Assets.xcassets [--cat-pt 76]

尺寸约定：走路帧可见高中位 = `--cat-pt` 逻辑点（参考屏 390×844），其它动作按 manifest 的
scale 联动；同一动作六帧同画布，脚底同一行。@3x 若需上采样会打印警告并照做（只有奔跑帧
源分辨率略不够，≤ 1.1×）。

`cat-actions.dataset`（NSDataAsset）给 Swift 读：帧数、fps、循环方式、画布 pt、脚底 pt、身长 pt。
放进 asset catalog 而不是单独的 Resources/，是因为 generate_project.py 只收 .swift 和 .xcassets。
"""
import argparse
import json
import shutil
from pathlib import Path

from PIL import Image

STRIDE = {"walk": 1.0, "run": 1.6}   # 一个循环走几个身长，代码里用来把帧率锁到速度


def contents(files: dict[int, str]) -> dict:
    images = []
    for scale in (1, 2, 3):
        entry = {"idiom": "universal", "scale": f"{scale}x"}
        if scale in files:
            entry["filename"] = files[scale]
        images.append(entry)
    return {"images": images, "info": {"version": 1, "author": "xcode"}}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", type=Path, required=True)
    ap.add_argument("--xcassets", type=Path, required=True)
    ap.add_argument("--cat-pt", type=float, default=76.0)
    args = ap.parse_args()

    manifest = json.loads((args.frames / "manifest.json").read_text())
    walk = next(a for a in manifest["actions"] if a["id"] == "walk")
    k_walk = args.cat_pt / walk["height_median"]      # pt / 源像素（走路）

    cat_dir = args.xcassets / "cat"
    if cat_dir.exists():
        shutil.rmtree(cat_dir)
    cat_dir.mkdir(parents=True)
    (cat_dir / "Contents.json").write_text(json.dumps({"info": {"version": 1, "author": "xcode"}}, indent=2))

    spec = {"referenceScreen": [390, 844], "catPt": args.cat_pt, "actions": []}
    print("动作 | 画布 pt | 脚底 pt | 身长 pt | @3x 倍率")
    for act in manifest["actions"]:
        k = k_walk * act["scale"]
        cw, ch = act["canvas"]
        size_pt = (round(cw * k), round(ch * k))
        foot_pt = round(act["foot_row"] * k, 1)
        widths = sorted(f["width"] for f in act["frames"])
        body_pt = round(widths[len(widths) // 2] * k, 1)
        up3 = size_pt[1] * 3 / ch
        flag = f"{up3:.2f}" + ("  !! 上采样" if up3 > 1.0 else "")
        print(f"{act['id']:12s} | {size_pt[0]}×{size_pt[1]} | {foot_pt} | {body_pt} | {flag}")
        for i, f in enumerate(act["frames"], start=1):
            src = Image.open(args.frames / act["id"] / f["file"]).convert("RGBA")
            name = f"cat-{act['id']}-{i:02d}"
            iset = cat_dir / f"{name}.imageset"
            iset.mkdir()
            files = {}
            for scale in (2, 3):
                target = (size_pt[0] * scale, size_pt[1] * scale)
                im = src.resize(target, Image.LANCZOS)
                fname = f"{name}@{scale}x.png"
                im.save(iset / fname, optimize=True)
                files[scale] = fname
            (iset / "Contents.json").write_text(json.dumps(contents(files), indent=2))
        spec["actions"].append({
            "id": act["id"], "name": act["name"],
            "frameCount": len(act["frames"]), "fps": act["fps"], "loop": act["loop"],
            "size": list(size_pt), "footY": foot_pt, "bodyLength": body_pt,
            "stride": STRIDE.get(act["id"]),
            "hitInset": round(min(size_pt) * 0.08),
        })

    dataset = args.xcassets / "cat-actions.dataset"
    dataset.mkdir(exist_ok=True)
    (dataset / "cat-actions.json").write_text(json.dumps(spec, ensure_ascii=False, indent=2))
    (dataset / "Contents.json").write_text(json.dumps({
        "data": [{"idiom": "universal", "filename": "cat-actions.json"}],
        "info": {"version": 1, "author": "xcode"},
    }, indent=2))
    print("→", dataset)


if __name__ == "__main__":
    main()
