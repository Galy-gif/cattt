#!/usr/bin/env python3
"""把 frames/manifest.json 里的八个动作拼成一个自包含的预览网页。

用法：
    python3 gen_preview.py --frames ../tuanzi/felt-world-pack-v1/frames \
        --bg ../scenes/tuanzi-courtyard-v1/02-tuanzi-courtyard-background-felt-selected.png \
        --out /path/preview.html

页面：每个动作一格循环播放，可调 fps / 循环方式 / 镜像 / 逐帧，
所有动作按 manifest 的 scale 统一缩放；顶部一条「同台比大小」。
帧缩到最高 360px 再内嵌，整页约 3MB。
"""
import argparse
import base64
import io
import json
from pathlib import Path

from PIL import Image

PREVIEW_H = 360   # 内嵌帧最高像素
CAT_PT = 150      # 页面上走路帧的显示高度（px），其它动作按 scale 走


def data_uri(im: Image.Image, fmt: str = "PNG", **kw) -> str:
    buf = io.BytesIO()
    im.save(buf, fmt, **kw)
    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", type=Path, required=True)
    ap.add_argument("--bg", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    manifest = json.loads((args.frames / "manifest.json").read_text())
    actions = []
    for act in manifest["actions"]:
        uris, sizes = [], []
        for f in act["frames"]:
            im = Image.open(args.frames / act["id"] / f["file"]).convert("RGBA")
            k = min(1.0, PREVIEW_H / im.height)
            if k < 1:
                im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
            uris.append(data_uri(im))
            sizes.append([im.width, im.height])
        actions.append(dict(
            id=act["id"], name=act["name"], fps=act["fps"], loop=act["loop"],
            scale=act["scale"], canvas=act["canvas"], foot_row=act["foot_row"],
            height_median=act["height_median"], frames=uris, sizes=sizes,
            spread=act["height_spread_pct"], foot_spread=act["foot_y_src_spread"],
        ))

    bg = Image.open(args.bg).convert("RGB")
    bg_uri = data_uri(bg.resize((bg.width // 2, bg.height // 2), Image.LANCZOS), "JPEG", quality=82)

    html = TEMPLATE.replace("__DATA__", json.dumps(actions, ensure_ascii=False)) \
        .replace("__BG__", bg_uri).replace("__CATPT__", str(CAT_PT))
    args.out.write_text(html)
    print(args.out, f"{args.out.stat().st_size / 1e6:.1f} MB")


TEMPLATE = r"""<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>团子动作预览</title>
<style>
:root{--bg:#D5E2D7;--card:#fff;--ink:#1F3022;--ink2:#394C42;--ink3:#5A7064;--accent:#C25A3E;--rule:#B7CEBB}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,"PingFang SC",system-ui,sans-serif;padding:20px}
h1{font:600 20px/1.3 Georgia,"Songti SC",serif;margin:0 0 4px}.sub{color:var(--ink3);margin:0 0 18px}
.lineup{background:url(__BG__) center 78% / cover no-repeat;border-radius:14px;padding:18px 16px 12px;display:flex;align-items:flex-end;gap:10px;overflow-x:auto;box-shadow:0 6px 14px rgba(31,48,34,.07);margin-bottom:18px}
.lineup figure{margin:0;text-align:center;flex:0 0 auto}.lineup img{display:block;margin:0 auto}.lineup figcaption{font-size:11px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.card{background:var(--card);border-radius:14px;box-shadow:0 6px 14px rgba(31,48,34,.07);overflow:hidden}
.stage{position:relative;height:230px;background:url(__BG__) center 78% / cover no-repeat}
.stage canvas{position:absolute;left:50%;bottom:34px;transform:translateX(-50%)}
.stage .ground{position:absolute;left:0;right:0;bottom:34px;border-top:1px dashed rgba(255,255,255,.55)}
.stage .tag{position:absolute;left:10px;top:8px;background:rgba(255,255,255,.85);border-radius:999px;padding:2px 10px;font-size:12px}
.ctl{padding:10px 12px 12px;display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:12px;color:var(--ink2)}
.ctl input[type=range]{width:100%}.ctl select,.ctl button{font:inherit;border:1px solid var(--rule);background:#fff;border-radius:8px;padding:3px 8px;color:var(--ink)}
.ctl button.on{background:var(--accent);color:#F8EDE6;border-color:var(--accent)}
.meta{grid-column:1/-1;color:var(--ink3);font-size:11px;display:flex;gap:12px;flex-wrap:wrap}
.walkdemo{background:url(__BG__) center 78% / cover no-repeat;border-radius:14px;height:210px;position:relative;overflow:hidden;box-shadow:0 6px 14px rgba(31,48,34,.07);margin-bottom:18px}
.walkdemo canvas{position:absolute;bottom:30px}
.walkdemo .tag{position:absolute;left:10px;top:8px;background:rgba(255,255,255,.85);border-radius:999px;padding:2px 10px;font-size:12px}
.walkdemo .ctl2{position:absolute;right:10px;top:8px;background:rgba(255,255,255,.85);border-radius:999px;padding:2px 10px;font-size:12px;display:flex;gap:8px;align-items:center}
</style></head><body>
<h1>团子动作预览 · 毛毡 v1</h1>
<p class="sub">八个动作按走路帧的体量统一缩放（sqrt 面积对齐）。看三件事：循环接不接得上、有没有跳帧、各动作的猫是否等大。</p>
<div class="lineup" id="lineup"></div>
<div class="walkdemo" id="walkdemo"><span class="tag">走路 / 奔跑 实走：每秒一个身长（跑 2.2 身长）</span>
<div class="ctl2"><label><input type="radio" name="gait" value="walk" checked> 走</label><label><input type="radio" name="gait" value="run"> 跑</label><label>身长/秒 <input id="speed" type="range" min="0.5" max="3" step="0.1" value="1" style="width:90px"></label><span id="speedv">1.0</span></div>
<canvas id="walkcv"></canvas></div>
<div class="grid" id="grid"></div>
<script>
const DATA=__DATA__, CATPT=__CATPT__;
const imgs={};
function load(a){return Promise.all(a.frames.map(src=>new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.src=src;})));}
function seq(n,mode){if(mode==='pingpong'){const s=[];for(let i=0;i<n;i++)s.push(i);for(let i=n-2;i>0;i--)s.push(i);return s;}return [...Array(n).keys()];}
(async()=>{
for(const a of DATA){imgs[a.id]=await load(a);}
// 同台比大小
const lu=document.getElementById('lineup');
for(const a of DATA){const im=imgs[a.id][0];const k=CATPT*a.scale/ (a.height_median*(im.height/a.canvas[1]));
 const f=document.createElement('figure');const el=new Image();el.src=a.frames[0];el.style.height=(im.height*k)+'px';f.appendChild(el);
 const c=document.createElement('figcaption');c.textContent=a.name+' ×'+a.scale.toFixed(2);f.appendChild(c);lu.appendChild(f);}
// 每动作一格
const grid=document.getElementById('grid');
for(const a of DATA){
 const card=document.createElement('div');card.className='card';
 card.innerHTML=`<div class="stage"><span class="tag">${a.name}</span><div class="ground"></div><canvas></canvas></div>
 <div class="ctl"><span>fps</span><input class="fps" type="range" min="1" max="24" step="1" value="${a.fps}"><b class="fpsv">${a.fps}</b>
 <span>循环</span><select class="loop"><option value="loop">循环</option><option value="pingpong">往返</option><option value="once">单次（停首帧，每 3s 触发）</option></select><span></span>
 <span>帧</span><input class="frame" type="range" min="0" max="5" step="1" value="0" disabled><button class="pause">暂停</button>
 <span>镜像</span><button class="mirror">向左</button><span></span>
 <div class="meta"><span>帧高中位 ${Math.round(a.height_median)}px</span><span>高度极差 ${a.spread.toFixed(1)}%</span><span>脚底源 y 极差 ${a.foot_spread}px</span><span>scale ${a.scale.toFixed(3)}</span></div></div>`;
 grid.appendChild(card);
 card.querySelector('.loop').value=a.loop;
 const cv=card.querySelector('canvas'),ctx=cv.getContext('2d');const fr=imgs[a.id];
 const k=CATPT*a.scale/(a.height_median*(fr[0].height/a.canvas[1]));const dpr=devicePixelRatio||1;
 const w=Math.round(fr[0].width*k),h=Math.round(fr[0].height*k);cv.width=w*dpr;cv.height=h*dpr;cv.style.width=w+'px';cv.style.height=h+'px';
 const footFrac=a.foot_row/a.canvas[1];cv.style.bottom=(34-h*(1-footFrac))+'px';
 let st={fps:a.fps,loop:a.loop,paused:false,mirror:false,i:0,acc:0,last:0,idle:0};
 const fpsIn=card.querySelector('.fps'),fpsV=card.querySelector('.fpsv'),loopIn=card.querySelector('.loop'),frIn=card.querySelector('.frame'),pb=card.querySelector('.pause'),mb=card.querySelector('.mirror');
 fpsIn.oninput=()=>{st.fps=+fpsIn.value;fpsV.textContent=st.fps;};loopIn.onchange=()=>{st.loop=loopIn.value;st.i=0;};
 pb.onclick=()=>{st.paused=!st.paused;pb.textContent=st.paused?'播放':'暂停';pb.classList.toggle('on',st.paused);frIn.disabled=!st.paused;};
 frIn.oninput=()=>{st.i=+frIn.value;draw();};mb.onclick=()=>{st.mirror=!st.mirror;mb.classList.toggle('on',st.mirror);};
 function draw(){const s=seq(fr.length,st.loop==='pingpong'?'pingpong':'loop');const idx=st.loop==='pingpong'?s[st.i%s.length]:st.i%fr.length;frIn.value=idx;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(st.mirror){ctx.translate(w,0);ctx.scale(-1,1);}ctx.drawImage(fr[idx],0,0,w,h);}
 function tick(t){if(!st.last)st.last=t;const dt=(t-st.last)/1000;st.last=t;
  if(!st.paused){if(st.loop==='once'){ if(st.i>=fr.length-1&&st.i!==0){st.idle+=dt;if(st.idle>3){st.i=0;st.idle=0;}} else {st.acc+=dt;if(st.acc>=1/st.fps){st.acc=0;st.i=Math.min(st.i+1,fr.length-1);}}
   if(st.i===0&&st.idle===0){st.acc+=dt;if(st.acc>=3){st.acc=0;st.i=1;}} }
   else{st.acc+=dt;if(st.acc>=1/st.fps){st.acc-=1/st.fps;st.i++;}}}
  draw();requestAnimationFrame(tick);}
 requestAnimationFrame(tick);
}
// 实走 demo
const wd=document.getElementById('walkdemo'),wcv=document.getElementById('walkcv'),wctx=wcv.getContext('2d');
let gait='walk';document.querySelectorAll('input[name=gait]').forEach(r=>r.onchange=()=>{gait=r.value;});
const sp=document.getElementById('speed'),spv=document.getElementById('speedv');sp.oninput=()=>spv.textContent=(+sp.value).toFixed(1);
let x=-200,dir=1,acc=0,last=0,i=0;
function wtick(t){if(!last)last=t;const dt=(t-last)/1000;last=t;
 const a=DATA.find(d=>d.id===gait),fr=imgs[a.id];const dpr=devicePixelRatio||1;
 const k=CATPT*a.scale/(a.height_median*(fr[0].height/a.canvas[1]));const w=Math.round(fr[0].width*k),h=Math.round(fr[0].height*k);
 if(wcv.width!==w*dpr){wcv.width=w*dpr;wcv.height=h*dpr;wcv.style.width=w+'px';wcv.style.height=h+'px';wcv.style.bottom=(30-h*(1-a.foot_row/a.canvas[1]))+'px';}
 const body=w*0.8; // 身长按帧宽的 0.8 估
 const mult=gait==='run'?2.2:1;const v=body*(+sp.value)*mult;
 // 走路帧率跟速度锁：一个循环走一个身长 → fps = 6·v/body
 const fps=6*v/body;acc+=dt;if(acc>=1/fps){acc-=1/fps;i=(i+1)%fr.length;}
 x+=v*dt*dir;const W=wd.clientWidth;if(dir>0&&x>W+20){dir=-1;}if(dir<0&&x<-w-20){dir=1;}
 wcv.style.left=x+'px';wctx.setTransform(dpr,0,0,dpr,0,0);wctx.clearRect(0,0,w,h);if(dir<0){wctx.translate(w,0);wctx.scale(-1,1);}wctx.drawImage(fr[i],0,0,w,h);
 requestAnimationFrame(wtick);}
requestAnimationFrame(wtick);
})();
</script></body></html>
"""

if __name__ == "__main__":
    main()
