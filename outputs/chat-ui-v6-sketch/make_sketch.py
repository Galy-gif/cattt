import json
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance
S='/private/tmp/claude-501/-Users-gouzi----app/4edc33db-5abd-4fab-9b36-01e8c1e078ee/scratchpad'
sc=json.load(open('assets/scenes/courtyard-v4/scene.json'))
W,H=sc['width'],sc['height']; k=0.4
world=Image.new('RGB',(int(W*k),int(H*k)))
for t in sc['tiles']:
    r=t['rect']; im=Image.open(f"ios/Maomao/Resources/WorldTextures/{t['image']}.png").convert('RGB')
    box=(round(r['x']*W*k),round(r['y']*H*k),round((r['x']+r['width'])*W*k),round((r['y']+r['height'])*H*k))
    world.paste(im.resize((box[2]-box[0],box[3]-box[1])),box[:2])
world.save(f'{S}/world_small.jpg',quality=80)
PW,PH=853,1844
c5=Image.open('outputs/chat-ui-v5-delivery/C5-小团子彩色蘑菇屋无描边.png').convert('RGB')
font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',36,index=0)
fontT=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',40,index=0)
msgs=[('c','你回来了。'),('u','今天有点累'),('c','嗯。那就先不用讲道理。'),('u','路上看到有人在卖桂花'),('c','桂花是真的开了吗，我没出去过。你走近的时候，闻到香味了吗？')]
av=c5.crop((45,258,125,338))
mask=Image.new('L',av.size,0); ImageDraw.Draw(mask).ellipse((0,0,79,79),fill=255)
def wrap(d,text,maxw):
    lines=[];cur=''
    for ch in text:
        if d.textlength(cur+ch,font=font)>maxw and ch not in '，。？！': lines.append(cur);cur=ch
        else: cur+=ch
    return lines+[cur]
def make(name,cx,cy,blur,veil,glass_a,scale):
    cw,ch=int(PW*scale),int(PH*scale)
    bg=world.crop((cx-cw//2,cy-ch//2,cx+cw//2,cy+ch//2)).resize((PW,PH))
    bg=bg.filter(ImageFilter.GaussianBlur(blur))
    # 顶部与底部各一层雾，中间留景
    ov=Image.new('RGBA',(PW,PH))
    d=ImageDraw.Draw(ov)
    for y in range(PH):
        t=y/PH
        a=veil[0]*max(0,1-t/0.18)+veil[1]+veil[2]*max(0,(t-0.8)/0.2)
        d.line([(0,y),(PW,y)],fill=(248,246,240,int(min(255,a*255))))
    img=Image.alpha_composite(bg.convert('RGBA'),ov)
    base=img.copy()
    d=ImageDraw.Draw(img)
    d.text((110,125),'团子',font=fontT,fill=(40,44,52)); d.line([(78,130),(60,150),(78,170)],fill=(40,44,52),width=5)
    d.text((755,135),'记录',font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',28),fill=(60,64,70))
    y=250
    for role,text in msgs:
        maxw=int(PW*0.62)
        lines=wrap(d,text,maxw); tw=max(d.textlength(l,font=font) for l in lines)
        bw,bh=int(tw+64),int(len(lines)*60+42)
        x=165 if role=='c' else PW-40-bw
        # 玻璃：取背后区域再糊一层，提亮
        reg=base.crop((x,y,x+bw,y+bh)).filter(ImageFilter.GaussianBlur(18))
        tint=Image.new('RGBA',reg.size,(255,255,255,int(glass_a*255)) if role=='c' else (255,250,244,int((glass_a-0.08)*255)))
        reg=Image.alpha_composite(reg,tint)
        m=Image.new('L',reg.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,bw-1,bh-1),radius=34,fill=255)
        img.paste(reg,(x,y),m)
        d=ImageDraw.Draw(img)
        for i,l in enumerate(lines): d.text((x+32,y+18+i*60),l,font=font,fill=(34,38,44))
        if role=='c': img.paste(av,(60,y+bh//2-40),mask)
        y+=bh+36
    # 输入框
    x,y,bw,bh=36,1640,PW-72,110
    reg=base.crop((x,y,x+bw,y+bh)).filter(ImageFilter.GaussianBlur(18))
    reg=Image.alpha_composite(reg,Image.new('RGBA',reg.size,(255,255,255,int(glass_a*255))))
    m=Image.new('L',reg.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,bw-1,bh-1),radius=40,fill=255)
    img.paste(reg,(x,y),m); d=ImageDraw.Draw(img)
    d.text((x+44,y+34),'说点什么',font=font,fill=(120,124,130))
    d.ellipse((x+bw-92,y+22,x+bw-26,y+88),fill=(238,106,76))
    d.text((x+bw-72,y+26),'↑',font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',44),fill='white')
    img.convert('RGB').save(f'{S}/{name}.png')
print(world.size)
make('A_院子在身后',1400,688,5,(0.55,0.22,0.55),0.62,0.746)
make('B_院子的光',1400,688,34,(0.35,0.38,0.45),0.55,0.746)
a=Image.open(f'{S}/A_院子在身后.png'); b=Image.open(f'{S}/B_院子的光.png'); c=c5.resize((PW,PH))
sheet=Image.new('RGB',(PW*3+80,PH),'white')
for i,im in enumerate([c,a,b]): sheet.paste(im,(i*(PW+40),0))
sheet.resize((sheet.width//2,sheet.height//2)).save(f'{S}/compare.png')
