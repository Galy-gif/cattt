#!/usr/bin/env python3
"""Deterministic v2 alpha export, frame slicing and scene packaging. Never rewrites v1."""
from pathlib import Path
import json, numpy as np
from PIL import Image,ImageOps,ImageFilter
ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'outputs/world-v2/review'
OUT=ROOT/'assets/scenes/courtyard-v2'
XC=ROOT/'ios/Maomao/Assets.xcassets'
INFO={'version':1,'author':'xcode'}
def writej(p,o): p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(o,ensure_ascii=False,indent=2))
def imageasset(name,im):
 if name.startswith('world-v2-'):
  d=ROOT/'ios/Maomao/Resources/WorldTextures';d.mkdir(parents=True,exist_ok=True);im.save(d/f'{name}.png');return
 d=XC/'world-v2'/f'{name}.imageset';d.mkdir(parents=True,exist_ok=True);im.save(d/'image.png')
 writej(d/'Contents.json',{'images':[{'idiom':'universal','filename':'image.png'}],'info':INFO})
def dataset(name,obj):
 d=XC/f'{name}.dataset';writej(d/'data.json',obj);writej(d/'Contents.json',{'data':[{'idiom':'universal','filename':'data.json'}],'info':INFO})
def key(im,gray=False):
 a=np.array(im.convert('RGBA'));rgb=a[:,:,:3].astype(float);r,g,b=rgb.transpose(2,0,1)
 if gray:
  sat=rgb.max(2)-rgb.min(2);alpha=np.clip((sat-10)/15,0,1)
 else:
  excess=np.minimum(r,b)-g
  alpha=1-np.clip((excess-35)/80,0,1)
  # Remove magenta contamination from partially covered edge pixels.
  edge=(alpha>0)&(alpha<1)
  a[:,:,0][edge]=np.minimum(r[edge],g[edge]+90).astype('uint8')
  a[:,:,2][edge]=np.minimum(b[edge],g[edge]+45).astype('uint8')
 a[:,:,3]=(alpha*255).astype('uint8');a[a[:,:,3]<15]=0
 result=Image.fromarray(a);bbox=result.getbbox();return result.crop(bbox) if bbox else result

def objects():
 for name,source,gray in [('tree','tree-HD',False),('house','house',True),('grass','grass',True),('bed','bed',True),('fence','fenceV2',False),('board','boardV2',False)]:
  im=key(Image.open(REVIEW/f'{source}-generated.png'),gray)
  if not gray:
   a=np.array(im);r,g,b=a[:,:,:3].astype(float).transpose(2,0,1);spill=(b>g+6)&(r>g+15)
   a[:,:,0][spill]=np.minimum(r[spill],g[spill]*1.25).astype('uint8');a[:,:,2][spill]=np.minimum(b[spill],g[spill]*.85).astype('uint8')
   im=Image.fromarray(a)
  im.save(OUT/f'{name}.png');imageasset('world-v2-'+name,im)
  if name in ('grass','bed'):
   # Front slice retains original alpha silhouette; shared coordinates avoid doubled edges.
   front=im.copy();mask=np.array(front);cut=int(im.height*(0 if name=='grass' else .65));mask[:cut,:,3]=0
   front=Image.fromarray(mask);front.save(OUT/f'{name}-front.png');imageasset('world-v2-'+name+'-front',front)

def cells(source,cols,rows):
 im=Image.open(REVIEW/f'{source}-generated.png');w,h=im.size
 return [key(im.crop((round(c*w/cols),round(r*h/rows),round((c+1)*w/cols),round((r+1)*h/rows)))) for r in range(rows) for c in range(cols)]
