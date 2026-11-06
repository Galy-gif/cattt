# 3D 团子（电脑网页版）

方案：[网页版-3D团子小样-方案](../../docs/方案/网页版-3D团子小样-方案-2026-09-17.md)；决定：[决策-2026-09-17-网页版](../../docs/决策/2026-09-17-网页版.md)。

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

该轮 18,874 三角面，glb 1,217,456 字节。量测、对照与边界见 优化记录（2026-09-27 从当前版本删除，原件在 git 历史）和 [验收目录](../../outputs/web-tuanzi-refinement-review/README.md)。

```bash
blender -b --factory-startup assets/tuanzi-3d/tuanzi.blend -P assets/tuanzi-3d/review_tuanzi.py -- --label=after --render
pnpm --dir web exec tsc --noEmit false --outDir node_modules/.cache/tuanzi-check
node assets/tuanzi-3d/verify_runtime.mjs
```

## 2026-09-17 后续反馈：轻巧体态与柔软短绒

用户指定瘦身、大耳大尾、头颈分界与 IMG_9068.PNG 的柔软 QQ 质感。本轮方案与实测（2026-09-27 从当前版本删除，原件在 git 历史）；参考原图在 `refs/IMG_9068.PNG`，仅借材质方向。

主躯干宽度收 14.9%、厚度收 19.3%，头部上提 25mm，颈胸收窄；耳轴增长34.7%，尾链增长37.5%、尾根半径增加20.7%。尺寸是生成参数和曲线弧长，未缩放整猫。橙色、额纹、身纹、环尾和原眼嘴保留。

主体材质使用柔和受光与绒面边缘光，网页四层2.8mm短绒共用毛根并渐细，低透明度混合避免砂粒感。网页薄壳不是 `.blend` 中的离线毛发系统；Blender 保留柔软表面，实际绒毛效果在网页验。四层共用网格与骨骼，文件只存18,878原始三角面；渲染开启绒毛时额外提交71,992面，不把额外开销隐藏在原始面数中。

走路的抬脚、头部延迟、耳尖轻摆和胸背约0.8%局部弹性重烘；保留足底锁定及七段动作。额头中心减面法线起伏按距离场梯度修正。`--animations-only --polish-surface` 可在原UV上局部修整额头，不改纹样；完整生成也包含该步骤。

当前模型1,158,220字节；已通过网页构建、最终GLB动作回归和逐帧接触检查。对照与动画位于 `outputs/web-tuanzi-lively-review/`；视觉仍待用户评审。

## 2026-09-17 耳位、前胸、坐姿与口鼻

在灵动短绒版上改，头的大小和形状不动。诊断、数值与和被否那版的区别见 [方案](../../docs/方案/网页版-团子耳位前胸坐姿口鼻-实施与验收-2026-09-17.md)，量测与恢复办法见 [验收目录](../../outputs/web-tuanzi-face-sit-review/README.md)。外形用户已确认，是当前展示版本。

- 前腿显长的原因是胸口缩在腿后面、腿从下巴直通到地：补了前胸（`TORSO` 第四项），腿以上整体下沉 14 mm，小腿加粗。
- 坐姿：骨盆后倾 40°、后三节脊柱弓回、前爪各收一小步（`sit_amount_body`）。前腿站着已经伸直，肩不能抬；肩还要再低几毫米，不然呼吸会带着前爪浮动。
- 耳：前移 12 mm、略小；耳杯沿耳面浅凹并往耳根渐隐（`sd_ear`、`sd_ear_cup`），不再整块椭球挖。
- 口鼻：圆角小粉鼻；下面隔开一段是短粗、两头圆的深棕"ω"嘴，鼻嘴之间不画人中（用户给了参考图）；口鼻处一个很浅的鼓包（`MUZZLE`、`NOSE_*`、`MOUTH_*`）。
- `fix_folds`：对称减面会在中线留下翻折小三角面，高光下是亮斑；减面后自动并掉。

只改纹样（嘴、纹、耳内色）时加 `--repaint`：沿用 `renders/bake-cache.npz` 里上次烘的位置／法线／遮蔽，不重烘；外形改过就不要加。

当前 18,870 三角面，glb 1,143,136 字节。

## 2026-10-05 生活动作第一批

`add_life_animations.py` 在哈希一致的现有模型上增量维护十段动作（七段基础动作保留；10月10日新增门口坐下/起身衔接），不重建外形、UV、蒙皮或贴图。`bed_hop` 为1.4秒起落，睡下1.8秒、睡眠呼吸4.8秒、睡醒1.6秒、门口坐下1.6秒、瞌睡5.6秒、起身1.4秒、喝水低头1.6秒、舔饮循环2.4秒、抬头1.4秒。运行时舔饮三轮后站稳才回执完成；眼睛与舌尖在网页运行时驱动。

`review_life.py` 默认只量烘焙片段，加 `-- --render` 才出独立姿势图。真实场景接触以 `verify_runtime.mjs` 的导出GLB与HomeBehavior逐帧检查为准，包括进/出窝、软垫承托、尾巴过沿和舌尖水面接触。编译命令需加 `--rewriteRelativeImportExtensions true`。

可编辑blend（已压缩）超过3MB，按美术源文件规则单项登记；分发GLB仍小于3MB。见[验收报告](../../outputs/tuanzi-life-review/验收报告.md)。

