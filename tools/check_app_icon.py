"""规范化图标PNG通道，复核来源/配置/尺寸，生成小尺寸审阅图。"""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw,ImageFont
import numpy as np
root=Path(__file__).resolve().parents[1]
dir=root/'ios/Maomao/Assets.xcassets/AppIcon.appiconset'
out=root/'outputs/app-icon-review'
source=json.loads((out/'source.json').read_text())
assert hashlib.sha256((root/source['selectedSource']).read_bytes()).hexdigest()==source['sourceSHA256']
config=json.loads((dir/'Contents.json').read_text());assert len(config['images'])==1 and not config['images'][0].get('appearances')
files=[]
for item in config['images']:
 p=dir/item['filename'];im=Image.open(p);assert im.size==(1024,1024)
 if 'dark' not in p.name:
  if im.mode=='RGBA':assert im.getchannel('A').getextrema()==(255,255)
  im.convert('RGB').save(p)
 else:assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255)
 im=Image.open(p)
 if 'tinted' in p.name:
  a=np.asarray(im);assert np.array_equal(a[:,:,0],a[:,:,1]) and np.array_equal(a[:,:,1],a[:,:,2])
 files.append({'name':p.name,'size':list(im.size),'mode':im.mode,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf',21)
canvas=Image.new('RGB',(900,600),'#f5f5f3');d=ImageDraw.Draw(canvas)
def tile(kind,x,y,size,bg):
 im=Image.open(dir/f'AppIcon-{kind}.png').convert('RGBA').resize((size,size),Image.Resampling.LANCZOS)
 back=Image.new('RGBA',im.size,bg);back.alpha_composite(im)
 mask=Image.new('L',(size,size));ImageDraw.Draw(mask).rounded_rectangle((0,0,size-1,size-1),radius=size*.223,fill=255)
 canvas.paste(back.convert('RGB'),(x,y),mask)
for kind,label,x in [('default','已选定：趴一会儿',40)]:
 d.text((x,24),label,font=font,fill='#29312f');tile(kind,x,66,240,'#202327')
d.text((40,345),'小尺寸检查 · 60 / 40 / 29 px',font=font,fill='#29312f')
for x,size in [(40,60),(140,40),(220,29)]:tile('default',x,400,size,'#f5f5f3')
d.text((40,516),'已选手绘符号 · 无文字 · 源图不预切圆角',font=font,fill='#626b68')
canvas.save(out/'图标预览.jpg',quality=92)
(out/'checks.json').write_text(json.dumps({'source':source,'files':files,'preview':'圆角为审阅示意；实际裁切以系统主屏幕为准'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(files,ensure_ascii=False))
