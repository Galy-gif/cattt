#!/usr/bin/env python3
"""布局第二次评审：只压缩真实截图，旧候选保持独立。"""
import json
import package_yard_composition as base

OUT = base.ROOT / 'outputs/yard-layout-review'

def main():
    base.OUT = OUT
    base.NAMES = {k: base.NAMES[k] for k in ['overview','house','tree','pond','bed','grass','fence']}
    base.main()
    p = OUT / 'index.html'
    html = p.read_text().replace('小院 · 第一轮构图评审', '小院 · 布局调整评审')
    html = html.replace('CATTT / 构图预览 · 2026.09.26', 'CATTT / 布局调整 · 2026.09.26')
    html = html.replace('平时看团子，拉远看整个小院。', '房屋、树和池塘，各自留出位置。')
    html = html.replace('七个机位均来自当前 3D 场景的真机截图。点击图片可放大。参数待评审，2D 首页继续保留。',
        '蘑菇屋放大35%，池塘长宽放大40%；树移到右后方，后侧栅栏延长，移除木牌。石路整理为一条环路和三条短支路。先看全景与屋前，再切换日夜图。以下均为本版真机截图，布局待评审。')
    start = html.index('<footer>'); end = html.index('</footer>', start) + len('</footer>')
    html = html[:start] + '''<footer><p>手机已安装独立预览。头像菜单可让团子沿新路线散步；全景／找团子只改变镜头。2D首页继续保留。</p><p><a href="验收报告.md">本版报告</a> · <a href="layout-measurements.json">布局参数</a> · <a href="manifest.json">截图与控件量测</a></p></footer>''' + html[end:]
    p.write_text(html)
    manifest = json.loads((OUT/'manifest.json').read_text())
    assert len(manifest['images']) == 21, '七处三组真机图必须齐全'
    assert all(row['catInViewport'] and row['controlOverlapPt2'] == 0 for row in manifest['measurements']), '团子入镜或控件重叠失败'

if __name__ == '__main__': main()
