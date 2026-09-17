# 团子逐帧 v6 · 出图委托单 · 2026-09-12

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 9 张，每张单独生成。**
为什么这样出、图回来怎么验收和接入，见 `docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md`。这份只写出图要做的事。
格式、锁定词、交付方式都和上一轮 `assets/tuanzi/frames-v5/brief.md` 一样。

---

## 一、七条硬规矩（先读）

1. **一个编号 = 单独生成的一张图。** 每张固定是 3 列 × 2 行、6 格。
2. **文件名必须是 `编号__r轮次.png`**，例如 `H1-sit-look__r1.png`。编号一个字不能改。
3. **失败必须上报，禁止拿旧图顶替。** 没做成、放弃、想沿用旧图，都在 `delivery.json` 里写明。验收第一步是和历史所有素材比哈希。
4. **每一格的猫一样大。** 头宽和参考图 N4、N5 里的猫一样（约 170px）。坐、趴、低头只改姿势，不改头和身体的大小。这条会逐格量，偏差超过 4% 的格子整张重做。
5. **严格照参考图画这只猫。** R1 定身份和材质，R2 定画法和线条，N4 / N5 定坐姿和趴姿。不重新设计，不加奶白胸口和肚皮，不写实，不做 3D 毛绒玩具。
6. **只画猫。** 不画碗、水、地面、阴影、道具、网格线、格子边框、文字、编号。背景用纯色 `#FF00FF` 平涂。禁止棋盘格。
7. **枢纽帧。** H1、H2、H3、M1、M3 的第 1 格必须是**同一个坐姿**（N4 第 3 格：坐着、正对观众略偏右）；D1 的第 1 格必须是 R3 的侧面站姿。这样 App 切动作时猫不会跳。

---

## 二、参考图

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| R1 | `../frames-v5/refs/R1-cat-identity.png` | 猫的身份与毛毡材质，唯一角色基准 | `d4fc0cdfc852` |
| R2 | `../frames-v5/refs/R2-cat-walk-side.png` | 已确认的侧面走路六帧：画法、线条 | `15b8c2e8b8f3` |
| R3 | `../frames-v5/refs/R3-cat-side-standing.png` | 侧面站姿，D1 的第 1 格就是它 | `6baf5abef711` |
| N4 | `../../../outputs/frames-v5-delivery/N4-settle/N4-settle__r1.png` | **第 3 格是坐姿枢纽帧**；第 5、6 格是趴姿 | `1d482748cdfa` |
| N5 | `../../../outputs/frames-v5-delivery/N5-look/N5-look__r1.png` | 趴着慢眨眼、歪头、耳朵抖的节奏参考 | `34ca54edc0ab` |
| W2 | `../../../outputs/frames-v5-delivery/W2-walk-away/W2-walk-away__r1.png` | 背面视角的画法参考（M2 用） | `46d60f8e17ef` |

N4、N5、W2 是同一轮已经验收通过的图：**新图必须和它们是同一只猫、同一个大小、同一种画法。**

---

## 三、统一格式

- 画布 **1536×1024**，**3 列 × 2 行，每格 512×512**，阅读顺序从左到右、从上到下。
- 格子之间不画任何分隔线；猫和猫之间不相碰。
- 每格一只完整的猫，全身不裁切。
- 坐姿系列（H、M）猫正对观众略偏右，和 N4 第 3 格一致；喝水系列（D）猫朝右侧面，和 R3 一致。
- 每格头宽约 170px，和 N4 一样。

---

## 四、通用提示词前缀

每张开头都贴 `CAT_LOCK` 和 `SHEET_LOCK`。

**CAT_LOCK**

```
Reference image R1 is the approved cat "Tuanzi": an orange tabby in soft felt-over-crayon illustration.
R2 is the approved side-view walk of this exact cat: match its drawing style, outline and felt texture exactly.
N4 and N5 are approved animation sheets of this exact cat: match their size, proportions and drawing exactly.
Keep EXACTLY: big round slightly irregular head; small triangular ears with pink inner ear; small dark-brown
bead eyes with no highlight; tiny warm-brown mouth; three darker orange forehead stripes; broad soft body
stripes; ringed tail; thick round body with low center of gravity; short legs; small round paws with 2-3 toe
lines; short soft felt fibers; fuzzy fiber edge along the outline; warm dark-brown variable-width outline.
Uniform orange chest and belly, NO cream or white chest or belly. No whiskers, no blush, no eye highlights.
NOT realistic, NOT a 3D plush toy, NOT flat vector. Even soft light from the upper left.
```

**SHEET_LOCK**

