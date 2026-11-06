"""素材完整性与中性文字对比度，输出可复核指标；不替代人工观感。"""
import hashlib, json
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
assets=ROOT/'ios/Maomao/Assets.xcassets'
out=ROOT/'outputs/native-ui-review/metrics'
manifest=json.loads((out/'assets.json').read_text())
assert len(manifest['files'])==64
seen=set()
for item in manifest['files']:
 folder=assets/(item['name']+'.imageset')
 contents=json.loads((folder/'Contents.json').read_text())
 file=folder/contents['images'][0]['filename']
 digest=hashlib.sha256(file.read_bytes()).hexdigest()
 assert digest==item['sha256'] and digest not in seen
 seen.add(digest)
 with Image.open(file) as im:
  assert im.size==((640,640) if item['name'].startswith('tuanzi-ui') else (600,1305))
  if item['name'].startswith('tuanzi-ui'):
   alpha=np.asarray(im)[:,:,3]; assert (alpha==0).any() and (alpha==255).any()
for name,sha in manifest['models'].items():
 assert hashlib.sha256((ROOT/f'web/public/models/{name}.glb').read_bytes()).hexdigest()==sha

def luminance(hex):
 a=np.array([int(hex[i:i+2],16)/255 for i in (0,2,4)])
 a=np.where(a<=.04045,a/12.92,((a+.055)/1.055)**2.4)
 return float(a@np.array([.2126,.7152,.0722]))
def contrast(a,b):
 x,y=sorted([luminance(a),luminance(b)])
 return (y+.05)/(x+.05)
pairs={name:contrast(fg,bg) for name,fg,bg in [
 ('主文字/页底','29312F','F5F5F3'),('次级文字/页底','49514F','F5F5F3'),
 ('说明文字/页底','626B68','F5F5F3'),('弱文字/页底','68716E','F5F5F3'),
 ('按钮白字/珊瑚','FFFFFF','B45138'),('珊瑚文字/页底','B45138','F5F5F3')]}
assert min(pairs.values())>=4.5,pairs
result={'assets':len(seen),'backgrounds':60,'portraits':3,'meetingScene':1,'bytes':sum(x['bytes'] for x in manifest['files']),'contrast':{k:round(v,3) for k,v in pairs.items()},'scope':'原生不透明令牌；聊天透明面需结合最终截图另行复核'}
(out/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
