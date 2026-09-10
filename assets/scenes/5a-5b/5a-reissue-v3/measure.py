"""Read-only image QA; writes measurements, never edits the generated image."""
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('qa', HERE.parent / 'scene-5ab/palette-a-v2/recompose.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
qa.REGIONS = {
    'sky': [30, 30, 220, 200],
    'far_hills': [30, 510, 110, 540],
    'mid_hills': [30, 575, 110, 600],
    'treeline': [400, 715, 510, 790],
    'ground_far': [370, 890, 500, 960],
    'ground_mid': [400, 1150, 600, 1250],
    'ground_near': [380, 1660, 650, 1770],
    'pond': [30, 1240, 180, 1310],
}
filename = sys.argv[1] if len(sys.argv) > 1 else '5a-background-plate.png'
im = Image.open(HERE / filename)
report = qa.measure(im, True)
report['canvas'] = list(im.size)
report['method'] = 'CIELAB L* D65 0–100; fixed-region median RGB and HSV hue. Region selection is approximate, not semantic segmentation.'
r = report['regions']
pairs = [('far_hills', 'mid_hills'), ('mid_hills', 'treeline'), ('ground_far', 'ground_mid'), ('ground_mid', 'ground_near')]
report['adjacent_Lstar_deltas'] = {f'{a} -> {b}': round(r[a]['median_Lstar'] - r[b]['median_Lstar'], 2) for a,b in pairs}
report['pond_ground_hue_distances'] = {k: round(abs(r['pond']['median_colour_hue_degrees'] - r[k]['median_colour_hue_degrees']), 2) for k in ['ground_far','ground_mid','ground_near']}
report['house_visual_bbox_approx'] = [32, 589, 352, 933]
report['house_height_percent_approx'] = round(344 / im.height * 100, 2)
report['visual_limits'] = ['Some tree canopy intrudes into upper 8% quiet zone.', 'No cat or loose prop added; hanging nest is empty.', 'Corrected version has visible horizontal lawn bands and a small contact shadow beneath the nest; first version retains broad lawn texture.']
(HERE / (Path(filename).stem + '-qa.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
