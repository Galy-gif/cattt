"""头像动作资源检查与可回看证据；不替代自然度观感确认。"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]
out=root/'outputs/avatar-motion-review'
manifest=json.loads((out/'assets.json').read_text())
assert hashlib.sha256((root/'web/public/models/tuanzi.glb').read_bytes()).hexdigest()==manifest['modelSHA256']
frames={}
for entry in manifest['files']:
 name=entry['name'];p=root/f'ios/Maomao/Assets.xcassets/{name}.imageset/{name}.png'
 assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256'],name
 im=Image.open(p);assert im.mode=='RGBA' and im.size==(256,256),name
 a=np.array(im)
 # 静态肖像原有下边缘身体裁切可保留，头耳不得触顶或左右裁切。
 assert a[0,:,3].max()==0 and a[:,0,3].max()==0 and a[:,-1,3].max()==0,name
 frames.setdefault(entry['kind'],[]).append(im.copy())
for kind,count in [('blink',10),('look',73)]:
 assert len(frames[kind])==count
 assert np.array_equal(np.array(frames[kind][0]),np.array(frames[kind][-1])),kind
 assert not np.array_equal(np.array(frames[kind][0]),np.array(frames[kind][count//3])),kind
assert np.array_equal(np.array(frames['blink'][0]),np.array(frames['look'][0]))
# 只用于审阅的低分辨率动图；资源本身保持透明PNG。
rest=frames['blink'][0]
sequence=[rest]*45+frames['blink']+[rest]*60+frames['look']+[rest]*90
flat=[]
for frame in sequence:
 bg=Image.new('RGB',(256,256),'#f5f5f3');bg.paste(frame,mask=frame.getchannel('A'));flat.append(bg.resize((160,160)))
flat[0].save(out/'头像动作预览.gif',save_all=True,append_images=flat[1:],duration=33,loop=0,optimize=True)
selected=[('blink',0),('blink',3),('blink',6),('look',22),('look',48),('look',72)]
canvas=Image.new('RGB',(768,548),'#f5f5f3');d=ImageDraw.Draw(canvas)
for i,(kind,n) in enumerate(selected):
 x=(i%3)*256;y=(i//3)*274;frame=frames[kind][n];canvas.paste(frame,(x,y),frame.getchannel('A'));d.text((x+10,y+250),f'{kind} {n}/30 s',fill='#29312f')
canvas.save(out/'动作接触表.jpg',quality=88)
result={'frames':len(manifest['files']),'size':256,'bytes':sum(e['bytes'] for e in manifest['files']),'decodedRGBAUpperBoundMiB':83*256*256*4/1024**2,'seam':'首尾与两动作待机像素一致','headCrop':'所有帧头顶/左右透明边界通过'}
(out/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
