# 团子逐帧 v5 · 出图委托单 · 2026-09-11

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 12 张，每张单独生成。**
为什么这样出、图回来怎么验收和接入，见 `docs/specs/逐帧v5-出图与播放规则-2026-09-11.md`。这份只写出图要做的事。

---

## 一、七条硬规矩（先读）

1. **一个编号 = 单独生成的一张图。** 动作帧每张固定是 3 列 × 2 行、6 格；其它编号按各自要求。
2. **文件名必须是 `编号__r轮次.png`**，例如 `N2-jump__r1.png`。编号一个字不能改。
3. **失败必须上报，禁止拿旧图顶替。** 没做成、放弃、想沿用旧图，都在 `delivery.json` 里写明。验收第一步是和历史所有素材比哈希。
4. **每一格的猫一样大。** 所有动作帧里，猫的**头宽都是约 110px**，蹲下、伸长、趴卧只改变姿势，不改变头和身体的大小。这条会逐格量，偏差超过 4% 的格子整张重做。
5. **严格照参考图画这只猫。** R1 定身份和材质，R2 定侧面画法和线条，R3 定侧面站姿比例。不重新设计，不加奶白胸口和肚皮，不写实，不做 3D 毛绒玩具。
6. **只画猫。** 不画窝、绳子、地面、阴影、道具、网格线、格子边框、文字、编号。背景用纯色 `#FF00FF` 平涂；做得到真透明也可以。禁止棋盘格。
7. **接力帧。** 同一组动作分成好几张时，后一张的第 1 格必须和前一张的第 6 格是同一个姿势。生成后一张时，把前一张作为参考图传入。

---

## 二、参考图

全部在 `assets/tuanzi/frames-v5/refs/`。

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| R1 | `R1-cat-identity.png` | 猫的身份与毛毡材质，唯一角色基准 | `d4fc0cdfc852` |
| R2 | `R2-cat-walk-side.png` | 已确认的侧面走路六帧：画法、线条、步态节奏 | `15b8c2e8b8f3` |
| R3 | `R3-cat-side-standing.png` | 侧面站姿全身，比例基准 | `6baf5abef711` |
| R4 | `R4-pose-crouch.png` | 姿势参考：窝下蓄力。**图里猫朝左、窝是旧的大窝，只看姿势** | `16e0441d51b1` |
| R5 | `R5-pose-air.png` | 姿势参考：腾空扑向窝沿 | `e3830544141e` |
| R6 | `R6-pose-grip.png` | 姿势参考：前爪抓住窝沿 | `fbbaa5239a72` |
| R7 | `R7-pose-inside.png` | 姿势参考：趴在窝里，只露头和前爪 | `2c4e0f7344ba` |
| R8 | `R8-rope-material.png` | 窝顶绳圈特写，K1 绳子的材质、粗细、颜色 | `ef00c9410e49` |
| R9 | `R9-nest-geometry.png` | 新窝的几何示意：窝沿离地约为猫站高的 1.25 倍，只比起跳点靠前一点 | `c81cbd2be832` |

R4–R9 是参考，不要把里面的场景、窝、文字画进结果。

---

## 三、动作帧的统一格式

- 画布 **1536×1024**，**3 列 × 2 行，每格 512×512**，阅读顺序从左到右、从上到下，第 1–3 格在上排，第 4–6 格在下排。
- **格子之间不画任何分隔线**，每只猫离格子边缘至少 24px，猫的任何部分都不能跨进相邻格子。
- 每格一只完整的猫，全身不裁切。
- **除 W3 外，所有猫朝右。** 参考图 R4–R7 里的猫朝左，画的时候要左右镜像。
- 每格的猫头宽约 110px。

---

## 四、通用提示词前缀

每张动作帧开头都贴 `CAT_LOCK` 和 `SHEET_LOCK`。

**CAT_LOCK**

```
Reference image R1 is the approved cat "Tuanzi": an orange tabby in soft felt-over-crayon illustration.
R2 is the approved side-view walk of this exact cat: match its drawing style, outline and felt texture exactly.
R3 is this cat standing in side view: match its proportions exactly.
Keep EXACTLY: big round slightly irregular head; small triangular ears with pink inner ear; small dark-brown
bead eyes with no highlight; tiny warm-brown mouth; three darker orange forehead stripes; broad soft body
stripes; ringed tail; thick round body with low center of gravity; short legs; small round paws with 2-3 toe
lines; short soft felt fibers; fuzzy fiber edge along the outline; warm dark-brown variable-width outline.
Uniform orange chest and belly, NO cream or white chest or belly.
NOT realistic, NOT a 3D plush toy, NOT flat vector. Even soft light from the upper left.
```

