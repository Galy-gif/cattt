"""Feather native generated overlap tiles; downsample only to common native density."""
from build_world_v2 import *
T=ROOT/'outputs/world-v2/tiles';layout=json.loads((T/'layout.json').read_text());W,H=layout['size']
ratios=[]
for t in layout['tiles']:
 im=Image.open(T/f"native-{t['id']}.png");x,y,x1,y1=t['crop'];ratios.extend([im.width/(x1-x),im.height/(y1-y)])
k=min(ratios);w=int(W*k)//3*3;h=w*2//3;k=w/W
acc=np.zeros((h,w,3),np.float32);weight=np.zeros((h,w,1),np.float32)
for t in layout['tiles']:
 x,y,x1,y1=[round(v*k) for v in t['crop']];cx,cy,cx1,cy1=[round(v*k) for v in t['core']]
 im=Image.open(T/f"native-{t['id']}.png").convert('RGB').resize((x1-x,y1-y),Image.Resampling.LANCZOS)
 wx=np.ones(x1-x);wy=np.ones(y1-y)
 if x>0:wx[:cx-x]=np.linspace(.001,1,cx-x)
 if x1<w:wx[cx1-x:]=np.linspace(1,.001,x1-cx1)
 if y>0:wy[:cy-y]=np.linspace(.001,1,cy-y)
 if y1<h:wy[cy1-y:]=np.linspace(1,.001,y1-cy1)
 m=(wy[:,None]*wx[None,:])[:,:,None];acc[y:y1,x:x1]+=np.array(im)*m;weight[y:y1,x:x1]+=m
im=Image.fromarray(np.clip(acc/np.maximum(weight,.001),0,255).astype('uint8'));im.save(OUT/'ground-native.png')
scene=json.loads((OUT/'scene.json').read_text());scene['width']=w;scene['height']=h;scene['tiles']=[]
# Runtime nonoverlapping crops share exact pixels, preventing texture seams.
for c in range(5):
 x=round(c*w/5);x1=round((c+1)*w/5)
 for r in range(3):
  y=round(r*h/3);y1=round((r+1)*h/3);name=f'world-v2-tile-{r}-{c}';imageasset(name,im.crop((x,y,x1,y1)))
  scene['tiles'].append(dict(id=f'{r}-{c}',image=name,rect=dict(x=x/w,y=y/h,width=(x1-x)/w,height=(y1-y)/h)))
writej(OUT/'scene.json',scene);dataset('world-scene-v2',scene)
writej(OUT/'resolution.json',dict(width=w,height=h,nativeMinimumScale=min(ratios),upsampled=False,sourceTileCount=15))
im.thumbnail((1536,1024));im.save(REVIEW/'native-ground-preview.png');print(w,h)
