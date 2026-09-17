# 团子逐帧 v7 · 出图委托单 · 2026-09-16

> **2026-09-16 后续修订：A/B 组暂停继续生成。** 用户要求喝水、门口坐姿／歪头和转身更自然，允许更多帧。本稿的固定六帧、喝水强制升降一个头高／甩头和全身逐格大动要求不再用于新出图。新的分段与帧数提案见 [v8 自然动作委托稿](../frames-v8/brief.md)，待评审；C 组不因此作废。下文保留当时的委托证据，不是新动作的执行规范。

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 10 张，每张单独生成。**
格式、锁定词、交付方式和上一轮 `assets/tuanzi/frames-v6/brief.md` 完全一样，只有第五节的判据是新的。

**这一轮要解决的是一件事：现有这三组动作「动得不够」。** 不是画得差，是帧与帧之间身体几乎没变。
下面第五节把它变成了可量的数，出图前请先读，因为验收会逐格量。

---

## 一、七条硬规矩（先读）

1. **一个编号 = 单独生成的一张图。** 每张固定是 3 列 × 2 行、6 格。
2. **文件名必须是 `编号__r轮次.png`**，例如 `A1-walk-toward__r1.png`。编号一个字不能改。
3. **失败必须上报，禁止拿旧图顶替。** 没做成、放弃、想沿用旧图，都在 `delivery.json` 里写明。验收第一步是和历史所有素材比哈希。
4. **每一格的猫一样大。** 头宽约 170px，和参考图 G1（H3-groom）一样。姿势变，头和身体的大小不变。逐格量，偏差超过 4% 的格子整张重做。
5. **严格照参考图画这只猫。** R1 定身份和材质，R2 定画法和线条，G1 定大小和已验收的画法。不重新设计，不加奶白胸口和肚皮，不写实，不做 3D 毛绒玩具。
6. **只画猫。** 不画碗、水、窝、绳子、地面、阴影、道具、网格线、格子边框、文字、编号。背景纯色 `#FF00FF` 平涂，禁止棋盘格。
7. **母版先行：先出 A1，等验收过了再出其余九张。** A1 不过就停下来，不要继续。

---

## 二、参考图

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| R1 | `../frames-v5/refs/R1-cat-identity.png` | 猫的身份与毛毡材质，唯一角色基准 | `d4fc0cdfc852` |
| R2 | `../frames-v5/refs/R2-cat-walk-side.png` | 已确认的侧面走路六帧：画法、线条 | `15b8c2e8b8f3` |
| R3 | `../frames-v5/refs/R3-cat-side-standing.png` | 侧面站姿，B1 第 1 格就是它 | `6baf5abef711` |
| R7 | `../frames-v5/refs/R7-pose-inside.png` | 姿势参考：趴在窝里只露头和前爪。**只看姿势，不要画窝** | `2c4e0f7344ba` |
| R9 | `../frames-v5/refs/R9-nest-geometry.png` | 窝的几何：窝沿离地约为猫站高的 1.25 倍 | `c81cbd2be832` |
| G1 | `../../../outputs/frames-v6-delivery/H3-groom/H3-groom__r1.png` | **大小与画法基准**，也是"身体真的在动"的幅度基准 | `6efd625c2b5b` |
| G2 | `../../../outputs/frames-v6-delivery/H1-sit-look/H1-sit-look__r1.png` | 坐姿枢纽帧 | `89d3323cd129` |
| X1 | `../../../outputs/frames-v5-delivery/W1-walk-toward/W1-walk-toward__r1.png` | **反面教材**：这是要被替换的正面走。只用来看朝向和构图，**姿势不要照抄**，它的腿是平摊的 | `3d2fb8e35840` |
| X2 | `../../../outputs/frames-v5-delivery/W3-turn/W3-turn__r1.png` | **反面教材**：要被替换的转身，同上 | `27221579b54d` |
| X3 | `../../../outputs/frames-v5-delivery/N2-jump/N2-jump__r1.png` | 大幅度动作的幅度基准：一格到一格身体走多远 | `e297d616b37c` |

X1、X2 是**要被换掉的旧图**。传给你是为了对齐朝向、镜头和构图，**它们的姿势正是这一轮要改掉的毛病**。

---

## 三、统一格式

- 画布 **1536×1024**，**3 列 × 2 行，每格 512×512**，阅读顺序从左到右、从上到下。
- 格子之间不画分隔线；猫和猫不相碰；每格一只完整的猫，全身不裁切。
- 每格头宽约 170px。
- 朝向：A2 从侧面转到正面，其余各张的朝向写在各自条目里。

