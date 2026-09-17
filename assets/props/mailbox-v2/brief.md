# 院子信箱 v2 · 出图委托单 · 2026-09-16

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 2 张，每张单独生成。**
这是场景物件，不是猫的动作帧，格式和逐帧委托单不同。

**这一轮要解决的是一件事：现在的信箱和整个院子不是一套材质。**
蘑菇屋、树窝、栅栏都是厚实的毛毡／毛线，有编织纹理、有厚度、有体积光；
现在的信箱是扁平矢量——纯色块、虚线假装缝线、没有厚度也没有投影，而且是全院最亮的东西。
造型也一起换（用户定的）。

---

## 一、六条硬规矩（先读）

1. **单张全幅，不出网格。** 一个编号一张图，物件居中，四周留白。
2. **文件名必须是 `编号__r轮次.png`**，例如 `P1-mailbox__r1.png`。
3. **失败必须上报，禁止拿旧图顶替。** 交付附 `delivery.json`，状态只能是 `new`、`failed`、`skipped`。验收第一步是和历史所有素材比哈希。
4. **只画这一件物件。** 不画地面、草、花、阴影、背景道具、文字、编号。背景纯色 `#FF00FF` 平涂，禁止棋盘格。
5. **材质锁指向邻居那几件具体的东西，不是指向"世界观"。** 看第二节的参考图 —— 判的是"和 N1、N2、N3 是不是一套手工做出来的"，不是"像不像毛毡风格"。
6. **母版先行：P1 过了再出 P2。** P1 不过就停。

---

## 二、参考图（材质锚，比文字重要）

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| N1 | `../../../ios/Maomao/Resources/WorldTextures/world-v2-house.png` | **首要材质锚**：蘑菇屋。针毡的厚度、编织的伞盖、木门的质感、体积光的打法 | `a7a006ccb569` |
| N2 | `../../../ios/Maomao/Resources/WorldTextures/world-v4-nest.png` | 树窝：粗毛线编织的立体感、绳股的画法 | `9e90d6441d88` |
| N3 | `../../../ios/Maomao/Resources/WorldTextures/world-v2-fence.png` | 栅栏。**注意：这张图里本来就有一个红色小信箱**，那个小信箱就是这个院子该有的信箱长什么样 —— 材质、比例、颜色都照它 | `0084e61eed22` |
| X0 | `../../../ios/Maomao/Resources/WorldTextures/world-v5-mailbox.png` | **反面教材**：现在这个要被换掉的信箱。传给你是为了说明什么叫不对 —— 扁平色块、虚线描边、没有厚度。**不要照它画** | `2d1120cd11d5` |

N3 里那个红色小信箱是这一轮最重要的参考：它已经在这个院子里、已经被接受、材质已经对了。
**这一轮本质上是把它做大、做成独立的一件。**

---

## 三、格式

- 单张竖图，**至少 1024 × 1536**，越大越好（只许缩不许放；运行时只有 66 × 122 pt）。
- 物件居中，完整不裁切，四周至少留 80px 空白。
- 背景纯 `#FF00FF` 平涂。
- 光从左上打来，和院子里其它物件一致。

> 画面里物件的位置和留白不用精确 —— 接入时会由整理脚本重新裁剪和对齐画布。
> 你只要把这一件东西画好、画完整、四周留白够。

---

## 四、逐张要求

### P1-mailbox · 信箱本体（母版，先出这一张）

```
Reference N1 (mushroom house), N2 (rope nest) and N3 (fence) are approved props from the same courtyard.
Match their craft exactly: hand-made needle-felted and knitted objects, photographed straight on with soft
even light from the upper left. Visible wool fibre texture, visible knit or felt weave, real thickness at
every edge, a soft contact shadow where parts meet, gently irregular hand-made shapes.
N3 contains a small red mailbox at the fence: THAT is what this courtyard's mailbox looks like. Make that
same mailbox as a standalone, larger object.
X0 is the OLD mailbox being replaced: flat colour blocks, dashed lines pretending to be stitching, no
thickness, no shadow, and far too bright. Do NOT copy anything from X0.

Draw: a small felted mailbox on a wooden post, standing alone.
The box is a rounded rectangular felt body, deeper than it is wide, in warm barn red with a cream underside;
its front has a horizontal letter slot — a real recessed opening with visible thickness at the lip, not a
painted line. A small rounded door with a tiny wooden knob. The roof is a gently curved felted cap.
The post is a knotted, slightly uneven wooden stake, felt-wrapped near the top, planted straight down.
On the RIGHT side of the box, near the top, a short flag post with a small bracket — leave the flag itself
OFF this image, but draw the bracket it mounts into.
Warm muted colours that sit alongside N1 and N3: nothing brighter than the cream of the mushroom house roof spots.
Only the mailbox and its post. No ground, no grass, no flowers, no shadow cast onto a surface, no text, no numbers.
Flat pure #FF00FF background, no checkerboard.
```

