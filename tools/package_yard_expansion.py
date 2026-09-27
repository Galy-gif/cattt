#!/usr/bin/env python3
"""复用真机评审图压缩器，增加同机位前后对照；不修图、不生成场景。"""
from pathlib import Path
import json,hashlib
from PIL import Image,ImageDraw,ImageFont
import package_yard_composition as base

OUT=base.ROOT/'outputs/yard-expansion-review'

def main():
    base.OUT=OUT;base.main()
    before=base.ROOT/'outputs/ios-3d-composition-review/images/overview-day-ui.jpg'
    old=OUT/'images/before-overview-day-ui.jpg'
    old.write_bytes(before.read_bytes())
    font=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',22)
    small=ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc',16)
    canvas=Image.new('RGB',(920,1040),'#f3f1e8');d=ImageDraw.Draw(canvas)
    d.text((24,15),'院子扩展 · 同一镜头前后对照',font=font,fill='#2e483b')
    d.text((24,50),'同一视口、视场角、镜头位置与焦点；物件和团子没有统一缩放',font=small,fill='#637365')
    for x,file,label in [(24,old,'扩展前'),(474,OUT/'images/comparison-day-ui.jpg','扩展后 · 同机位')]:
        im=Image.open(file);im.thumbnail((420,912),Image.Resampling.LANCZOS)
        d.text((x,84),label,font=small,fill='#2e483b');canvas.paste(im,(x,115))
    canvas.save(OUT/'扩展前后同机位.jpg',quality=85,optimize=True)
    html=(OUT/'index.html').read_text().replace('小院 · 第一轮构图评审','小院 · 扩展版评审').replace('平时看团子，拉远看整个小院。','把院子展开，留一片可以散步的草地。')
    html=html.replace('CATTT / 构图预览 · 2026.09.26','CATTT / 院子扩展 · 2026.09.26')
    html=html.replace('七个机位均来自当前 3D 场景的真机截图。点击图片可放大。参数待评审，2D 首页继续保留。','房屋、大树与池塘拉开距离，增加草地穿行、池边绕行和树下停留。少量添木凳、花丛与山石，远山尺度与团子大小保持。以下均为真机渲染，观感待评审。')
    section='<section style="max-width:1180px;margin:auto;padding:24px"><h2>同一镜头，院子真正扩展了</h2><p>左侧是扩展前；右侧固定为相同相机，仅改变院内布局。扩展后完整总览见下方七处图。新版路段总长约31米，旧版约10.8米；详见验收报告。</p><a href="扩展前后同机位.jpg" target="_blank"><img style="max-width:920px;width:100%;height:auto" src="扩展前后同机位.jpg" alt="扩展前后同机位对照"></a></section>'
    html=html.replace('</header><main>','</header>'+section+'<main>')
    start=html.index('<footer>');end=html.index('</footer>',start)+len('</footer>')
    html=html[:start]+'''<footer><h2>在手机上看</h2><p>调试面板 → 3D 构图预览。头像菜单中的“在扩展后的院子里散步”会让团子按正常步速走过新增路线；全景／找团子只改变镜头。</p><p><a href="验收报告.md">验收报告</a> · <a href="layout-measurements.json">扩展尺度与路线量测</a> · <a href="manifest.json">截图来源与相机参数</a></p></footer>'''+html[end:]
    (OUT/'index.html').write_text(html)
    manifest=json.loads((OUT/'manifest.json').read_text());manifest['comparison']={'beforeSource':str(before.relative_to(base.ROOT)),'beforeSHA256':hashlib.sha256(before.read_bytes()).hexdigest(),'afterSource':'images/comparison-day-ui.jpg','method':'同视口、相机位置和焦点；非裁切放大'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
