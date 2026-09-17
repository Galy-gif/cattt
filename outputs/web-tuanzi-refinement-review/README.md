# 团子 Blender 模型与动作优化 · 验收

2026-09-17，已导出并接入网页版，未提交；观感待用户评审。完整做法、数值与边界见 [优化记录](../../docs/specs/网页版-团子模型动作优化-2026-09-17.md)。

- `01-模型与坐姿前后对照.jpg`：同镜头、同物理尺度的 Blender 渲染，上排旧版，下排新版。没有逐图重新缩放猫。
- `before-metrics.json` / `after-metrics.json`：从保存的 `.blend` 逐帧读出的离地、脚掌位置、循环首尾及尾尖数据。
- `runtime-tests.json`：最终 glb 与真实网页运行时的回归，包括静止坐姿、抖耳朵、直走、掉头、直角、弯路和打断。
- `identity-metrics.json` / `final-side-overlay.png`：R3 侧面四项比例和剪影叠影；不是完整身份的人眼验收。
- `artifact-hashes.json`：最终 Blender、贴图、glb、建模脚本的哈希与大小。旧 `.blend` 基线为 `14ef5d55eeb81a287f2820b54f7aa05355cea663105d33dca7df0c9c5f040221`。
- `团子动作预览.mp4`：8.334秒／125帧／15fps 的本地 Blender 动作检查视频，原地片段，世界移动与转向由网页处理；视频按仓库规则忽略，不提交。

本轮源文件：[tuanzi.blend](../../assets/tuanzi-3d/tuanzi.blend)。本地预览启动后访问 `http://localhost:5173/tuanzi.html`。

数字结果：尾巴中途穿地从约24.8mm修至全过程离地；坐下／起身四爪基本固定；四条网页路线及转身的支撑爪最高漂移为身长0.583%；18,874面、glb约1.16MiB。身体蒙皮仍有最高0.261mm的脚底误差。没有重新通过1440×900／55fps性能要求，不能把动作检查全过描述为全部验收通过。