**SHEET_LOCK**

```
Animation sheet: canvas exactly 1536x1024, a 3 columns x 2 rows layout of six equal 512x512 cells, read left
to right, top row first. Exactly one complete cat per cell, never crossing into another cell, at least 24 px
from every cell edge. No lines, borders, numbers or text between or inside cells. The cat is the SAME SIZE in
every cell: head width about 110 px in all six cells; poses change, head and body size never change.
Only the cat: no basket, rope, ground, shadow or props. Flat pure #FF00FF background, no checkerboard.
Smooth incremental motion between consecutive cells.
```

---

## 五、逐张要求

### 树窝进出（N1–N8，猫朝右，窝在猫的前上方）

几何：窝沿离地约为猫站高的 1.25 倍，只比起跳点靠前一点，所以这一跳**很陡，几乎垂直向上**。看 R9。

#### N1-prepare · 蓄力（参考 R4 的姿势，镜像）

```
[CAT_LOCK] [SHEET_LOCK]
The cat faces RIGHT and prepares to jump up to a ledge high above and slightly ahead of it.
Cell 1: standing, looking up and forward at the ledge, ears forward.
Cell 2: head raised, shoulders lowering.
Cell 3: crouching.
Cell 4: deeper crouch, hind feet bunched under the body.
Cell 5: deepest loaded crouch, rump raised slightly, rump wiggles to the left.
Cell 6: deepest loaded crouch, rump wiggles to the right, eyes locked on the ledge.
```

#### N2-jump · 起跳到抓住窝沿（参考 R5、R6，镜像；把 N1 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference N1: cell 1 is exactly the pose of N1 cell 6.
Cell 1: deepest loaded crouch (same as N1 cell 6).
Cell 2: hind legs extend and push off, front paws leave the ground, body angled steeply upward.
Cell 3: airborne, body stretched almost vertically, front paws reaching up.
Cell 4: near the top of the jump, front paws reaching forward over an edge above the head.
Cell 5: front paws hook over the edge, hind legs dangle below.
Cell 6: both front paws grip the edge, chest pressed against it, hind paws scrabbling.
The edge the paws grip is at the SAME height in cells 5 and 6.
```

#### N3-climb · 翻进窝（把 N2 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference N2: cell 1 is exactly the pose of N2 cell 6.
Cell 1: both front paws grip the edge, chest against it, hind legs dangling.
Cell 2: pulling the chest up over the edge, elbows bent on top of the edge.
Cell 3: one hind paw comes up onto the edge.
Cell 4: belly slides over the edge, body horizontal along the top of the edge.
Cell 5: both hind legs over, the cat crouches on top of the edge.
Cell 6: the cat steps down forward into the space beyond the edge, body lowering.
The edge stays at the SAME height in all six cells.
```

#### N4-settle · 在窝里转身趴下（参考 R7；把 N3 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference N3: cell 1 is exactly the pose of N3 cell 6.
Cell 1: side view facing right, body lowering.
Cell 2: turning three-quarters toward the viewer.
Cell 3: sitting, facing the viewer.
Cell 4: lowering down, facing the viewer.
Cell 5: lying down facing the viewer, head up, both front paws stretched forward side by side (like R7).
Cell 6: same lying pose, head lowered onto the front paws, eyes closed.
```

#### N5-look · 窝里看你（循环）

```
[CAT_LOCK] [SHEET_LOCK]
The cat lies facing the viewer, head up, both front paws stretched forward side by side (same pose as N4
cell 5). Only the eyes, ears and head angle change:
Cell 1: eyes open, looking at the viewer.
Cell 2: eyes half closed.
Cell 3: eyes closed (slow blink).
Cell 4: eyes open again.
Cell 5: head tilted slightly to one side.
Cell 6: head straight, one ear twitching.
Body, paws and position identical in all six cells.
```

#### N6-sleep · 窝里睡（循环）

```
[CAT_LOCK] [SHEET_LOCK]
The cat lies facing the viewer, head resting on the front paws, eyes closed (same pose as N4 cell 6).
Cell 1: asleep, breathing in.
Cell 2: asleep, chest slightly raised.
Cell 3: asleep, breathing out.
Cell 4: asleep, one ear twitches.
Cell 5: asleep, tail tip curls slightly.
Cell 6: asleep, back to the pose of cell 1.
Body position identical in all six cells; only tiny breathing and twitch changes.
```

#### N7-out · 出窝（把 N5 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Cell 1: exactly the pose of N5 cell 1 (lying, facing the viewer, head up).
Cell 2: standing up, turning to side view facing right.
Cell 3: side view facing right, both front paws on top of an edge in front, looking down.
Cell 4: leaning out over the edge, looking down at the ground far below.
Cell 5: hind legs push, body dives forward and downward.
Cell 6: airborne, descending, front legs reaching down toward the ground.
The edge stays at the SAME height in cells 3 to 5.
```

