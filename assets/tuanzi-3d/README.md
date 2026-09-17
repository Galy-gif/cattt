# 3D 团子（电脑网页版）

方案：[网页版-3D团子小样-方案](../../docs/specs/网页版-3D团子小样-方案-2026-09-17.md)；决定：[决策-2026-09-17-网页版](../../docs/决策-2026-09-17-网页版.md)。

## 文件

| 文件 | 是什么 |
|---|---|
| `build_tuanzi.py` | 一次生成外形、纹样、骨骼、动作并导出。尺寸、颜色、骨骼名、动作都在脚本开头和对应小节里 |
| `tuanzi.blend` | Blender 源文件。**手调过就以它为准**，脚本发现哈希对不上会拒绝覆盖 |
| `build-manifest.json` | 上次生成的 `.blend` 哈希与 glb 大小 |
| `textures/tuanzi_color.png` | 烘好的颜色贴图（2048²）：身纹、额纹、尾环、耳内、嘴、趾缝、低对比短绒底色、环境遮蔽 |
| `compare_refs.py` | 侧面渲染与 R3 的剪影叠影和比例 |
| `review_tuanzi.py` | 只读加载 `.blend`，逐帧量脚掌／尾部／网格离地、循环接缝和三视图 |
| `verify_runtime.mjs` | 导出 glb 与真实网页动作控制器的回归检查（Node 只去掉贴图，不测 GPU） |
| `assemble_review.py` / `render_motion.py` | 同倍率前后对照、文件哈希、Blender 动作视频 |
| `renders/` | 生成时的固定机位渲染，不进仓库 |

网页用的模型导出到 `web/public/models/tuanzi.glb`。

## 怎么跑（仓库根目录）

```bash
blender -b --factory-startup -P assets/tuanzi-3d/build_tuanzi.py -- --until=all
python3 assets/tuanzi-3d/compare_refs.py final
```

`--until=shape|texture|rig` 只做到某一步并出渲染；`--reuse-texture` 在外形没改时跳过约 3 分钟的烘焙；`--no-render` 不出渲染；`--force` 覆盖手调过的 `.blend`。

`--animations-only` 读取哈希一致的 `.blend`，只重建七段动作、保存并导出，保留网格和贴图。手调保护同样生效，不要用 `--force` 绕过未经确认的手调变化。

只改蒙皮时加 `--animations-only --rebind`，在现有网格上重算权重并做六轮邻接平滑，不改顶点或贴图。新建模型默认也包含同样的平滑。

需要 Blender 5.2（Homebrew：`brew install --cask blender`），脚本只用 Blender 自带的 Python、numpy 与 openvdb。

## 怎么做的

1. **外形**：躯干、头、腮、耳、四条腿、尾巴各是一个带圆角的距离场，平滑并集成一整块，用 openvdb 抽面，平滑后减面到约 1.8 万三角面。一整块是因为 09-11 零件拼装被否。
2. **纹样**：展 UV 后把每个像素对应的表面位置、法线、环境遮蔽烘出来，再按位置在 numpy 里画纹样，颜色取自 R1。
3. **骨骼**：32 根，名字是和网页端的约定（`root`、`spine_01–04`、`neck_01–02`、`head`、`ear_L/R`、`front|hind_L|R_upper|lower|paw`、`tail_01–10`）。蒙皮权重按部位分，再沿骨链插值，部位交界按距离过渡。
4. **眼睛**：单独的小网格，形态键 `blink` 是闭眼。
5. **动作**：每帧摆身体、给四只爪子设目标点，Blender 的 IK 解腿后烘成关键帧，所以站、坐、走时着地的爪子不动。片段：`idle`、`walk`（步长记在骨架的 `strideLength`）、`turn_step`、`sit_down`、`sit_idle`、`stand_up`、`ear_flick`。
6. **导出**：每段动作一条 NLA 轨道（在 `.blend` 里静音，免得叠着播；导出器照样逐条导出）。导出器会让几段动作共用相同的常量关键帧数组，网页端改动作数据前要先复制，见 `web/src/tuanzi/tuanzi.ts` 里 `ear_flick` 那段。

## 2026-09-17 第一轮模型与动作细修（历史基线）

已细修头颊、胸肩、前爪与趾缝，尾尖渐细；走路脚轨迹在着地／离地时速度连续，原地转身改为四拍踏步。坐下 1.25 秒、起身 1.05 秒，前爪承重点固定；尾巴按真实骨长收向身侧，整段动作逐节防穿地。

网页恢复的是上一帧的**动画姿势**，再叠加视线／尾巴／锁脚；不能每帧回绑定姿势，否则 three.js 跳过常量关键帧时会把坐姿尾巴抹掉。B 版毛毡保留，轮廓绒毛收窄，减少胸前沙粒状噪点。

该轮 18,874 三角面，glb 1,217,456 字节。量测、对照与边界见 [优化记录](../../docs/specs/网页版-团子模型动作优化-2026-09-17.md) 和 [验收目录](../../outputs/web-tuanzi-refinement-review/README.md)。

```bash
blender -b --factory-startup assets/tuanzi-3d/tuanzi.blend -P assets/tuanzi-3d/review_tuanzi.py -- --label=after --render
pnpm --dir web exec tsc --noEmit false --outDir node_modules/.cache/tuanzi-check
node assets/tuanzi-3d/verify_runtime.mjs
```

## 2026-09-17 后续反馈：轻巧体态与柔软短绒

用户指定瘦身、大耳大尾、头颈分界与 IMG_9068.PNG 的柔软 QQ 质感。本轮方案与实测见 [灵动短绒](../../docs/specs/网页版-团子灵动短绒-2026-09-17.md)；参考原图在 `refs/IMG_9068.PNG`，仅借材质方向。

主躯干宽度收 14.9%、厚度收 19.3%，头部上提 25mm，颈胸收窄；耳轴增长34.7%，尾链增长37.5%、尾根半径增加20.7%。尺寸是生成参数和曲线弧长，未缩放整猫。橙色、额纹、身纹、环尾和原眼嘴保留。

主体材质使用柔和受光与绒面边缘光，网页四层2.8mm短绒共用毛根并渐细，低透明度混合避免砂粒感。网页薄壳不是 `.blend` 中的离线毛发系统；Blender 保留柔软表面，实际绒毛效果在网页验。四层共用网格与骨骼，文件只存18,878原始三角面；渲染开启绒毛时额外提交71,992面，不把额外开销隐藏在原始面数中。

走路的抬脚、头部延迟、耳尖轻摆和胸背约0.8%局部弹性重烘；保留足底锁定及七段动作。额头中心减面法线起伏按距离场梯度修正。`--animations-only --polish-surface` 可在原UV上局部修整额头，不改纹样；完整生成也包含该步骤。

当前模型1,158,220字节；已通过网页构建、最终GLB动作回归和逐帧接触检查。对照与动画位于 `outputs/web-tuanzi-lively-review/`；视觉仍待用户评审。
