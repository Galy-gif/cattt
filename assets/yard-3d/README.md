# 3D 院子（电脑网页版）

方案：[网页版-院子页面与天气-方案](../../docs/specs/网页版-院子页面与天气-方案-2026-09-17.md)；实施记录：[实施与验收](../../docs/specs/网页版-院子页面与天气-实施与验收.md)；决定：[决策-2026-09-17-网页版](../../docs/决策-2026-09-17-网页版.md) 第 6–12 条。

物件的形状和颜色都在 `build_yard.py` 里（配色表 `PALETTE` 取自 iOS 院子现行素材）。毛毡质感不在 Blender 里做：网页端按**材质名**把 glb 的材质换成毛毡（`web/src/yard/felt.ts`），所以材质名也是约定的一部分。

## 文件

| 文件 | 是什么 |
|---|---|
| `layout.py` | 2D → 3D 的换算（院子宽 6 m、纵深系数、中线）和所有物件的落点。**要挪东西改这里**，两个脚本和网页端都从它来 |
| `make_paths.py` | 把 `assets/scenes/courtyard-v4/scene.json` 的路网、目的地、池塘轮廓和落点换算成 3D，生成 `web/src/yard/layout.generated.ts` |
| `build_yard.py` | 用 Blender 建蘑菇屋、水盆、信箱、猫窝、大树与吊窝、木牌、栅栏、小花，导出 glb |
| `yard.blend` | Blender 源文件。**手调过就以它为准**，脚本发现哈希对不上会拒绝覆盖 |
| `build-manifest.json` | 上次生成的 `.blend` 哈希、glb 大小、三角面数 |
| `renders/` | 生成时的俯视、正面白模渲染，不进仓库 |

地形、小路、池塘水面、石头、草、远山、云、天空、雨在网页里程序生成（`web/src/yard/world.ts`），不在 Blender 里。

## 怎么跑（仓库根目录）

```bash
python3 assets/yard-3d/make_paths.py
blender -b --factory-startup -P assets/yard-3d/build_yard.py
```

改了 `layout.py` 两个都要重跑。`--no-render` 不出渲染；`--force` 覆盖手调过的 `.blend`。

## 和网页端的约定

- 坐标：单位米，Y 朝上，+Z 朝镜头（和团子"脸朝 +Z"一致）。Blender 里 Z 朝上，世界 +Z = Blender 的 -Y，导出时自动换。
- 节点名：`house`、`house_window`、`house_door`、`bowl`、`bowl_water`、`mailbox`、`mailbox_flag`、`bed`、`tree`、`tree_crown`、`nest_pivot`（吊绳挂点，吊窝绕它晃）、`board`、`fence`、`flower`。
- 材质名 `window_glow` 是窗灯，网页端按时段给它自发光；`water` 是水盆水面；这两个不换毛毡。`rope`（吊窝）用更粗的起伏。其余材质一律换成默认毛毡，颜色沿用 glb 里的。
- 尺度以团子为尺（身长 0.38 m）：iOS 里整个院子约 12.5 个身长宽，这里略放宽到 6 m。
