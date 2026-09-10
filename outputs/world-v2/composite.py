import json
from pathlib import Path
from PIL import Image,ImageDraw
p=Path('assets/scenes/courtyard-v2');s=json.loads((p/'scene.json').read_text());w,h=4302,2868
im=Image.open(p/'ground-native.png').convert('RGBA').resize((w,h),Image.Resampling.LANCZOS)
for o in sorted(s['objects'],key=lambda x:x['depth']):
 r=o['rect']
 if o.get('parent'):
  a=next(x['rect'] for x in s['objects'] if x['id']==o['parent']);r=dict(x=a['x']+r['x']*a['width'],y=a['y']+r['y']*a['height'],width=r['width']*a['width'],height=r['height']*a['height'])
 a=Image.open(p/f"{o['id']}.png");target=round(r['width']*w),round(r['height']*h)
 print(o['id'],a.size,'->',target,'upscale',max(target[0]/a.width,target[1]/a.height)>1.001)
 a=a.resize(target,Image.Resampling.LANCZOS);im.alpha_composite(a,(round(r['x']*w),round(r['y']*h)))
im.save(p/'composite-4302x2868.png');im.thumbnail((1536,1024));im.save('outputs/world-v2/review/final-composite.png')
d=ImageDraw.Draw(im);nodes={n['id']:n['point'] for n in s['nodes']}
for e in s['edges']:
 a,b=nodes[e['a']],nodes[e['b']];d.line([(a['x']*1536,a['y']*1024),(b['x']*1536,b['y']*1024)],fill='#1e5460',width=4)
for i,a in enumerate(s['destinations']):
 n=nodes[a['node']];x,y=n['x']*1536,n['y']*1024;d.ellipse((x-12,y-12,x+12,y+12),fill='#fff8de',outline='#1e5460',width=2);d.text((x-3,y-6),str(i+1),fill='#1e5460')
im.save('outputs/world-v2/review/road-map.png')