```
Animation sheet: canvas exactly 1536x1024, a 3 columns x 2 rows layout of six equal 512x512 cells, read left
to right, top row first. Exactly one complete cat per cell, cats never touch each other. No lines, borders,
numbers or text between or inside cells. The cat is the SAME SIZE in every cell and the same size as in N4:
head width about 170 px in all six cells; poses change, head and body size never change.
Only the cat: no bowl, water, ground, shadow or props. Flat pure #FF00FF background, no checkerboard.
Smooth incremental motion between consecutive cells.
```

**SIT_HUB**（坐姿系列每张都贴）

```
Cell 1 is EXACTLY the sitting pose of N4 cell 3: sitting upright, facing the viewer turned slightly to the
right, both front paws side by side on the ground, tail curled around to the right side, ears up, eyes open,
neutral relaxed face. Later cells change only what is described; the body stays seated in the same place.
```

---

## 五、逐张要求

### 门口待机（H1–H3，坐姿）

#### H1-sit-look · 坐着慢眨眼看你，末尾轻轻歪头（参考 N5 的眨眼节奏）

```
[CAT_LOCK] [SHEET_LOCK] [SIT_HUB]
Cell 1: hub sitting pose, eyes open, looking at the viewer.
Cell 2: eyes half closed.
Cell 3: eyes closed (slow blink).
Cell 4: eyes open again, looking at the viewer.
Cell 5: head tilted slightly to the left, eyes open.
Cell 6: head back to straight, one ear twitching.
Body, paws and tail identical in all six cells.
```

#### H2-head-tilt · 歪头

> 2026-09-16：用户指出当前门口歪头像机械猫。此处“身体完全相同、左右 25° 来回”仅保留历史记录；新的单侧关注过程提案见 [v8](../frames-v8/brief.md)，尚未接入 App。

```
[CAT_LOCK] [SHEET_LOCK] [SIT_HUB]
Cell 1: hub sitting pose, head straight.
Cell 2: head tilting to the left about 15 degrees, eyes on the viewer.
Cell 3: head tilted left about 25 degrees, ears follow the tilt.
Cell 4: head back to straight.
Cell 5: head tilted to the right about 25 degrees.
Cell 6: head straight again, both ears flick once.
Body, paws and tail identical in all six cells.
```

#### H3-groom · 洗脸

```
[CAT_LOCK] [SHEET_LOCK] [SIT_HUB]
Cell 1: hub sitting pose.
Cell 2: right front paw lifts off the ground toward the mouth, eyes half closed.
Cell 3: licking the raised right paw, tongue tiny, eyes closed.
Cell 4: the wet paw wipes over the right ear and cheek, head tilted into the paw.
Cell 5: paw wipes down over the right eye, eyes closed.
Cell 6: paw lowering back toward the ground, eyes opening; almost back to cell 1.
Body and tail identical in all six cells; only the right front paw and the head move.
```

### 情绪（M1–M3）

情绪必须做进**身体**（耳朵、尾巴、坐姿），不能只做在脸上。App 里这只猫只有 40pt 高，脸上的表情看不见，验收时会把三张缩小比剪影：三种情绪的剪影必须一眼分得开。

#### M1-happy · 开心（克制：尾巴竖起、踩奶、慢眨眼；不睁圆眼、不张嘴）

```
[CAT_LOCK] [SHEET_LOCK] [SIT_HUB]
Content, quietly pleased cat. Never wide round eyes, never open mouth, never sparkles or hearts.
Cell 1: hub sitting pose, but the tail is raised straight UP behind the body with a soft curve at the tip.
Cell 2: left front paw presses down and spreads (kneading), tail up.
Cell 3: left paw lifts slightly, right paw presses and spreads, eyes half closed.
Cell 4: right paw lifts, left paw presses, eyes closed in a slow content blink.
Cell 5: both paws down, eyes open, tail tip curls a little more.
Cell 6: back to the pose of cell 1, tail still up.
The raised tail is visible in every cell and reads clearly in silhouette.
```

#### M2-sulk · 不高兴（背对观众，耳朵后压，尾巴拍地；参考 W2 的背面画法）

```
[CAT_LOCK] [SHEET_LOCK]
Reference W2 shows this cat from behind: use the same back-view drawing.
The cat sits with its BACK to the viewer, turned slightly so the right side of the face is just visible in
profile. Ears pressed back and flattened outward. Tail lies on the ground behind it, toward the viewer.
Cell 1: sitting with back to the viewer, ears flat, tail flat on the ground pointing to the lower right.
Cell 2: tail tip lifts.
Cell 3: tail swings to the left and slaps the ground.
Cell 4: tail lifts again.
Cell 5: tail swings back to the right and slaps the ground.
Cell 6: back to the pose of cell 1; the head turns a few degrees so one narrowed eye glances at the viewer.
Body and ears identical in all six cells; only the tail and the slight head turn change. Flattened ears must
read clearly in silhouette.
```

