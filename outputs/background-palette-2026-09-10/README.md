# 小院背景配色回调 · 2026-09-10

用户希望采用高清前较低饱和度的总体背景配色。

参考：`assets/tuanzi/felt-world-pack-v1/background/01-courtyard-felt-selected.png`。对照高清扩图，原版天空更偏灰蓝、绿植更柔和。

实现：`ios/Maomao/Features/Home/WorldView.swift` 使用统一 `scenerySaturation = 0.70`，应用于低清底板、高清地块、所有场景物件、兜底天空和水面特效；团子及 UI 保持原色。未重采样或覆盖原始图像，也未修改图层深度、遮罩、路径及互动逻辑。此为接近旧版色感的首版调整，不是逐色精确还原。

构建：iOS Simulator Debug 构建通过，日志见 `build.log`。`before.jpg` 为更新前模拟器主页截图；调整后截图另存 `after.jpg`。最终视觉偏好待用户评审。
