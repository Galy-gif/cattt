#!/usr/bin/env python3
"""院子氛围 v1 收图验收：清点、哈希、格式、物件与氛围指纹。"""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
DELIVERY = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "outputs/atmosphere-v1-delivery"
OUT = ROOT / "outputs/atmosphere-v1-review"
A_IDS = ["A1-dusk", "A2-evening", "A3-night", "A4-rain"]
PROP_IDS = ["P1-bowl-empty", "P2-bowl-full", "S1-sun", "S2-moon", "S3-stars", "S4-raincloud-a", "S4-raincloud-b", "S5-window-lit"]
IDS = A_IDS + PROP_IDS


def load_rig():
    spec = importlib.util.spec_from_file_location("rig", ROOT / "assets/tools/intake_rig_v1.py")
    module = importlib.util.module_from_spec(spec)
    old = sys.argv
    sys.argv = [old[0]]
    spec.loader.exec_module(module)
    sys.argv = old
    return module


rig = load_rig()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def key_mask(rgb):
    border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
    bg = np.median(border.astype(float), axis=0)
    distance = np.sqrt(((rgb.astype(float) - bg) ** 2).sum(axis=-1))
    return distance > 70, bg


def hue_angle(lab_pixels):
    a = float(np.median(lab_pixels[:, 1]))
    b = float(np.median(lab_pixels[:, 2]))
    return float(np.degrees(np.arctan2(b, a)) % 360)


def angle_distance(a, b):
    return abs((a - b + 180) % 360 - 180)