#### M3-sad · 委屈（缩着坐，头低，耳朵耷拉，尾巴裹脚；不能像在睡觉）

```
[CAT_LOCK] [SHEET_LOCK] [SIT_HUB]
Cell 1: hub sitting pose.
Cell 2: body hunches lower, head lowering, ears drooping outward and down.
Cell 3: fully hunched: shoulders up, head low near the chest, ears drooped sideways, tail wrapped forward
around the front paws, eyes open and looking down. This is the key pose.
Cell 4: same hunched pose, eyes lift slowly to glance at the viewer without raising the head.
Cell 5: same hunched pose, a slow sigh: chest rises slightly, eyes half closed.
Cell 6: same hunched pose, chest lowers, eyes back down. Cells 3 to 6 keep the same silhouette.
Eyes stay OPEN in cells 3, 4 and 6; the cat is sad, not asleep.
```

### 喝水（D1–D3，侧面朝右；碗在猫前方地上，不画碗）

碗沿离地约为猫站高的 0.35 倍（大约在猫的膝盖高度），在猫前爪前方约半个头宽处。**不要画碗和水**，只画猫；播放时 App 把猫的嘴钉在碗沿上。三张里嘴接触碗沿的高度必须一样。

#### D1-drink-down · 站着低头到碗沿（参考 R3 站姿）

```
[CAT_LOCK] [SHEET_LOCK]
The cat stands in side view facing RIGHT, exactly like R3. An invisible bowl sits on the ground just in
front of its front paws; the bowl rim is at about knee height. Do NOT draw the bowl or water.
Cell 1: standing side view facing right, identical to R3, looking ahead.
Cell 2: head turns down toward the ground in front, ears forward.
Cell 3: front legs bend slightly, neck lowering.
Cell 4: head lowering further, nose pointing down and forward.
Cell 5: nose almost at the invisible rim, front legs bent, shoulders lowered.
Cell 6: mouth at the invisible bowl rim (knee height, just ahead of the front paws), eyes half closed.
Hind legs and tail stay in place in all six cells.
```

#### D2-drink-lap · 舔水（循环；把 D1 作为参考图传入）

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference D1: cell 1 is exactly the pose of D1 cell 6, mouth at the invisible bowl rim at knee
height in front of the front paws. Do NOT draw the bowl or water.
Cell 1: mouth at the rim, tongue hidden.
Cell 2: tiny tongue out, lapping.
Cell 3: tongue in, head a hair lower.
Cell 4: tongue out again.
Cell 5: tongue in, ear twitches.
Cell 6: same as cell 1 so the loop repeats.
Body, legs, tail and the height of the mouth identical in all six cells; only the tongue, jaw and ear move.
```

#### D3-drink-up · 抬头、舔嘴、甩头、回到站姿（把 D1 作为参考图传入）

> 2026-09-16：用户要求自然喝水、不要怪异吐舌或突然趴下。新的收舌、抬头、站稳过程见 [v8](../frames-v8/brief.md)，默认不强制舔嘴／甩头；本段仅保留生成历史，当前 App 未改。

```
[CAT_LOCK] [SHEET_LOCK]
Continue from reference D1 played backwards: cell 1 is exactly the pose of D1 cell 6. Do NOT draw the bowl
or water. No droplets, no splashes.
Cell 1: mouth at the invisible rim at knee height.
Cell 2: head lifts halfway, tongue licking the lips.
Cell 3: head up, licking the lips, eyes half closed.
Cell 4: a quick small head shake, ears flick, head blurred slightly to the left.
Cell 5: head shake to the right, ears flick.
Cell 6: standing side view facing right, identical to R3.
Hind legs and tail stay in place in all six cells.
```

---

## 六、交付

```
frames-v6-delivery/
  delivery.json
  H1-sit-look/H1-sit-look__r1.png
  …（每个编号一个文件夹）
  D3-drink-up/D3-drink-up__r1.png
  _rejected/                 自己试过但没选的，可选
```

`delivery.json` 格式和上一轮完全相同（`outputs/frames-v5-delivery/delivery.json`）：每个编号一条，没做成的也要有一条；`status` 只能是 `new`、`failed`、`skipped`；`prompt` 写实际发出的全文；参考图写实际传入的文件名，包括接力用的上一张。
