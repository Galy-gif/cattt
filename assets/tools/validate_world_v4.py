"""Validate packaged metadata, references, alpha, source identity, and build-bundle resources."""
import json, pathlib, subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
scene=json.loads((root/'assets/scenes/courtyard-v4/scene.json').read_text())
cat=json.loads((root/'ios/Maomao/Assets.xcassets/cat-actions-v2.dataset/data.json').read_text())
from PIL import Image
count=0
for a in cat['actions']:
 prefix=a.get('imagePrefix','cat')
 assert len(a.get('frameDurations',[1]*a['frameCount']))==a['frameCount'],a['id']
 for i in range(1,a['frameCount']+1):
  name=f'{prefix}-{a["id"]}-{i:02}'
  dirs=list((root/'ios/Maomao/Assets.xcassets').rglob(name+'.imageset'))
  assert len(dirs)==1,name
  files=list(dirs[0].glob('*.png'));assert files,name
  im=Image.open(files[-1]);assert im.mode=='RGBA',name
  alpha=im.getchannel('A');assert alpha.getextrema()==(0,255),name
  if prefix=='cat-v4':
   assert im.size==tuple(int(v*3) for v in a['size']),name
   box=alpha.getbbox();assert box[0]>0 and box[1]>0 and box[2]<im.width and box[3]<im.height,(name,'clipped',box)
  count+=1
for name in {o['image'] for o in scene['objects']}|{o['image'] for o in scene['tiles']}:
 assert (root/'ios/Maomao/Resources/WorldTextures'/f'{name}.png').exists(),name
 if len(sys.argv)>1:assert (pathlib.Path(sys.argv[1])/f'{name}.png').exists(),('missing from bundle',name)
assert not any(o['id']=='rail-support' for o in scene['objects'])
print(f'PASS: {count} action frames, genuine alpha, unclipped v4 canvases, scene references'+(', built app resources' if len(sys.argv)>1 else ''))
