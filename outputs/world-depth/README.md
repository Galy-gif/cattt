# 原院子 · 2D 空间纵深

2026-09-11。直接修改陪伴主页，保留团子、场景原图和六地点互动；已撤销本次放弃的动作小样及入口。

- 天空、远山、地面分别以镜头的 0.60 / 0.82 / 1.00 倍移动，原有草叶作为 1.18 倍移动的近景。
- 从现有 `world-v3-ground-preview.png` 检测连续山脊轮廓，在渲染时分出天空与远山。没有改写图片或生成替代场景；显露的山后区域使用原图无云天空纹理补全。
- 地面高清地块、猫、树窝、栅栏、信箱、接触点和点击坐标沿用原世界投影。近景草叶不接管点击。
- 减少动态效果时，额外视差关闭；静态层次保留。
- 调试面板中「纵深：开 → 对比原版」可临时比较，不保存为用户设置。启动脚本支持 `depth:off` / `depth:on`。

本机录制 `review/depth-tour.mp4` 时，先短暂展示原版，再开启纵深，依次看池塘、栅栏、找猫和树窝；录屏按仓库约定不提交。`before.jpg` / `after.jpg` 是屋前对比，其他 JPEG 是对应取景。录制通过已有 DebugScript 调用镜头操作，并非手指自动化验收。

验证：iPhone 17 Pro / iOS 26.5 Simulator 构建与运行；深度投影、原图轮廓、镜头回归与 v4 接触动作检查通过，日志在 `review/`。录制的 RSS 采样在 `capture.json`；不代表真机 GPU 帧率。尚未进行 iOS 17 真机或 VoiceOver 实机验收。

复现检查：

```sh
swiftc ios/Maomao/Model/WorldDepth.swift ios/Tests/WorldDepthTests.swift -o /private/tmp/cattt-depth-tests
/private/tmp/cattt-depth-tests ios/Maomao/Resources/WorldTextures/world-v3-ground-preview.png
python3 outputs/world-depth/review/capture.py
```

Xcode 工程生成脚本已支持 `.metal`。本机缺少的 Apple Metal Toolchain 已通过 `xcodebuild -downloadComponent MetalToolchain` 安装。
