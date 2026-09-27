# atmosphere-v1 素材锁定记录

委托单 `brief.md`；方案 `docs/方案/情绪-喝水-时段与雨天-方案-2026-09-12.md` 第 4 节；验收报告 `outputs/atmosphere-v1-review/验收报告.md`（含 Claude 的独立复核与叠图测试）。
原始交付保留在 `outputs/atmosphere-v1-delivery/`，不改动。用户 2026-09-12 看过 `sheets/atmosphere-directions.jpg`、`sheets/atmosphere-props.jpg` 与两张叠图对照后批准锁定。

## 已锁定（2026-09-12，第 1 轮）

| 编号 | 交付文件 | 轮次 | SHA-256 | 用途 |
|---|---|---|---|---|
| A1-dusk | `A1-dusk/A1-dusk__r1.png` | r1 | `c2b52ea7488f31b7…` | 黄昏方向图，只取代码分级参数，不进 App |
| A2-evening | `A2-evening/A2-evening__r1.png` | r1 | `8b50567014531058…` | 傍晚方向图，同上 |
| A3-night | `A3-night/A3-night__r1.png` | r1 | `50a168cbf2c0ccbc…` | 夜晚方向图，同上 |
| A4-rain | `A4-rain/A4-rain__r1.png` | r1 | `5d12b39f72aadb43…` | 雨天方向图，同上 |
| P1-bowl-empty | `P1-bowl-empty/P1-bowl-empty__r1.png` | r1 | `68e52caee4054fdf…` | **不接入**，留作参考（材质与贴图里的碗不配） |
| P2-bowl-full | `P2-bowl-full/P2-bowl-full__r1.png` | r1 | `d982256e88890c4c…` | **只取水面椭圆**，贴进贴图原碗；碗身不换 |
| S1-sun | `S1-sun/S1-sun__r1.png` | r1 | `0ebf0ecdd50ae059…` | 夕阳物件 |
| S2-moon | `S2-moon/S2-moon__r1.png` | r1 | `a789dee33705ced7…` | 月亮物件 |
| S3-stars | `S3-stars/S3-stars__r1.png` | r1 | `7e2af3e694035095…` | 星星，按连通块切成 5 个 |
| S4-raincloud-a | `S4-raincloud-a/S4-raincloud-a__r1.png` | r1 | `ba86bde2bd883f9a…` | 雨云 A |
| S4-raincloud-b | `S4-raincloud-b/S4-raincloud-b__r1.png` | r1 | `fd4fb31dbcd8559b…` | 雨云 B |
| S5-window-lit | `S5-window-lit/S5-window-lit__r1.png` | r1 | `58e745e91b4404da…` | 亮窗补丁，按木框十字对齐盖在 `world-v2-house.png` 的圆窗上 |

## 已接入（2026-09-12）

`assets/tools/configure_world_v6.py` 生成水面、亮窗、日月星雨云贴图并改场景配置；分级参数在 `ios/Maomao/Model/Atmosphere.swift`。记录原文（原文 2026-09-27 从当前版本删除，原件在 git 历史）；本轮验收报告在 `outputs/atmosphere-v1-review/验收报告.md`。

## 加工时做的

- 物件去底：背景已是精确 `#FF00FF`，按色距取前景、边缘羽化一像素。
- 亮窗：按贴图圆窗的棕色十字包围盒（x 892–1199、y 600–898）缩放对齐，见验收报告"叠图测试"。
- 水面：从 P2 里按青蓝色取碗口内的椭圆，缩放到贴图蓝碗的碗口（x 973–1145、y 940–1049 的上沿）。
- 方向图的分级参数：分别量 A1–A4 天空区、地面区的中位 Lab，写进代码时注明来源。
