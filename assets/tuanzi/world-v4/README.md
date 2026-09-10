# 团子世界 v4 素材

2026-09-10，内置 imagegen，参考已确认的毛毡走路横条。实际提示词见 `prompts.md`、`extra-prompts.md`、`sleep-prompt.md`。

- `nest-atlas.png`：16 格蓄力／腾空／抓沿攀入／趴卧。
- `rail-atlas.png`：16 格独立搭爪／换爪／收后腿／趴栏。
- `water-atlas.png`：16 格看水／伸爪／轻拍／甩爪／坐下。
- `exit-atlas.png`：16 格探身／蹬出／向下落／缓冲／恢复站姿，不是入窝倒放。
- `sleep-atlas.png`：只采用最后两格闭眼姿态，和原图配合用于窝口眨眼和睡眠。
- `nest-source.png`：独立吊窝，宽洞口与前沿分层配合正常尺寸猫。
- `tree-source.png`：未采用的树候选；叶间空隙偏多。正式场景保留 v2 原树及其 Alpha，只遮掉旧窝，由新独立吊窝替代。

`assets/tools/package_world_v4.swift` 负责确定性素材导入：识别已有 Alpha；RGB 棋盘背景按色度去除；移除与主体分离的网格溢出；按源图头宽校准到约 40pt，以每格的接触点对齐到共同原点；再按动作组统一裁掉多余透明边距，同步画布尺寸和 footY。裁边只减少资源占用，不缩放猫或移动接触点。不会按蹲／站姿的外接框高度分别缩放。运行时保留既有地面透视，进窝不再额外缩至 75%。

生成源图保留。实际采用的动作帧在 `ios/Maomao/Assets.xcassets/world-v4/`，独立吊窝在 `ios/Maomao/Resources/WorldTextures/world-v4-nest.png`。水纹、水滴属于运行时原生 Canvas 效果，不烘焙进猫或背景。

当前完整动作目录共 156 帧（含保留的旧动作）。源图有有限关键帧，动作质量仍应以 App 正常速度播放和慢放接触检查为准，不能按帧数宣称连续骨骼动画的效果。