### P2-mailbox-flag · 小旗子（把 P1 作为参考图传入）

旗子在 App 里会绕**旗杆底端**旋转（有新日记就翻起来），所以必须单独一张、竖着画、杆底在图的正下方中点。

```
Reference P1 is the approved mailbox this flag mounts onto: match its felt material, colours and outline exactly.
Draw: the small signal flag for that mailbox, standing alone and UPRIGHT.
A short slim wooden post running straight down the centre of the image, its bottom end at the very bottom
centre of the image. At the top of the post, on the RIGHT side, a small felted flag: a rounded rectangle of
warm red felt with a simple cream envelope shape stitched onto it, with real felt thickness at the edges.
The flag is attached along the post, not floating.
Only the post and the flag. No mailbox, no ground, no shadow, no text.
Flat pure #FF00FF background, no checkerboard.
```

---

## 五、判据

| 量什么 | 过线 | 为什么是这个数 |
|---|---|---|
| 背景 | 纯 `#FF00FF`；非洋红像素占比 ≤ 0.5%；无棋盘格 | 历轮规矩，去底脚本按这个吃 |
| 画布 | ≥ 1024 × 1536，物件四周留白 ≥ 80px | 运行时 66×122pt，@3x 需要 197×367px；出图必须比运行时大，只许缩不许放 |
| 不透明区亮度中位数 | **落在 96–173 之间** | 院子里所有实体物件的实测区间：栅栏 96、猫窝床 103、蘑菇屋 120、树窝 173。现在的信箱是 **218**，比最亮的花（194）还亮，所以它在画面里跳出来。这条能量、能判 |
| 投信口 | 是一个有厚度的凹口：口的上唇和下唇有可见的明暗差，不是一条画上去的线 | 纸要从这里抽出来，口必须读得出是个洞 |
| 旗杆底端（P2） | 在图的底边中点，水平偏差 ≤ 图宽的 3% | 旗子绕杆底旋转，轴点偏了旗子会甩出去 |
| 两张的材质是否同一套 | **人眼判，请用户看** | 见下 |

### 作废的判据（写明原因，不许事后补回来）

出图前试过两条"用数字判材质"的判据，都在已有素材上跑不通，**当场作废**：

- **局部纹理方差**（5×5 邻域标准差中位数）：现在的扁平信箱 5.99，蘑菇屋 6.91、树窝 7.11、栅栏 7.26。差别只有 15%，
  而信箱的虚线描边本身也算进了"纹理"。这条区分不开扁平矢量和毛毡。
- **明暗跨度**（P90−P10 亮度）：信箱 135，蘑菇屋 158、树窝 157、栅栏 96、猫窝床 100。信箱落在邻居区间之内。这条也区分不开。

结论：**材质这件事这一轮没有可量的代理指标，只能靠图参考锁 + 人眼比对。**
所以第二节的参考图是这份委托单里最重要的部分，比所有文字描述都重要。

---

## 六、接入时会做的事（交付方不用管，写在这里是为了说明留白为什么可以随意）

1. 去底 → 归一化洋红 → 按院子里的位置重新裁剪、对齐到 540 × 1010 的画布比例。
2. 落 `ios/Maomao/Resources/WorldTextures/world-v7-mailbox.png` 与 `world-v7-mailbox-flag.png`。
3. 用原地修改的场景脚本改 `world-scene-v4` 里 `mailbox` / `mailbox-flag` 两条的 `image`；**不要重跑 `configure_world_v4.py`**。
4. 投信口在贴图里的高度如果和现在这版不同，改 `WorldView.swift` 里 `rect.height*0.36` 那一个系数 —— 一行，不是障碍。
5. 跑 `python3 assets/tools/validate_world_v4.py <构建好的 .app>`。

---

## 七、交付

```
mailbox-v2-delivery/
  delivery.json
  P1-mailbox/P1-mailbox__r1.png
  P2-mailbox-flag/P2-mailbox-flag__r1.png
  _rejected/
```

**先交 P1 一张等验收，过了再出 P2。**