def actions():
 old=json.loads((XC/'cat-actions.dataset/cat-actions.json').read_text());specs={a['id']:a for a in old['actions']}
 keys=cells('tailV2',4,2);between=cells('tailBetween',4,2)
 groups={'sleepyNod':cells('sleepyV2',4,2),'tailChase':[im for pair in zip(keys,between) for im in pair],'walkToward':cells('walkToward',3,2),'walkAway':cells('walkAway',3,2),'scratchEnter':[ImageOps.mirror(im) for im in cells('scratchEnter',4,1)]}
 groups['scratchExit']=list(reversed(groups['scratchEnter']))
 # Normalize old scratch convention (source faces left) without changing the v1 resource.
 groups['treeScratch']=[ImageOps.mirror(Image.open(XC/'cat'/f'cat-treeScratch-{i:02}.imageset'/f'cat-treeScratch-{i:02}@3x.png').convert('RGBA')) for i in range(1,7)]
 manifest=[]
 for name,frames in groups.items():
  targetHeight=110 if name.startswith('scratch') or name=='treeScratch' else (85 if name=='sleepyNod' else 76)
  # A single scale for the complete cycle preserves pose proportions.
  scale=targetHeight/np.median([im.height for im in frames]);cw=int(np.ceil(max(im.width for im in frames)*scale+12));ch=int(np.ceil(max(im.height for im in frames)*scale+10));foot=ch-5
  paths=[]
  for i,im in enumerate(frames):
   # Store original native pixels at a common canvas; runtime scales down to points.
   nw=int(np.ceil(cw/scale));nh=int(np.ceil(ch/scale));canvas=Image.new('RGBA',(nw,nh));canvas.alpha_composite(im,((nw-im.width)//2,int(foot/scale)-im.height))
   p=ROOT/'assets/tuanzi/world-v2'/name/f'{i+1:02}.png';p.parent.mkdir(parents=True,exist_ok=True);canvas.save(p);paths.append(str(p.relative_to(ROOT)))
   imageasset(f'cat-v2-{name}-{i+1:02}',canvas)
  a=dict(specs.get(name,specs['walk']));a.update(id=name,name=name,frameCount=len(frames),fps=12 if name=='tailChase' else 8,loop='once' if name.startswith('scratch') else 'loop',size=[cw,ch],footY=foot,bodyLength=100.9,hitInset=5,imagePrefix='cat-v2')
  if name=='sleepyNod': a['frameDurations']=[.9,.5,.4,.4,.7,.4,.4,.3]
  if name in ('walkToward','walkAway'):a['stride']=1
  specs[name]=a;manifest.append({'id':name,'frames':paths,'nativeScaleToPoints':scale})
 old['actions']=list(specs.values());dataset('cat-actions-v2',old);writej(ROOT/'assets/tuanzi/world-v2/manifest.json',manifest)

def scene():
 def rect(x,y,w,h):return dict(x=x,y=y,width=w,height=h)
 nodes=[];edges=[]
 main=[(.137,.648),(.162,.666),(.20,.69),(.24,.711),(.30,.72),(.345,.721),(.40,.755),(.48,.786),(.57,.799),(.68,.803),(.77,.801),(.85,.792),(.90,.768),(.933,.719),(.934,.665),(.915,.622)]
 for i,(x,y) in enumerate(main):nodes.append(dict(id=f'm{i}',point=dict(x=x,y=y)))
 for i in range(len(main)-1):edges.append(dict(a=f'm{i}',b=f'm{i+1}',width=.033,main=True))
 branches=[(1,'m5',[(.36,.688),(.365,.682),(.365,.677)]),(2,'m3',[(.232,.777)]),(3,'m6',[(.438,.766),(.484,.754)]),(4,'m9',[(.68,.764)])]
 for index,origin,points in branches:
  for k,(x,y) in enumerate(points):
   ident=f'd{index}-{k}';nodes.append(dict(id=ident,point=dict(x=x,y=y)));edges.append(dict(a=origin,b=ident,width=.035,main=False));origin=ident
 nodes.append(dict(id='clearing',point=dict(x=.427,y=.777)));edges.append(dict(a='m6',b='clearing',width=.035,main=False))
 objs=[]
 def obj(name,r,depth,target=None,occlusion=None,parent=None):objs.append(dict(id=name,image='world-v2-'+name,rect=r,depth=depth,target=target,occlusion=occlusion,parent=parent))
 # Preserve the round tree asset's native aspect ratio on a 3:2 world.
 tree=Image.open(OUT/'tree.png');th=.56;tw=th*tree.width/tree.height/1.5
 obj('tree',rect(.37-tw/2,.11,tw,th),.60,1)
 obj('house',rect(.055,.34,.205,.3075),.63,0)
 obj('board',rect(.50,.87,.063,.14),.61,1,parent='tree')
 obj('grass',rect(.444,.674,.085,.113),.73,3)
 obj('grass-front',rect(.444,.719,.085,.068),.78,3,'grass')
 obj('bed',rect(.15,.719,.16,.075),.735,2)
 obj('bed-front',rect(.15,.719,.16,.075),.79,2,'bed')
 obj('fence',rect(.65,.395,.345,.172),.59,5)
 # Pond is painted into the ground; a transparent hit region is handled separately.
 dest=[]
 for ident,title,node,idle,cam in [('house','蘑菇屋','m0','sleepyNod',.15),('tree','树屋','d1-2','blinkLook',.37),('bed','猫窝','d2-0','sleepBreathe',.23),('grass','草丛','d3-1','blinkLook',.484),('pond','池塘','d4-0','blinkLook',.68),('fence','栅栏边','m15','blinkLook',.9)]:dest.append(dict(id=ident,name=title,node=node,idle=idle,cameraX=cam,facingRight=True))
 dest[1]['contact']=rect(.379,.594,.016,.055)
 config=dict(version=2,width=5400,height=3600,tiles=[dict(id='preview',image='world-v2-ground',rect=rect(0,0,1,1))],objects=objs,nodes=nodes,edges=edges,obstacles=[rect(.555,.59,.295,.15),rect(.07,.36,.16,.265),rect(.388,.46,.025,.15)],destinations=dest)
 imageasset('world-v2-ground',Image.open(OUT/'clean-plate-preview.png'))
 writej(OUT/'scene.json',config);dataset('world-scene-v2',config);dataset('world-scene-fallback',config)

def preview():
 s=json.loads((OUT/'scene.json').read_text());im=Image.open(OUT/'clean-plate-preview.png').convert('RGBA');w,h=im.size
 for o in sorted(s['objects'],key=lambda x:x['depth']):
  r=o['rect']
  if o.get('parent'):
   p=next(a['rect'] for a in s['objects'] if a['id']==o['parent']);r=dict(x=p['x']+r['x']*p['width'],y=p['y']+r['y']*p['height'],width=r['width']*p['width'],height=r['height']*p['height'])
  asset=Image.open(OUT/f"{o['id']}.png");asset=asset.resize((round(r['width']*w),round(r['height']*h)),Image.Resampling.LANCZOS);im.alpha_composite(asset,(round(r['x']*w),round(r['y']*h)))
 im.save(REVIEW/'layered-composite.png')
 for name,x in [('left',.16),('middle',.45),('right',.84)]:
  vw=round(h*402/874);left=max(0,min(w-vw,round(x*w-vw/2)));im.crop((left,0,left+vw,h)).save(REVIEW/f'phone-{name}.png')
if __name__=='__main__':
 OUT.mkdir(parents=True,exist_ok=True);writej(XC/'world-v2/Contents.json',{'info':INFO});objects();actions();scene();preview()