#### N8-land · 落地（把 N7 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference N7: cell 1 is exactly the pose of N7 cell 6.
Cell 1: airborne, descending, front legs reaching down.
Cell 2: front paws touch the ground, body still high.
Cell 3: front legs bend to absorb, hind legs coming down.
Cell 4: hind paws land, body crouched low.
Cell 5: rising out of the crouch.
Cell 6: standing side view facing right, relaxed, like the first frame of R2.
The ground is at the SAME height from cell 2 to cell 6.
```

### 走路三方向与原地转身（W1–W3）

和 R2 是**同一只猫、同一套画法、同样大小**。走路节奏和 R2 一样，六格为一个完整循环。

#### W1-walk-toward · 斜前方走来（朝向观众偏右）

```
[CAT_LOCK] [SHEET_LOCK]
A six-frame walk cycle, the same rhythm as R2, but the cat walks diagonally TOWARD the viewer and to the
right: three-quarter front view, face and chest turned toward the viewer, body angled about 45 degrees.
Both eyes visible. Same cat, same size and same drawing style as R2. Cell 6 loops back to cell 1.
```

#### W2-walk-away · 斜后方走远（背向观众偏右）

```
[CAT_LOCK] [SHEET_LOCK]
A six-frame walk cycle, the same rhythm as R2, but the cat walks diagonally AWAY from the viewer and to the
right: three-quarter back view, back and rump toward the viewer, head turned away, tail raised.
Same cat, same size and same drawing style as R2. Cell 6 loops back to cell 1.
```

#### W3-turn · 原地转身（从朝右转到朝左）

```
[CAT_LOCK] [SHEET_LOCK]
The cat stands still and turns around in place, front paws stepping around:
Cell 1: side view facing RIGHT, standing (like R3).
Cell 2: turning, three-quarter front view facing right.
Cell 3: facing the viewer.
Cell 4: three-quarter front view facing left.
Cell 5: side view facing LEFT, one front paw still stepping.
Cell 6: side view facing LEFT, standing still.
Same cat, same size and same drawing style as R2 in all cells.
```

### 绳子（K1）

#### K1-rope · 吊窝加长用的绳子

- 画布 **1024×1536（竖）**，背景纯色 `#FF00FF`。参考 R8。
- 自检：一根竖直的绳子，从画面顶边通到底边；上下两端可以无缝接续。

```
A single straight twisted rope hanging perfectly vertically, running from the very top edge to the very
bottom edge of the canvas, centered. Same rope material, twist, thickness and warm tan color as reference R8
(the rope loop at the top of a woven basket). The twist pattern repeats evenly so the top and bottom can be
tiled seamlessly. Rope width about 60 px. No knots, no loose ends, no basket, no shadow, no text.
Flat pure #FF00FF background, canvas exactly 1024x1536.
```

---

## 六、交付

```
frames-v5-delivery/
  delivery.json
  N1-prepare/N1-prepare__r1.png
  …（每个编号一个文件夹）
  K1-rope/K1-rope__r1.png
  _rejected/                 自己试过但没选的，可选
```

`delivery.json` 格式和上一轮完全相同：每个编号一条，没做成的也要有一条；`status` 只能是 `new`、`failed`、`skipped`；`prompt` 写实际发出的全文；参考图写实际传入的文件名，包括接力用的上一张。
