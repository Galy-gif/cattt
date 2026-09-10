"""Reuse existing RGBA assets and layout; measure, never recolour the generated plate."""
from pathlib import Path
import colorsys
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent


def lightness(rgb):
    srgb = np.asarray(rgb, dtype=float) / 255
    linear = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    y = linear @ np.array([.2126, .7152, .0722])
    f = np.where(y > 216 / 24389, np.cbrt(y), (24389 / 27 * y + 16) / 116)
    return 116 * f - 16


REGIONS = {
    'sky': [40, 40, 450, 190],
    'far_hills': [40, 530, 180, 570],
    'mid_hills': [40, 620, 180, 660],
    'treeline': [40, 710, 180, 750],
    'ground_far': [50, 800, 160, 850],
    'ground_mid': [400, 1050, 620, 1150],
    'ground_near': [380, 1670, 650, 1780],
    'pond': [30, 1330, 180, 1450],
    'roof': [275, 715, 310, 740],
}


def measure(im, samples=False):
    rgb = np.asarray(im.convert('RGB'))
    hsv = np.asarray(im.convert('HSV'))
    report = {
        'dark_Lstar_below_60_percent': round(float((lightness(rgb) < 60).mean() * 100), 3),
        'coral_family_percent': round(float(((hsv[:, :, 0] < 30 * 255 / 360) &
                                           (hsv[:, :, 1] > 65) & (hsv[:, :, 2] > 100)).mean() * 100), 3),
    }
    if samples:
        report['regions'] = {}
        for name, (x1, y1, x2, y2) in REGIONS.items():
            area = rgb[y1:y2, x1:x2]
            median = np.median(area.reshape(-1, 3), axis=0)
            report['regions'][name] = {
                'box': [x1, y1, x2, y2],
                'median_rgb': median.astype(int).tolist(),
                'median_hex': '#' + ''.join(f'{int(v):02X}' for v in median),
                'median_Lstar': round(float(np.median(lightness(area))), 2),
                'median_encoded_Y8': round(float(np.median(area @ np.array([.2126, .7152, .0722]))), 2),
                'median_colour_hue_degrees': round(float(colorsys.rgb_to_hsv(*(median / 255))[0] * 360), 2),
            }
    return report


def main():
    original = json.loads((PREVIOUS / 'layers.json').read_text())
    config = json.loads(json.dumps(original))
    for layer in config['layers']:
        layer['file'] = '../' + layer['file']
    (HERE / 'layers.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    plate = Image.open(HERE / config['background']).convert('RGBA')
    assert plate.size == tuple(config['canvas'])
    im = plate.copy()
    hashes = {}
    for layer in sorted(config['layers'], key=lambda v: v['z']):
        path = HERE / layer['file']
        hashes[layer['id']] = hashlib.sha256(path.read_bytes()).hexdigest()
        obj = Image.open(path).convert('RGBA')
        if layer['scale'] != 1:
            obj = obj.resize(tuple(round(v * layer['scale']) for v in obj.size), Image.Resampling.LANCZOS)
        x, y = layer['x'], layer['y']
        w, h = obj.size
        assert x >= 0 and x + w <= im.width and y >= config['safe_top'] and y + h <= config['safe_bottom']
        s = layer['shadow']
        if s['opacity']:
            shadow = Image.new('RGBA', im.size)
            ImageDraw.Draw(shadow).ellipse((x + w * .15 + s['offset'][0], y + h - s['height'] / 2 + s['offset'][1],
                                          x + w * .85 + s['offset'][0], y + h + s['height'] / 2 + s['offset'][1]),
                                         fill=(73, 71, 58, s['opacity']))
            im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(s['blur'])))
        im.alpha_composite(obj, (x, y))
    im.save(HERE / '5b-companion-home.png')
    old = Image.open(PREVIOUS / '5b-companion-home.png').convert('RGB')
    comparison = Image.new('RGB', (im.width * 2, im.height))
    comparison.paste(old, (0, 0))
    comparison.paste(im.convert('RGB'), (im.width, 0))
    comparison.save(HERE / 'before-after.png')
    sampled = plate.copy()
    draw = ImageDraw.Draw(sampled)
    for name, box in REGIONS.items():
        draw.rectangle(box, outline='#333333', width=2)
        draw.text((box[0] + 2, box[1] + 2), name, fill='#111111')
    sampled.save(HERE / 'sample-regions.png')
    before_bg = measure(Image.open(PREVIOUS / '5a-background-plate.png'), True)
    after_bg = measure(plate, True)
    regions = after_bg['regions']
    pairs = [('far_hills', 'mid_hills'), ('mid_hills', 'treeline'), ('ground_far', 'ground_mid'), ('ground_mid', 'ground_near')]
    deltas = {f'{a} → {b}': round(regions[a]['median_Lstar'] - regions[b]['median_Lstar'], 2) for a, b in pairs}
    qa = {
        'method': 'sRGB D65 CIELAB L* (0–100); encoded Y8=0.2126R+0.7152G+0.0722B (0–255); region medians, no semantic segmentation.',
        'canvas': list(im.size), 'unchanged_layout_and_asset_hashes': hashes,
        'foreground_layer_count': len(config['layers']),
        'top_and_bottom_safety_unchanged': bool(np.array_equal(np.asarray(im)[:148], np.asarray(plate)[:148]) and np.array_equal(np.asarray(im)[1622:], np.asarray(plate)[1622:])),
        'before_background': before_bg, 'after_background': after_bg,
        'before_composite': measure(old), 'after_composite': measure(im),
        'adjacent_sample_Lstar_deltas': deltas,
        'checks': {
            'all_three_ground_regions_blue_ge185': all(regions[k]['median_rgb'][2] >= 185 for k in ['ground_far', 'ground_mid', 'ground_near']),
            'background_dark_percent_8_to15': 8 <= after_bg['dark_Lstar_below_60_percent'] <= 15,
            'all_sample_plane_deltas_ge12': all(v >= 12 for v in deltas.values()),
            'pond_hue_cyan_blue_175_to220': 175 <= regions['pond']['median_colour_hue_degrees'] <= 220,
            'ground_monotonically_darker': regions['ground_far']['median_Lstar'] > regions['ground_mid']['median_Lstar'] > regions['ground_near']['median_Lstar'],
            'sky_encoded_Y8_ge235': regions['sky']['median_encoded_Y8'] >= 235,
        },
    }
    (HERE / 'qa.json').write_text(json.dumps(qa, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(qa, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