---

## 四、通用提示词前缀

**CAT_LOCK**（每张都贴）

```
Reference image R1 is the approved cat "Tuanzi": an orange tabby in soft felt-over-crayon illustration.
R2 is the approved side-view walk of this exact cat: match its drawing style, outline and felt texture exactly.
G1 is an approved animation sheet of this exact cat: match its size, proportions and drawing exactly.
Keep EXACTLY: big round slightly irregular head; small triangular ears with pink inner ear; small dark-brown
bead eyes with no highlight; tiny warm-brown mouth; three darker orange forehead stripes; broad soft body
stripes; ringed tail; thick round body with low center of gravity; short legs; small round paws with 2-3 toe
lines; short soft felt fibers; fuzzy fiber edge along the outline; warm dark-brown variable-width outline.
Uniform orange chest and belly, NO cream or white chest or belly. No whiskers, no blush, no eye highlights.
NOT realistic, NOT a 3D plush toy, NOT flat vector. Even soft light from the upper left.
```

**SHEET_LOCK**（每张都贴）

```
Animation sheet: canvas exactly 1536x1024, a 3 columns x 2 rows layout of six equal 512x512 cells, read left
to right, top row first. Exactly one complete cat per cell, cats never touch each other. No lines, borders,
numbers or text between or inside cells. The cat is the SAME SIZE in every cell and the same size as in G1:
head width about 170 px in all six cells; poses change, head and body size never change.
Only the cat: no bowl, water, nest, rope, ground, shadow or props. Flat pure #FF00FF background, no checkerboard.
```

**MOVE_LOCK**（每张都贴 —— 这一轮的重点）

```
This sheet will be played as animation. The previous version of this action FAILED review because the body
barely changed between cells: only the face moved while the torso, legs and posture stayed frozen.
Every cell must show a genuinely different BODY pose, not the same body with a different face.
Move the whole animal: shoulders, spine, hips, the bend of each leg, the height of the head above the ground.
Do NOT draw motion symbols of any kind: no Z's, no speed lines, no motion blur, no smear, no ghosting,
no sweat drops, no sparkles, no ">_<" style eyes. Motion is shown by the pose itself, never by symbols.
```

> 给出图模型的说明：`MOVE_LOCK` 里禁止"motion blur / smear"是认真的。上一轮委托单写了一句 "head blurred slightly"，
> 结果交回来是粉色拖影配 "＞＜" 眼，两格直接作废。要表达甩头就描述头的朝向序列，不要用渲染词。

---

## 五、判据（出图前先读，验收会逐格量）

每条都写了"为什么是这个数"。括号里是**现有旧素材实测值**——旧素材不合格正是这一轮要出图的原因；
同一张表里的 G1（洗脸）和 X3（起跳）是**已验收通过的好素材**，它们能过线，证明判据不是拍脑袋。

| 量什么 | 过线 | 为什么是这个数 |
|---|---|---|
| 每格头宽 | 与本张第 1 格偏差 ≤ 4% | v6 用过并跑通 |
| 相邻格轮廓 IoU | ≥ 0.70 | 低于 0.70 是跳帧不是动画；已验收的走路最低 0.719 |
| **头顶升降幅度**（本张里头顶最高的一格与最低的一格之差，按头宽归一） | B1 ≥ 0.32 头宽；B3 ≥ 0.32；A1 0.05–0.12；C1 ≥ 0.30；C3 ≥ 0.18；C4 0.04–0.09 | **这一轮的核心判据。** 旧喝水三段实测只有 2px ≈ 0.012 头宽——猫根本没低头，只是把脸转下去了。碗沿在膝高，猫站高约 1.6 头宽，低头到膝高至少要降三分之一身高。已验收的 G1（抬爪到脸）有 0.13 头宽，X3（起跳）有 0.32 |
| **段内跨度**（本张六格里差别最大的两格之间的 IoU） | A1 ≤ 0.75；A2 ≤ 0.60；B1 ≤ 0.55；B3 ≤ 0.55；C1 ≤ 0.30；C2 ≤ 0.40；C3 ≤ 0.80；C4 ≤ 0.85；C5 ≤ 0.40 | 旧值分别是 0.807 / 0.578 / 0.708 / 0.726 / — / — / 0.891 / 0.902。基准：G1 洗脸 0.771、X3 起跳 0.198。C3、C4 放宽是因为窝里本来就动得少，但 0.891/0.902 意味着几乎完全静止 |
| A1、A2 专项：**两条前腿的前后关系** | 至少 4 格里，一条前腿与胸腹轮廓有重叠（在身体前方），另一条被身体挡住一部分 | 旧图的毛病就是四条腿从身体两侧平摊出去像蛙，没有前后景深。这条直接量"有没有重叠" |
| 背景 | 纯 `#FF00FF`；非洋红像素占比 ≤ 0.5%；无棋盘格 | 历轮规矩，去底脚本按这个吃 |
| 动作符号 | 一个都不许有 | v5 睡觉那张、v6 的 H1 都被自作主张加过，都得定点去除 |

