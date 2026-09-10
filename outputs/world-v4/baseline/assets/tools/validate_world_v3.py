"""Build-time asset checks; run before compiling the iOS target."""
from pathlib import Path
import json
from PIL import Image
root=Path(__file__).resolve().parents[2];xc=root/'ios/Maomao/Assets.xcassets'
scene=json.loads((root/'assets/scenes/courtyard-v3/scene.json').read_text())
for item in scene['tiles']+scene['objects']:
 path=root/'ios/Maomao/Resources/WorldTextures'/f"{item['image']}.png"
 assert path.is_file(),path
catalog=json.loads((xc/'cat-actions-v2.dataset/data.json').read_text());count=0
for action in catalog['actions']:
 assert len(action['size'])==2 and all(x>0 for x in action['size'])
 assert 0<action['footY']<=action['size'][1]
 if 'frameDurations' in action:
  assert len(action['frameDurations'])==action['frameCount'] and all(t>0 for t in action['frameDurations'])
 for index in range(1,action['frameCount']+1):
  name=f"{action.get('imagePrefix','cat')}-{action['id']}-{index:02}"
  dirs=list(xc.glob(f'*/{name}.imageset'));assert len(dirs)==1,name
  contents=json.loads((dirs[0]/'Contents.json').read_text())
  files=[x['filename'] for x in contents['images'] if 'filename' in x];assert files,name
  for filename in files:
   with Image.open(dirs[0]/filename) as image:
    assert image.mode=='RGBA',name
    assert image.getchannel('A').getextrema()[0]==0,name
  count+=1
print(f'PASS: {count} action frames, alpha, durations, support anchors; all scene images present')
