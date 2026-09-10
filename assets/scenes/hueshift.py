import sys,numpy as np
from PIL import Image
def rgb2hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a.max(-1); mn=a.min(-1); d=mx-mn
    h=np.where(mx==r,((g-b)/np.maximum(d,1e-9))%6,np.where(mx==g,(b-r)/np.maximum(d,1e-9)+2,(r-g)/np.maximum(d,1e-9)+4))*60
    h=np.where(d<1e-9,0,h); s=np.where(mx>0,d/np.maximum(mx,1e-9),0); return h,s,mx
def hsv2rgb(h,s,v):
    c=v*s; hp=(h/60)%6; x=c*(1-abs(hp%2-1)); m=v-c
    i=np.floor(hp).astype(int); z=np.zeros_like(c)
    tbl=[(c,x,z),(x,c,z),(z,c,x),(z,x,c),(x,z,c),(c,z,x)]
    r=np.select([i==k for k in range(6)],[t[0] for t in tbl]); g=np.select([i==k for k in range(6)],[t[1] for t in tbl]); b=np.select([i==k for k in range(6)],[t[2] for t in tbl])
    return np.stack([r+m,g+m,b+m],-1)
def shift(im,deg,lo=50,hi=125,feather=12,sat_min=0.10):
    a=np.asarray(im.convert('RGB')).astype(float)/255; h,s,v=rgb2hsv(a)
    w=np.clip(np.minimum(h-lo,hi-h)/feather,0,1)          # 1 inside band, feather at edges
    w=w*np.clip((s-sat_min)/0.08,0,1)                      # skip near-neutral pixels (sky/paper/whites)
    h2=(h+deg*w)%360
    out=hsv2rgb(h2,s,v); return Image.fromarray((np.clip(out,0,1)*255+0.5).astype(np.uint8))
if __name__=='__main__':
    src,deg,dst=sys.argv[1],float(sys.argv[2]),sys.argv[3]
    shift(Image.open(src),deg).save(dst)
