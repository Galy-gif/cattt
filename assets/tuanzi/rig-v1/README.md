# rig-v1 素材锁定记录

> **2026-09-11 晚起作废**：骨骼拼接方案已撤销，改为全部逐帧（见 `docs/决策/2026-09-11.md`）。这些零件没有进入 App；P00 站立全身图被 frames-v5 用作侧面比例参考。


委托单 `brief.md`；方案（2026-09-27 从当前版本删除，原件在 git 历史）；
验收报告 `outputs/rig-v1-review/验收报告.md`。原始交付保留在 `outputs/rig-v1-delivery/`，不改动。

## 已锁定（2026-09-11）

以下全部来自第 1 轮，过了五道关，不再重出。零件是紫底原图，去底、裁颈帽、近端渐隐在后续标准化时做。

| 编号 | 交付文件 | 轮次 | SHA-256 |
|---|---|---|---|
| P00-rest-pose | `P00-rest-pose/P00-rest-pose__r1.png` | r1 | `6baf5abef7114e56…` |
| P01-head | `P01-head/P01-head__r1.png` | r1 | `041eff7c52f8e618…` |
| P02-ear-near | `P02-ear-near/P02-ear-near__r1.png` | r1 | `e0150cf0cde6ceba…` |
| P03-ear-far | `P03-ear-far/P03-ear-far__r1.png` | r1 | `7a3bab28b8674723…` |
| P04-torso | `P04-torso/P04-torso__r1.png` | r1 | `418dc17a272ba5a9…` |
| P05-foreleg-upper | `P05-foreleg-upper/P05-foreleg-upper__r1.png` | r1 | `0676126f0d53d68f…` |
| P06-foreleg-lower | `P06-foreleg-lower/P06-foreleg-lower__r1.png` | r1 | `4e502f7894e69996…` |
| P07-hindleg-thigh | `P07-hindleg-thigh/P07-hindleg-thigh__r1.png` | r1 | `25d2d1f6258315cd…` |
| P08-hindleg-lower | `P08-hindleg-lower/P08-hindleg-lower__r1.png` | r1 | `930f47acbfb03388…` |
| P09-tail | `P09-tail/P09-tail__r1.png` | r1 | `63b531b1399759e6…` |
| F01-felt-grain | `F01-felt-grain/F01-felt-grain__r1.png` | r1 | `541ad889719e327c…` |

- P00 是零件的尺子和拼装对照，不进 App。
- 零件拼回 P00 的轮廓重合度 0.914。头比 P00 略圆，绑骨时放大约 12%。

## 待定

- T01–T05：各有一张候选，出自模型的废稿目录，按数值判据可用，等用户看。T01–T04 的猫比运行时大 30%–70%。
- T06：两张都否，爪子搭在竖桩上。本轮不需要。

## 历次否决

- P00 第 1 次：真透明输出带棋盘格，模型自行改用紫底重出。
- T 系列：模型以"场景被重画"为由自判失败，这是委托单写了"场景一点不许变"导致的，数值上场景是保住的。

> 2026-09-12：P01–P09 零件与 `_rejected/` 已从当前版本删除（原件在提交 `3f74d85`）；保留 P00（frames-v5 的侧面比例参考）与 F01（世界层毛毡纹理的来源）。