判据跑不通就当场作废并写明原因，不许事后偷偷放宽。

---

## 六、逐张要求

### A 组 · 正面走与转身（替换 walkToward、turn）

镜头是正面偏一点的四分之三视角，猫朝着观众走过来。**旧图的病：四条腿从身体两侧平摊，身子摊成一张饼。**

#### A1-walk-toward · 朝镜头走一步（循环）· **母版，先出这一张**

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
X1 shows the OLD version of this action which was rejected: in it the legs splay out sideways from the body
like a frog and the torso reads as a flat disc. Use X1 only for the camera angle and framing. Do NOT copy its poses.
The cat walks TOWARD the viewer in a three-quarter front view, slightly turned to its left, one full walk cycle
looping seamlessly from cell 6 back to cell 1.
Draw the legs in DEPTH, not spread sideways: in each cell one front leg swings forward and overlaps the chest
as it reaches toward the viewer, while the other front leg is further back and partly hidden behind the body.
The same applies to the hind legs. The chest is a rounded volume that the near foreleg passes in front of.
Cell 1: right front leg planted and reaching toward the viewer, left front leg back under the chest, weight forward.
Cell 2: body rises to its highest, right front leg pushing off, left front leg lifting and swinging through.
Cell 3: left front leg reaching forward past the chest, right front leg now behind, weight shifting onto the left.
Cell 4: left front leg planted and weight settling, body at its lowest, shoulders dipping.
Cell 5: right front leg swinging through, body rising again.
Cell 6: right front leg reaching forward, almost back to cell 1 so the walk loops.
The shoulders roll side to side across the six cells and the head bobs slightly up and down with the stride.
The tail stands straight up behind the body with a soft curve at the tip, swaying a little to the opposite side
of whichever front leg is forward.
```

#### A2-turn · 侧面转到正面再转回去

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
X2 shows the OLD version of this action which was rejected for the same reason as X1: splayed frog legs.
Use X2 only for the camera angle. Do NOT copy its poses.
The cat turns on the spot, from a side view facing right, around to face the viewer, and back.
The turn is done with the FEET: the front paws step around one at a time and the spine bends into the turn,
the hips following the shoulders one beat later. The body is never a flat disc rotating in place.
Cell 1: side view facing right, standing, exactly the proportions of R3.
Cell 2: head and shoulders turn toward the viewer, the near front paw steps across in front of the far one,
        the spine curving; the hips still point right.
Cell 3: chest now faces the viewer three-quarter on, the far front leg partly hidden behind the chest,
        hips beginning to swing around, tail swinging out wide to the left to counterbalance.
Cell 4: facing the viewer straight on, front paws side by side but at clearly different depths (one nearer,
        overlapping the chest), hind legs still angled, head level, looking at the viewer.
Cell 5: shoulders continue around to the left, the near front paw steps across again, the spine curving the
        other way, hips following.
Cell 6: side view facing LEFT, standing, the mirror of cell 1.
The head stays level throughout; the turn happens in the shoulders, spine, hips and stepping paws.
```

### B 组 · 喝水（替换 drinkDown、drinkLap、drinkUp）

猫侧面朝右，碗在前爪前方的地上，碗沿约在猫的膝盖高度。**不要画碗和水。**
**旧图的病：整整 16 格里猫的头顶只降了 2 像素——它从头到尾都站着，只是把脸转了下去。**

#### B1-drink-down · 从站姿一路压低到嘴碰碗沿

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
The cat stands in side view facing RIGHT, exactly like R3. An invisible bowl sits on the ground just in front
of its front paws; the bowl rim is at about knee height. Do NOT draw the bowl or water.
The previous version of this action failed review: across all six cells the top of the head dropped by almost
nothing, so the cat never actually lowered itself. This time the WHOLE BODY goes down to reach the ground.
By cell 6 the top of the head must be a FULL HEAD-HEIGHT LOWER than in cell 1, and the shoulder blades must
be visibly higher than the neck.
Cell 1: standing side view facing right, identical to R3, head level, looking ahead.
Cell 2: head turns down toward the ground ahead, ears forward, weight shifting onto the front legs.
Cell 3: front legs bend at the elbow, chest dropping, the neck stretching forward and down.
Cell 4: front legs bent further, chest low, shoulder blades rising above the line of the back, hindquarters
        still high, the back forming a downward slope from hips to shoulders.