def atmosphere_metrics(rgb):
    hsv_h, hsv_s, _ = rig.hsv(rgb)
    lab = rig.srgb_to_lab(rgb)
    cat_roi = np.zeros(rgb.shape[:2], bool)
    cat_roi[980:1235, 270:470] = True
    cat = cat_roi & (hsv_h >= 8) & (hsv_h <= 48) & (hsv_s >= 0.35)
    ground_roi = np.zeros(rgb.shape[:2], bool)
    ground_roi[960:1290, 225:515] = True
    ground = ground_roi & ~rig.dilate(cat, 18) & (hsv_h >= 45) & (hsv_h <= 170)
    sky = np.zeros(rgb.shape[:2], bool)
    sky[180:640, 80:740] = True
    cat_h = hue_angle(lab[cat])
    ground_h = hue_angle(lab[ground])
    sky_h = hue_angle(lab[sky])
    return {
        "cat_pixels": int(cat.sum()),
        "ground_pixels": int(ground.sum()),
        "cat_ground_hue_angle_deg": round(angle_distance(cat_h, ground_h), 1),
        "cat_sky_hue_angle_deg": round(angle_distance(cat_h, sky_h), 1),
        "cat_L_median": round(float(np.median(lab[..., 0][cat])), 1),
        "ground_L_median": round(float(np.median(lab[..., 0][ground])), 1),
        "saturation_median": round(float(np.median(hsv_s)), 3),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.load(open(DELIVERY / "delivery.json"))
    items = {item["id"]: item for item in manifest["items"]}
    report = {"delivery": str(DELIVERY), "gates": {}, "items": {}, "bowl_pair": {}}

    inventory = [f"缺清单条目 {item}" for item in IDS if item not in items]
    inventory += [f"未知清单条目 {item}" for item in items if item not in IDS]
    listed = {item["file"] for item in items.values() if item.get("file")}
    on_disk = {str(p.relative_to(DELIVERY)) for p in DELIVERY.rglob("*.png") if "_rejected" not in p.parts}
    inventory += [f"多出文件 {p}" for p in sorted(on_disk - listed)]
    inventory += [f"清单文件不存在 {p}" for p in sorted(listed - on_disk)]
    report["gates"]["1_inventory"] = inventory

    rig.DELIVERY = DELIVERY
    history = rig.build_registry()
    hash_fails = []
    seen = {}
    for item_id, item in items.items():
        digest = sha256(DELIVERY / item["file"])
        if item.get("sha256") != digest:
            hash_fails.append(f"{item_id}: 清单哈希不符")
        if digest in history:
            hash_fails.append(f"{item_id}: 撞历史素材 {history[digest]}")
        if digest in seen:
            hash_fails.append(f"{item_id}: 与 {seen[digest]} 重复")
        seen[digest] = item_id
    report["gates"]["2_hash"] = hash_fails

    format_fails = []
    prop_images = {}
    prop_masks = {}
    for item_id in IDS:
        im = Image.open(DELIVERY / items[item_id]["file"])
        rgb = np.asarray(im.convert("RGB"))
        expected = (828, 1800) if item_id in A_IDS else (1024, 1024)
        entry = {"size": list(im.size), "mode": im.mode, "fails": []}
        if im.size != expected:
            entry["fails"].append(f"画布 {im.size}，应为 {expected}")
        if item_id in PROP_IDS:
            mask, bg = key_mask(rgb)
            exact = np.all(rgb == [255, 0, 255], axis=-1)
            exact_background_share = float(exact[~mask].mean())
            areas, _ = rig.components(mask, min_area=80, step=2)
            entry.update({
                "background_border_rgb": [round(float(v), 1) for v in bg],
                "exact_FF00FF_share": round(exact_background_share, 4),
                "components_over_80px": len(areas),
            })
            expected_components = 5 if item_id == "S3-stars" else 1
            if len(areas) != expected_components:
                entry["fails"].append(f"主体连通块 {len(areas)}，应为 {expected_components}")
            if exact_background_share < 0.99:
                entry["fails"].append("背景不是纯 #FF00FF 平涂")
            prop_images[item_id] = rgb
            prop_masks[item_id] = mask
        else:
            entry["atmosphere"] = atmosphere_metrics(rgb)
        report["items"][item_id] = entry
        format_fails += [f"{item_id}: {failure}" for failure in entry["fails"]]
    report["gates"]["3_format"] = format_fails

    content_fails = []
    p1, p2 = prop_images["P1-bowl-empty"], prop_images["P2-bowl-full"]
    m1, m2 = prop_masks["P1-bowl-empty"], prop_masks["P2-bowl-full"]
    outline_iou = float((m1 & m2).sum() / max(1, (m1 | m2).sum()))
    water = np.zeros(m1.shape, bool)
    yy, xx = np.ogrid[:1024, :1024]
    water[((xx - 512) / 390) ** 2 + ((yy - 395) / 175) ** 2 <= 1] = True
    object_region = rig.dilate(m1 | m2, 4)
    outside = object_region & ~water
    delta = np.sqrt(((p1.astype(float) - p2.astype(float)) ** 2).sum(axis=-1))
    changed_share = float((delta[outside] > 18).mean())
    report["bowl_pair"] = {"silhouette_iou": round(outline_iou, 4), "changed_share_outside_water": round(changed_share, 4)}
    if outline_iou < 0.90:
        content_fails.append(f"空满碗轮廓 IoU {outline_iou:.3f} < 0.90")
    if changed_share > 0.03:
        content_fails.append(f"空满碗水面外变化 {changed_share * 100:.1f}% > 3%")

    for item_id in A_IDS:
        metrics = report["items"][item_id]["atmosphere"]
        if metrics["cat_ground_hue_angle_deg"] < 60:
            content_fails.append(f"{item_id}: 团子与地面色相角距 {metrics['cat_ground_hue_angle_deg']}° < 60°")
    night = report["items"]["A3-night"]["atmosphere"]
    if night["cat_L_median"] - night["ground_L_median"] < 15:
        content_fails.append(f"A3-night: 团子比地面仅亮 {night['cat_L_median'] - night['ground_L_median']:.1f} L* < 15")
    dusk = report["items"]["A1-dusk"]["atmosphere"]
    if dusk["cat_sky_hue_angle_deg"] < 25:
        content_fails.append(f"A1-dusk: 团子与天空色相角距 {dusk['cat_sky_hue_angle_deg']}° < 25°")
    ref = np.asarray(Image.open(ROOT / "assets/scenes/atmosphere-v1/refs/R-home-screenshot.jpg").convert("RGB"))
    ref_sat = float(np.median(rig.hsv(ref)[1]))
    rain_sat = report["items"]["A4-rain"]["atmosphere"]["saturation_median"]
    report["rain_saturation"] = {"reference": round(ref_sat, 3), "rain": rain_sat}
    if rain_sat >= ref_sat:
        content_fails.append(f"A4-rain: 饱和度中位数 {rain_sat:.3f} 未低于白天 {ref_sat:.3f}")

    report["gates"]["4_content_fingerprint"] = content_fails
    report["gates"]["5_human"] = ["数字关完成后由用户确认氛围与物件美术观感；当前仅记录模型自检。"]
    json.dump(report, open(OUT / "intake-report.json", "w"), ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
