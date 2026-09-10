from PIL import Image, ImageDraw, ImageFilter
import json, os, math, random
BASE="/Users/gouzi/Documents/Codex/2026-09-04/outputs-docs-tuanzi-prompts-2026-09/outputs/scenes/2026-09-07/"
plate=Image.open(BASE+"5a-reissue-v3/5a-background-plate-corrected.png").convert("RGBA")
A=BASE+"scene-5ab/assets/"; W,H=plate.size
random.seed(7)
def s_at(y): return 0.42+(y-0.50)/(0.88-0.50)*0.50

# 三个簇心：(cx, cy, x半径, y半径)，物件绕簇心散布并允许互相压叠
CL={
 "house":(0.455,0.578,0.235,0.038),   # 屋右主簇
 "tree" :(0.790,0.688,0.150,0.058),   # 树下
 "cat"  :(0.430,0.800,0.185,0.042),   # 猫的家当
}
GROUPS={
 "house":["potted-plant","bucket","stool","lantern","table","cup","books","watering-can",
          "crate-stack","crate","firewood","paper-bag","flower","tall-grass","clay-bowl",
          "mushroom-cluster","sign","low-grass"],
 "tree" :["broom","stump","log","mossy-rock","basket","scratching-log","cardboard-box",
          "fern","birdhouse","rock","twigs","dandelion"],
 "cat"  :["cushion","cat-bed","rolled-blanket","blanket","water-bowl","kibble-bowl",
          "yarn","fish-toy","leaf-pile","clover","bell","leaf"],
}
LOOSE=[("feather-toy",0.545,0.668,0.9),("mushroom",0.352,0.700,1.0),
       ("string",0.612,0.742,1.0),("stepping-stone",0.470,0.868,1.0)]
CAT=("tuanzi-world-sleep-basket",0.455,0.812,0.86)

placed=[]
for key,names in GROUPS.items():
    cx,cy,rx,ry=CL[key]
    n=len(names)
    for i,nm in enumerate(names):
        t=(i+0.5)/n
        ang=t*math.tau*1.9
        rad=0.42+0.58*math.sqrt(t)
        x=cx+math.cos(ang)*rx*rad+random.uniform(-0.018,0.018)
        y=cy+math.sin(ang)*ry*rad+random.uniform(-0.012,0.012)
        placed.append((nm,x,y,1.0))
placed+= [(n,x,y,s) for n,x,y,s in LOOSE]
placed.sort(key=lambda p:p[2])          # 按落地 y 排序，后画的压前面 → 正确遮挡

sh=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(sh)
items=[]
for nm,cx,by,ex in placed+[CAT]:
    is_cat=nm.startswith("tuanzi")
    im=Image.open(A+("" if is_cat else "prop-")+nm+".png").convert("RGBA")
    s=s_at(by)*ex
    nw,nh=max(1,int(im.width*s)),max(1,int(im.height*s))
    im=im.resize((nw,nh),Image.LANCZOS)
    x,y=int(W*cx-nw/2),int(H*by-nh)
    rx_,ry_=nw*0.42,max(4,nw*0.085)
    d.ellipse([W*cx-rx_,H*by-ry_,W*cx+rx_,H*by+ry_],fill=(78,66,52,88))
    items.append((im,x,y,nm,nw,nh,round(s,3),round(by,3)))
sh=sh.filter(ImageFilter.GaussianBlur(9))
canvas=Image.alpha_composite(plate.copy(),sh)
man=[]
for im,x,y,nm,nw,nh,s,by in items:
    canvas.alpha_composite(im,(x,y))
    man.append({"asset":nm,"x":x,"y":y,"w":nw,"h":nh,"scale":s,"baseline_y":by})
canvas.convert("RGB").save("5b-composed-v4.png")
json.dump(man,open("5b-layers.json","w"),ensure_ascii=False,indent=1)
h=canvas.convert("L").histogram(); n=sum(h)
print(f"物件 {len(placed)} + 团子 1 · 暗部 L<60 {sum(h[:60])/n*100:.2f}%")
