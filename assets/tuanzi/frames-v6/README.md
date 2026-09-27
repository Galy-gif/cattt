# frames-v6 素材锁定记录

委托单 `brief.md`；方案 `docs/方案/情绪-喝水-时段与雨天-方案-2026-09-12.md`；验收报告 `outputs/frames-v6-review/验收报告.md`（含 Claude 的独立复核）。
原始交付保留在 `outputs/frames-v6-delivery/`，不改动。用户 2026-09-12 看过 `outputs/frames-v6-review/sheets/frames-v6-overview.jpg` 后批准锁定。

## 已锁定（2026-09-12，第 1 轮）

| 编号 | 交付文件 | 轮次 | SHA-256 | 用哪些格 |
|---|---|---|---|---|
| H1-sit-look | `H1-sit-look/H1-sit-look__r1.png` | r1 | `89d3323cd129ac40…` | 1–6，循环 |
| H2-head-tilt | `H2-head-tilt/H2-head-tilt__r1.png` | r1 | `0a57eb7bbb35c389…` | 1–6，循环 |
| H3-groom | `H3-groom/H3-groom__r1.png` | r1 | `6efd625c2b5bd3a4…` | 1–6，循环 |
| M1-happy | `M1-happy/M1-happy__r1.png` | r1 | `3acf79102d38967c…` | 1–6，循环 |
| M2-sulk | `M2-sulk/M2-sulk__r1.png` | r1 | `42d80d53931f7125…` | 1–6，循环 |
| M3-sad | `M3-sad/M3-sad__r1.png` | r1 | `f1aa2a9da5b84d5a…` | 1–6，循环 |
| D1-drink-down | `D1-drink-down/D1-drink-down__r1.png` | r1 | `5f327c2a2f26a63a…` | 1–6，一次 |
| D2-drink-lap | `D2-drink-lap/D2-drink-lap__r1.png` | r1 | `bf13fd3fa6a9725a…` | 1–6，循环 |
| D3-drink-up | `D3-drink-up/D3-drink-up__r1.png` | r1 | `9cf5d0947742aff4…` | **只用 1、2、3、6**；第 4、5 格有拖影和"＞＜"眼，作废 |

## 要知道的

- 交付方在交付前用 `assets/tools/prepare_v6_deliveries.py` 把 N4 第 3 格原样贴进了 H1 / H2 / H3 / M3 的第 1 格。贴入格与第 2 格头宽一致、身高差约 5%；循环回头若有可见的跳，打包时把第 1 格按比例缩，不重出。
- 画法与 v5 交付一致（偏艳、描边偏硬），打包时按 v5 的办法 Lab 调色到旧的柔和画法。

## 已接入（2026-09-12）

`assets/tools/package_frames_v6.py` 切帧打包进 `Assets.xcassets/world-v6/`，动作目录 13 个 v6 动作（另外三个是过渡：`moodSadOut` 用 M3 第 2、1 格倒放，`sitToStand` / `standToSit` 用 v5 交付 N4 的第 1–3 格）；记录原文（原文 2026-09-27 从当前版本删除，原件在 git 历史）；本轮验收报告在 `outputs/frames-v6-review/验收报告.md`。

## 加工时做的

- 按连通块切猫，不按格子切。
- 坐姿系列（H、M）统一到与 `sleepyNod` 同头宽，锚点是坐姿的臀部落地线；喝水系列（D）统一到与侧面走同头宽，锚点是脚底，并记下嘴在碗沿的接触点（三张一致，交付方量得 317px）。
- 去底用逐格背景色（本批背景已是精确 `#FF00FF`），再处理边缘洋红残留。