Cell 5: nose almost at the invisible rim, front legs deeply bent, elbows out, chest nearly at knee height.
Cell 6: mouth touching the invisible bowl rim at knee height just ahead of the front paws, eyes half closed,
        shoulder blades clearly peaked above the neck, hindquarters still raised.
```

#### B2-drink-lap · 舔水（循环；把 B1 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
Continue from reference B1: cell 1 is exactly the pose of B1 cell 6 — body lowered, front legs bent, shoulder
blades peaked, mouth at the invisible bowl rim at knee height. Do NOT draw the bowl or water.
The body stays lowered in all six cells. The lapping motion is in the neck and jaw, not just the tongue:
the head dips a little into the bowl and lifts a little between laps, and the throat works.
Cell 1: mouth at the rim, tongue hidden, head at its lowest.
Cell 2: tiny tongue curling down out of the mouth, head lifting a few degrees.
Cell 3: tongue drawn back in, head dipping back to the rim, throat swallowing.
Cell 4: tongue out again, head lifted a few degrees, one ear tipping back.
Cell 5: tongue in, head at the rim, ear returning.
Cell 6: same as cell 1 so the loop repeats.
The lowered body, bent front legs and raised hindquarters are identical in all six cells.
```

#### B3-drink-up · 抬头、舔嘴、甩头、回到站姿（把 B1 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
Continue from reference B1: cell 1 is exactly the pose of B1 cell 6. Do NOT draw the bowl or water.
No droplets, no splashes, no motion blur, no smear.
This is B1 in reverse plus a head shake: the whole body must rise back up. By cell 6 the top of the head is a
FULL HEAD-HEIGHT HIGHER than in cell 1.
Cell 1: body lowered, mouth at the invisible rim at knee height.
Cell 2: front legs straightening, chest rising, head lifting halfway, tongue licking the upper lip.
Cell 3: body almost upright, head up, tongue still out licking the corner of the mouth, eyes half closed.
Cell 4: standing, head turned sharply to the LEFT with the ears swung out to the left — a single sharp pose,
        drawn crisply, no blur and no repeated ghost of the head.
Cell 5: standing, head turned sharply to the RIGHT, ears swung out to the right, also crisp.
Cell 6: standing side view facing right, identical to R3, head level.
```

### C 组 · 树窝（替换 v5Grip、v5Enter、v5Look、v5Sleep、v5Out）

猫朝右，窝在猫的前上方，窝沿离地约为猫站高的 1.25 倍（看 R9）。**不要画窝和绳子。**
**旧图的病：窝里的猫是一张扁饼贴在那儿，看不出它陷进窝里被绳边托住；睡的六格头顶只动了 2 像素。**

窝里的姿势允许你发挥，只要满足：猫是**陷在一个碗形的空间里**——身体下半被窝沿挡住、只露出上半身和搭在窝沿上的前爪；
不要画成趴在平地上。

#### C1-grip · 扑上来、前爪抓住窝沿、后腿蹬空（把 X3 当幅度基准）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
X3 is an approved sheet of this cat leaping: match how far the body travels from cell to cell.
The cat arrives at an invisible nest rim above and in front of it, catches the rim with its front paws, and
hauls itself up. Do NOT draw the nest, the rim or the rope: draw only the cat and the shape its body makes
against an invisible curved rim.
Cell 1: the cat in the air, body stretched out and rising, front paws reaching up and forward, hind legs trailing.
Cell 2: both front paws hooked over the invisible rim at chest height above it, elbows bent, body hanging below,
        hind legs dangling and beginning to scrabble.
Cell 3: hanging, the near hind leg kicking up and out for purchase, the body swinging slightly.
Cell 4: pulling up: elbows bending hard, shoulders rising above the paws, chest coming over the rim line,
        the belly pressed against the invisible rim.
Cell 5: chest and one front leg over the rim, the body folding at the waist over the rim line, hind legs still below.
Cell 6: most of the body over the rim, hindquarters swinging up, head low and forward into the bowl of the nest.
```

