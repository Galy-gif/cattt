# frames-v5 素材锁定记录

委托单 `brief.md`；规则 `docs/specs/逐帧v5-出图与播放规则-2026-09-11.md`；验收报告 `outputs/frames-v5-review/验收报告.md`。
原始交付保留在 `outputs/frames-v5-delivery/`，不改动。

## 已锁定（2026-09-12，第 1 轮）

| 编号 | 交付文件 | 轮次 | SHA-256 |
|---|---|---|---|
| N1-prepare | `N1-prepare/N1-prepare__r1.png` | r1 | `1ca246532e2e4da5…` |
| N2-jump | `N2-jump/N2-jump__r1.png` | r1 | `e297d616b37c9fe3…` |
| N3-climb | `N3-climb/N3-climb__r1.png` | r1 | `4f0f3a9ee1ac35bc…` |
| N4-settle | `N4-settle/N4-settle__r1.png` | r1 | `1d482748cdfa954e…` |
| N5-look | `N5-look/N5-look__r1.png` | r1 | `34ca54edc0aba5fc…` |
| N6-sleep | `N6-sleep/N6-sleep__r1.png` | r1 | `d8a1fe36ef2ba3be…` |
| N7-out | `N7-out/N7-out__r1.png` | r1 | `ae565fdd718092f4…` |
| N8-land | `N8-land/N8-land__r1.png` | r1 | `373555a38f79604c…` |
| W1-walk-toward | `W1-walk-toward/W1-walk-toward__r1.png` | r1 | `3d2fb8e35840ab37…` |
| W2-walk-away | `W2-walk-away/W2-walk-away__r1.png` | r1 | `46d60f8e17ef340e…` |
| W3-turn | `W3-turn/W3-turn__r1.png` | r1 | `27221579b54db2a4…` |
| K1-rope | `K1-rope/K1-rope__r1.png` | r1 | `af92dd59baa94a07…` |

## 加工时要做的

- 按连通块切猫，不按格子切。
- 按验收报告里的缩放表把各张统一到同一头宽。
- 画法：用户 2026-09-12 选定"调色到旧的柔和画法"，由 `assets/tools/package_frames_v5.py` 完成。
- 去底用逐格背景色，再处理边缘洋红残留。
