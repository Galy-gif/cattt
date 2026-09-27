#!/usr/bin/env python3
"""把实际截图压缩为评审图并汇总投影量测；不生成或修改场景内容。"""
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/ios-3d-composition-review'
NAMES = dict(house='蘑菇屋', bed='猫窝', tree='树屋', grass='草丛', pond='池塘', fence='栅栏', overview='全院总览')

def overlap(a, b):
    return max(0, min(a['x']+a['width'], b['x']+b['width'])-max(a['x'],b['x'])) * max(0,min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']))

def main():
    images = OUT / 'images'; images.mkdir(exist_ok=True, parents=True)
    manifest = []
    for p in sorted((OUT/'originals/iphone16pm-device').glob('*.png')):
        if '-failed' in p.stem: continue
        image = Image.open(p).convert('RGB'); image.thumbnail((660,1434),Image.Resampling.LANCZOS)
        dest = images / f'{p.stem}.jpg'; image.save(dest, quality=87, optimize=True)
        manifest.append(dict(name=dest.name, source=str(p.relative_to(ROOT)), sha256=hashlib.sha256(p.read_bytes()).hexdigest(), bytes=dest.stat().st_size))
    rows=[]
    for folder in ['iphone16pm-device','iphone17pro-simulator']:
        for p in sorted((OUT/'metrics'/folder).glob('*-ui.json')):
            d=json.loads(p.read_text()); c=d['cat']; v=d['viewport']
            area = sum(overlap(c,r) for r in d['controls'].values())
            rows.append(dict(device=folder,view=d['view'],time=d['time'],catHeightPct=round(c['height']/v['height']*100,2),catWidthPct=round(c['width']/v['width']*100,2),
                controlOverlapPt2=round(area,2),catInViewport=c['inFront'] and c['x']>=0 and c['y']>=0 and c['x']+c['width']<=v['width'] and c['y']+c['height']<=v['height'],
                camera=d['camera'],limits=d['limits']))
    (OUT/'manifest.json').write_text(json.dumps({'images':manifest,'measurements':rows},ensure_ascii=False,indent=2)+'\n')
    font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',24)
    small=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',17)
    canvas=Image.new('RGB',(4*280+40,2*660+80),'#f3f1e8');draw=ImageDraw.Draw(canvas)
    draw.text((24,18),'第 1 轮 · 竖屏构图候选 / iPhone 16 Pro Max 真机',font=font,fill='#2e483b')
    for i,(view,name) in enumerate(NAMES.items()):
        p=images/f'{view}-day-ui.jpg'
        if not p.exists():continue
        x=20+(i%4)*280; y=70+(i//4)*660
        im=Image.open(p);im.thumbnail((260,565),Image.Resampling.LANCZOS);canvas.paste(im,(x,y+30))
        draw.text((x,y),name,font=small,fill='#2e483b')
    canvas.save(OUT/'七处构图总览.jpg',quality=82,optimize=True)
    cards=''.join(f'<article><h2>{name}</h2><a href="images/{key}-day-ui.jpg" target="_blank"><img data-view="{key}" src="images/{key}-day-ui.jpg" alt="{name}真机截图"></a><p id="m-{key}"></p></article>' for key,name in NAMES.items())
    html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小院 · 第一轮构图评审</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f1e8;color:#2e483b;font:16px/1.6 system-ui,-apple-system,sans-serif}header,main{max-width:1180px;margin:auto;padding:32px 24px}header{padding-bottom:0}h1{font-weight:500;font-size:32px;margin:0}header p{color:#637365;max-width:780px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;position:sticky;top:0;background:#f3f1e8f5;padding:14px 0;z-index:2}button{border:1px solid #b7c0b1;background:transparent;border-radius:24px;padding:9px 18px;color:inherit;font:inherit;cursor:pointer}button.on{background:#34533f;color:white;border-color:#34533f}main{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;padding-top:16px}article h2{font-size:17px;font-weight:500;margin:0 0 10px}article img{width:100%;height:auto;display:block;border-radius:22px}article p{font-size:13px;color:#637365}a{color:inherit}footer{max-width:1180px;margin:auto;padding:24px}@media(max-width:780px){main{grid-template-columns:repeat(2,1fr);gap:18px}}@media(max-width:450px){main{grid-template-columns:1fr}}video{max-width:100%;max-height:600px;border-radius:16px}</style>
<header><p>CATTT / 构图预览 · 2026.09.26</p><h1>平时看团子，拉远看整个小院。</h1><p>七个机位均来自当前 3D 场景的真机截图。点击图片可放大。参数待评审，2D 首页继续保留。</p><div class="toolbar"><button data-mode="ui" class="on">白天 · 首页控件</button><button data-mode="clean">白天 · 纯场景</button><button data-mode="night">夜晚雨 · 首页控件</button></div></header><main>CARDS</main><footer><h2>镜头演示</h2><p>iPhone 17 Pro 模拟器程序驱动：全景、连续拉近、找团子、地点取景。真机录屏接口不支持，不能据此判断真机帧率或双指触摸手感。</p><video controls preload="metadata" src="镜头演示-模拟器.mp4"></video><p><a href="验收报告.md">验收报告</a> · <a href="manifest.json">量测与截图来源</a></p></footer><script>
const metrics=METRICS;function showCompositionMode(mode){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));document.querySelectorAll('img[data-view]').forEach(im=>{let suffix=mode==='night'?'night-ui':'day-'+mode;im.src='images/'+im.dataset.view+'-'+suffix+'.jpg';im.parentElement.href=im.src;const m=metrics.find(m=>m.device==='iphone16pm-device'&&m.view===im.dataset.view&&m.time===(mode==='night'?'night':'day'));document.getElementById('m-'+im.dataset.view).textContent=m?'团子高度 '+m.catHeightPct+'% · 与首页控件重叠 '+m.controlOverlapPt2+' pt²':''})}document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>showCompositionMode(b.dataset.mode)));showCompositionMode('ui');</script></html>'''
    (OUT/'index.html').write_text(html.replace('CARDS',cards).replace('METRICS',json.dumps(rows,ensure_ascii=False)))
    print(f'{len(manifest)}张真机压缩图，{len(rows)}条量测，总览与评审页已生成')

if __name__=='__main__':main()