2026-10-10 按用户反馈修正：睡姿收折前腿、头部落下；进窝后横向躺好。门口先转正再进入专用坐姿。喝水的舔饮点头、短停吞咽和盆内水纹共用2.4秒周期。见[修正记录](../../outputs/tuanzi-life-review/2026-10-10-动作修正.md)。

## 2026-10-10 第二批生活动作

第一批17段已获用户观感确认并保持动画采样哈希。`add_life_animations.py -- --expressions-only` 只烘焙第二批：歪头、抬爪理毛、开心、闷着、难过，各有进入/持续/退出，共新增15段、总32段；不改变网格、UV或权重。正常行为复用原有性格/情绪权重，理毛舌尖朝爪面短促舔动。实施与验收见[第二批报告](../../outputs/tuanzi-expression-review/验收报告.md)，观感待用户确认。


## 2026-10-10 第三批树窝动作

`add_life_animations.py --nest-only` 增量烘焙11段，总43段；原32段采样哈希保持。运行时 `NestMotion` 管理起跳、抓沿、爬入、转身、看/睡、醒来、转身退出、爬出、落地；转出复用转身片段。正式首页切换树下休息/看院子会进入吊窝，换地点先落地。验收与边界见[树窝报告](../../outputs/tuanzi-nest-review/验收报告.md)。

复验：先按上方命令编译运行时，再执行 `node assets/tuanzi-3d/verify_nest.mjs`；其真实GLB采样保存在 `/tmp/maomao-nest/`，由 Blender 执行 `check_nest_contact.py` 量测壳、窝沿和垫子。浮动支撑与重建另外做运行时断言，不能用离线单姿势代替。

树窝睡姿收到“像站着、要躺下露脸”反馈后，使用 `--nest-sleep-only` 仅重烘三段睡姿；身体侧向开口、头转回露脸，其余40段保持。修正版于2026-10-11获用户确认，见树窝报告。

## 2026-10-11 池塘互动

`add_life_animations.py --pond-only` 增量烘焙5段，总48段；原43段逐轨哈希保持。探爪试水一次、拍水两次、收爪甩水后站回；水纹按真实前爪接触触发。运行时验证用 `verify_pond.mjs`，量测与观感边界见[池塘报告](../../outputs/tuanzi-pond-review/验收报告.md)。

## 2026-10-11 栅栏动作

`add_life_animations.py --fence-only` 只烘栅栏12段，总60段，原48段逐轨哈希保持。`FenceMotion`驱动够、跃起抓稳、攀上、转身趴卧及安全下来，根节点与动作使用同一时刻避免接触差一帧。验证用 `verify_fence.mjs`，见[栅栏报告](../../outputs/tuanzi-fence-review/验收报告.md)。

栅栏首版跳起/转身于同日收到“太丝滑”反馈，已改压低蓄力、短促起落、交替挪爪及独立反向转身；修正版于2026-10-12获用户确认。

## 2026-10-12 扑花

`add_life_animations.py --flower-only` 增量烘焙6段，总66段，已确认60段逐轨哈希保持。`FlowerMotion` 驱动盯花、蓄力、短扑、轻碰、退回与站稳；花在真实前爪接触后回摆，支持暂停、恢复与半空退出。复验执行 `node assets/tuanzi-3d/verify_flower.mjs`（先按上述命令编译运行时），见[扑花报告](../../outputs/tuanzi-flower-review/验收报告.md)。同日用户确认扑花观感。

## 2026-10-12 抓树

`add_life_animations.py --scratch-only` 新增抬爪、搭稳、抓挠3段，总69段，已确认66段逐轨哈希保持。`ScratchMotion` 管理抬爪、搭稳、交替抓挠、收爪、站稳五阶段；抓挠循环四次，收爪反向采样抬爪片段，站稳复用 `fence_land`，分发模型保持3MiB以内。双后爪落地，双前爪按树干表面分别校准。复验 `verify_scratch.mjs`（先编译运行时），见[抓树报告](../../outputs/tuanzi-scratch-review/验收报告.md)。同日用户确认模拟器观感。

## 2026-10-12 追尾巴

`ChaseMotion` 叠加胸腹C形蜷身、尾巴外侧留距和颈头分担的受限转向，一圈2.8秒，并按24个小步调用现有两节腿IK，承重爪固定世界落点。新增运行时行为，不改变GLB及69段动画。验证执行 `verify_chase.mjs`（先编译运行时），见[追尾巴报告](../../outputs/tuanzi-chase-review/验收报告.md)。颈部修正版观感已获用户确认。

## 2026-10-12 伸懒腰

`StretchMotion` 分伸爪、压胸、停留、起身、收爪五阶段；局部IK锁定前爪，后脚抬跟撑起臀部18mm，收势恢复。复用69段模型包，支持中断收势与快照恢复。验证 `verify_stretch.mjs`（先编译运行时），见[伸懒腰报告](../../outputs/tuanzi-stretch-review/验收报告.md)。抬臀修正版观感已获用户确认。

## 2026-10-12 小跑

`RunMotion` 用对角爪交替支撑前进0.78m，包含准备、12步小跑、收势；起跑前检查边界与障碍。69段模型包保持。验证 `verify_run.mjs`（先编译运行时），见[小跑报告](../../outputs/tuanzi-run-review/验收报告.md)。节奏修正版观感已获用户确认。