#### C2-enter · 翻进去、在里面转个身（把 C1 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
Continue from reference C1: cell 1 is exactly the pose of C1 cell 6. Do NOT draw the nest or the rope.
The cat is settling into an invisible bowl-shaped nest: from cell 3 onward the lower half of its body is
HIDDEN below the rim line — draw the cat as if the bottom of its body is cut off by a shallow curve, with only
the chest, shoulders, head and the front paws resting on that curve visible.
Cell 1: body folded over the rim, hindquarters up, head low.
Cell 2: tumbling forward into the bowl, back curved, hind legs coming over.
Cell 3: inside, crouched low, body below the rim line, head turned away to the right.
Cell 4: turning on the spot inside the bowl, shoulders rotating toward the viewer, head coming around.
Cell 5: nearly settled, chest facing the viewer, front paws being placed forward onto the rim.
Cell 6: settled: lying facing the viewer, chest and head above the rim line, both front paws resting side by
        side on the curve in front, hindquarters completely hidden below.
```

#### C3-look · 窝里探头出来看你（循环）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
R7 shows the pose to aim for: lying with only the head, chest and front paws visible above a curved edge.
Do NOT draw the nest or the rope — only the cat, with the lower half of the body cut off by that shallow curve.
The previous version failed review because the cat barely moved: it sat flat and still for all six cells.
This time the cat LEANS OUT over the edge and comes back — the head and chest must travel a clear distance.
Cell 1: lying inside, chest and head just above the edge, front paws side by side on the curve, looking ahead.
Cell 2: head lifts and the neck stretches up, ears pricking forward, eyes on the viewer.
Cell 3: the cat leans OUT over the edge: shoulders rise, the chest comes forward past the front paws, the neck
        extended down and forward, looking down at something below. This is the farthest pose.
Cell 4: still leaning out, head tilted to one side, one front paw lifted slightly off the edge.
Cell 5: settling back, chest returning behind the paws, head still up.
Cell 6: back to the pose of cell 1 so the loop repeats, eyes half closing.
Across the six cells the top of the head must rise and fall by clearly more than the height of one ear.
```

#### C4-sleep · 窝里睡（循环，只有呼吸）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
Same framing as C3: only the head, chest and front paws above the invisible curved edge, lower body hidden.
Do NOT draw the nest or the rope. The cat is asleep, head resting on its front paws, eyes closed.
This is a quiet breathing loop, but the previous version was completely frozen — the back must actually rise
and fall. The movement is small but it must be unmistakable: between the fullest and emptiest cell the top of
the shoulders moves by about a third of an ear height, and the back changes from a rounded arch to a flatter curve.
Cell 1: asleep, chest emptied, the back at its flattest, nose pressed into the paws.
Cell 2: breathing in, the back rounding up, shoulders rising.
Cell 3: fullest breath, the back at its highest arch, the head lifted very slightly with it, one ear tipping.
Cell 4: holding, the back still high, whiskerless cheek squashed against the paw.
Cell 5: breathing out, the back sinking, shoulders lowering.
Cell 6: back to the pose of cell 1 so the loop repeats.
Eyes stay closed in all six cells. No Z's, no sleep symbols of any kind.
```

#### C5-out · 从窝里出来（把 C3 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK] [MOVE_LOCK]
Continue from reference C3: cell 1 is exactly the pose of C3 cell 1. Do NOT draw the nest or the rope.
The cat climbs up out of the invisible bowl and gathers itself to drop down.
Cell 1: lying inside, chest and head above the edge, front paws on the curve.
Cell 2: front paws push down on the edge, shoulders rising, the chest lifting clear of it.
Cell 3: standing up on the edge, the hind legs coming up out of the bowl, the body now fully visible and
        crouched on a narrow curved surface, back arched.
Cell 4: crouched on the edge, looking down, weight on all four paws gathered close together.
Cell 5: haunches lowering and gathering, front legs bracing, head down and forward, about to drop.
Cell 6: the front half leaning out past the edge, hind legs still gathered, the body tipping into the fall.
```

---

## 七、交付

```
frames-v7-delivery/
  delivery.json
  A1-walk-toward/A1-walk-toward__r1.png
  …（每个编号一个文件夹）
  C5-out/C5-out__r1.png
  _rejected/                 自己试过但没选的，可选
```

`delivery.json` 格式和上一轮完全相同（`outputs/frames-v6-delivery/delivery.json`）：每个编号一条，没做成的也要有一条；
`status` 只能是 `new`、`failed`、`skipped`；`prompt` 写实际发出的全文；参考图写实际传入的文件名，包括接力用的上一张。

**先交 A1 一张等验收，过了再出其余九张。**
