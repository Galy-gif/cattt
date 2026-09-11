# 团子出图提示词 · 2026-09-04

用途：喂给出图模型，出**方向**不出资产。拿到满意方向后仍需重画成可用分层素材。

依据：《团子作画规范》三层画法与量化标准。本轮针对的反馈是「线条太潦草」「猫像用圆规画的」「想要更可爱」。

三条修正写进了所有提示词：

1. **禁止几何完美** —— 不许出现正圆、正椭圆、镜像对称。这是「圆规感」的唯一来源。
2. **补内部细节** —— 细毛束、胸口绒毛、颊边碎毛、线宽变化。上一版内部是全空的，所以显得潦草。
3. **可爱靠不对称** —— 歪头、两耳角度不同、两眼不完全一样、前爪内八。

---

## 0. 通用风格块（每个提示词前面都要加）

```
STYLE — applies to the whole image.

Hand-drawn 2D children's-book illustration for a mobile app. Warm, quiet,
unhurried. Finished artwork, not a sketch and not a diagram.

LINE
- Every contour is drawn by hand. Line weight VARIES within a single stroke:
  heavier along the underside and where two forms overlap, tapering to almost
  nothing along top edges. Slight ink pooling where a stroke changes direction
  or ends.
- Line colour is dark warm brown #6B5B4A. NEVER pure black.
- Strokes may overshoot slightly at corners; contours need not close perfectly.

FORM — the single most important rule
- NO perfect circles. NO perfect ellipses. NO mathematically symmetrical or
  mirrored shapes anywhere in the image.
- The head is not a circle. It is an irregular rounded mass, a little wider on
  one side, with a soft flattening where the cheek sits.
- The two eyes are NOT identical to each other — one sits slightly differently.
- If any shape looks like it was made with a compass or a vector shape tool,
  it is wrong. Redraw it by hand.

SURFACE
- Crayon and dry-brush grain inside the colour areas: dense at the centre of a
  shape, loosening and going patchy toward its edges. Warm cream paper tooth
  faintly visible through the colour.
- Flat colour underneath. No smooth gradients, no airbrush, no glow, no drop
  shadows, no bevels, no cel-shading rim light.

PALETTE — do not introduce colours outside this set
- sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2, wood brown #B39C86
- line brown #6B5B4A
- accent coral #D8705C, on LESS THAN 3% of the image area
- the cat: honey orange #E3A05C, darker tone #C9823F, vanilla cream chest

NEVER
- yellowed or aged paper, stains, blotches, speckle noise, dirt texture
- thick glass, gradients, heavy shadows, 3D rendering, plastic or clay look
- any text, numbers, counters, progress bars, badges, UI chrome
- generic anime cat face, uniform W-shaped or ω-shaped animation mouth
```

---

## 1. 界面层 · 大团子角色设定页（优先做这个）

```
[通用风格块]

SUBJECT
Character sheet of Tuanzi, an orange tabby cat, for a companion app.
Three views in a row: front, right side profile, back. Warm cream background.

PROPORTION — follow these numbers exactly
- Head-to-body ratio 1 : 1.3. The head is nearly as large as the whole body.
- Eyes are 30% of the face width each.
- Eye centres sit 10% BELOW the horizontal midline of the face — low on the
  face, not at the middle.
- The gap between the two eyes equals roughly one eye width. Wide-set.
- Front paws are two separate rounded shapes, clearly detached from the body
  silhouette, and they turn slightly inward toward each other.

CUTENESS COMES FROM ASYMMETRY — do all of these
- The head is tilted about 6 degrees. Not upright.
- The two ears sit at slightly different angles. Not mirrored.
- The cheeks push out past the widest point of the skull, so the silhouette
  bulges at the cheek line.
- The body is slightly squashed and leans a little; it is not a symmetrical
  upright shape.

FUR — the previous version failed because the character was empty inside
- Soft fur tufts break the outline at the cheeks, the chest and the haunches.
  Short, tapering strokes that leave the silhouette rather than a clean edge.
- A vanilla-cream chest ruff, drawn with a few loose tufted strokes, running
  smoothly from under the chin down to the belly. It must be continuous — NOT
  an oval patch, NOT a bib, NOT a separate blob of colour.
- A few interior fur strokes on the flank and haunch, thinner than the outline.
- Mouth line is noticeably THICKER than the fur strokes.

FACE
- Pale yellow almond eye sockets. Inside each, a dark pupil that is NOT a
  circle — bean-shaped, tilted, slightly different in each eye.
- Exactly one short outward flick above the outer top edge of each open pupil.
  One stroke per eye, one point. Never two strokes, never a fork, never a fan.
- Pink inner ears, soft irregular dry-brush cheek blush, cream belly.
- Small mouth placed low, corners turned gently DOWN — mildly serious by
  nature, not sad and not angry.
- Long straight dark brown whiskers. Three short forehead stripes, back
  stripes, ring markings on a long S-curved tail.

NO eye catchlights.
```

### 1b. 眼神光 A／B 对照（同时出两版比较）

把上面最后一行替换成：

```
Give each pupil ONE small soft highlight dot, upper-left, matte and flat —
like a dot of paint, not a glossy specular reflection.
```

---

## 2. 界面层 · 表情页

```
[通用风格块]

Six full-body expressions of the same orange tabby cat Tuanzi, two rows of
three, warm cream background. Same proportions as the character sheet:
head-to-body 1:1.3, eyes 30% of face width, set low and wide.

Expressions: default (mildly serious, corners of mouth gently down) / content /
sleepy / curious / startled / affectionate.

Each expression is built from the eye socket shape squashing, stretching,
tilting or being covered by the lid, plus ear angle, whisker direction and
mouth shape TOGETHER. Do not reuse one identical mouth across the six.

Eyelash rule: the single outward flick appears ONLY on fully open eyes. Closed,
blinking, squinting and half-lidded eyes get no lash stroke at all.

Every pose keeps the fur tufts at cheek, chest and haunch. No two poses use the
same head tilt.
```

---

## 3. 世界层 · 小团子姿态页

```
[通用风格块]

Nine poses of the same small orange tabby cat, arranged in a grid on a plain
sage green #C6D9C4 ground.

IMPORTANT — this layer is drawn differently from the character sheet.
- Each cat is small and simple. Simplify the face to two dark eye dots. No
  whiskers, no eye sockets, no forehead stripes, no mouth.
- Identity must read from silhouette alone: ear angle, the long S-curved tail,
  the honey orange colour, ring markings on the tail.
- Keep the hand-drawn irregular contours and varying line weight. Still no
  perfect circles.

EVERY pose must be attached to an object. A cat standing alone on empty ground
is wrong. Use: curled asleep inside a woven basket / loafing on a mushroom
roof / half emerging from a hanging nest / sitting at a pond edge with the tail
hanging down / kneading a cushion / half buried under fallen leaves / stretching
against a tree trunk / drinking from a bowl / peeking out from behind a stone.

Sleeping and lying poses should dominate — real cats sleep most of the day.
```

---

## 4. 世界层 · 陪伴主页场景

```
[通用风格块]

Mobile portrait illustration, 853 x 1844. A small cosy mushroom house beside a
pond, with a large tree carrying a woven hanging nest.

DENSITY — this is what the previous attempt got wrong
- Draw a DENSE cluster of at least 25 small hand-drawn props packed around the
  mushroom house: clay pots, leafy plants, wooden stools, bowls, a lantern, a
  bundle of firewood, small mushrooms, a bucket, a ball of yarn, a stack of
  books, a woven basket, stones, grass tufts, small flowers.
- The cluster occupies about 55% of the frame.
- The remaining ground is COMPLETELY CLEAN flat colour with only a faint
  hand-stippled texture. Do not scatter props evenly across the whole frame —
  concentrate them, and leave the rest empty.
- Depth by value only: distant hills lightest and least saturated, the prop
  cluster darkest and most saturated. Do not separate depth by hue.

THE CAT
A small orange tabby, only about 7% of the frame height, curled asleep inside
the basket. Simplified world-layer drawing: two dark eye dots, no whiskers.
It must be attached to an object, never standing alone in the open.

Two or three faint paw prints trail away from the basket across the clean
ground.

Leave the top 8% and bottom 12% of the frame relatively quiet for interface
elements. Do not draw any interface, text or buttons.
```

---

## 5. 世界层 · 夜间变体（在第 4 张确定后再出）

```
[通用风格块]

The exact same scene as the daytime illustration, at night.

- DO NOT change the hues. Take the existing palette and darken and desaturate
  it uniformly. The sage green must remain recognisably the same green.
- Add exactly THREE small warm light sources: the mushroom house window, one
  hanging lantern, and a few fireflies. These are the only saturated warm
  colours in the entire frame.
- Soft, small falloff around each light — hand-drawn, not an airbrushed glow.
- Everything outside the reach of those lights stays inside the darkened green
  family.
- The composition's focal point should now be the lit area, not the daytime
  detail cluster.
```

---

## 怎么迭代（省次数）

历史上这条线走了二十几个 revision，主要浪费在一次改多个变量。建议：

1. **先只做第 1 张**，一次出 4 版。猫不对，后面全部白做。
2. 选中一版后，**每轮只改一个变量**。要圆一点就只说圆一点，不要同时提眼睛和尾巴。
3. 眼神光的 A／B 同时出，直接看，不要靠想象决定。
4. 猫定死之后再进第 4 张场景。场景的画风由猫决定，反过来不成立。
5. 第 5 张夜景必须等第 4 张定稿——它的前提是「同一套资产」。

## 边界

- 出图模型给的是方向，不是可用资产。分层、可动、可缩放仍需重画。
- 界面层大团子保留已确认的蜡笔干刷质感（这一层本来就该有质感）；世界层和图标层走平涂，理由是缩放和动画。两层画法不同是有意的，不是不统一。

---

## 2b. 表情页 · 第二轮（情绪做进身体）· 2026-09-05

上一轮六张姿势完全相同，情绪只做在脸上，且比例向瘦长漂移。本轮必须以 canonical 正面图作**图参考**，不要纯文字生成。

```
[通用风格块] + canonical 正面图作为 reference image

Six expressions of Tuanzi. Keep the locked build exactly: chunky, round,
heavy-bodied, head-to-body 1:1.5, broadest at the haunches. Do NOT slim the
body or shrink the head.

THE RULE THAT MATTERS MOST
Emotion must be carried by the WHOLE BODY, not the face. For each of the six,
change: the curve of the spine, where the weight sits, the front paw
positions, the tail, the head tilt, the ear angle. The face is the last layer,
not the first.

NEVER draw the cat dead-front and symmetrical with both front paws planted
side by side. That is a passport photo. Use three-quarter angles and shift the
weight off centre.

BODY LANGUAGE PER EXPRESSION
1. Aloof (default) — sitting three-quarter, weight on one hip, tail curled
   around the body, head turned slightly away, eyes half-lidded.
2. Content — settled low into a loaf, shoulders dropped, eyes closed in soft
   arcs, tail tip flicked over.
3. Sleepy — head drooping forward and down, spine slumped, one ear lower than
   the other, on the verge of tipping over.
4. Curious — leaning forward, ONE front paw lifted off the ground, head
   tilted, ears pushed forward, tail raised.
5. Startled — body pulled back and up, coat puffed, tail thick and straight,
   front paws braced, leaning away from whatever it saw.
6. Affectionate — body pressed low and forward, cheek pushing against
   something just out of frame, one front paw reaching.

SILHOUETTE TEST — if all six were filled in as flat black shapes, each one
must still be tellable apart. If two silhouettes match, redraw.

MOUTHS  Every mouth is different. No open round anime "O" mouth, no uniform
W or ω shape. Keep them small and low.

EYES  The single outward lash flick appears only on fully open eyes. Curious
and startled are the two with fully open eyes — show the complete yellow
almond socket there.
```

验收：把六张填成纯黑剪影，六个剪影必须两两可区分；头身比与 canonical 并排比对不得变瘦长。

---

## 2c. 表情页补图 · 单张跑 · 2026-09-07

背景：v2、v3 两轮里 03 与 06 均未实际重画（md5 与旧文件逐字节相同），Codex 静默交付了旧文件，并重掷了已通过的 04、05。因此改为**一次只跑一张**，并要求失败必须报告。

已定版：01、02 用 v1；04 用 v3；**05 用 v2**（v3 重掷后变差）。见 `outputs/cat-ip-concepts/2026-09-05/expressions-approved/`。

### 第一步：只跑 03

```
只做一件事：重新生成 03-sleepy。

约束：
- 以 outputs/cat-ip-concepts/canonical/团子-canonical-v1.png 作为 reference image。
- 单张全幅出图，不要六宫格。
- 只输出 03-sleepy-v4.png 这一个文件。不要碰、不要复制、不要重新生成任何其他文件。
- 如果生成失败，或你决定沿用旧图，必须明确告诉我。不要静默交付旧文件。

[通用风格块]

03 SLEEPY — the cat is LOSING the fight against sleep, not defeated by it.
Still sitting upright, but the head has nodded forward and down and is about
to drop further. Eyes HALF OPEN, not closed — the lids heavy and uneven, one
lower than the other. Body still holding itself up, tilting slightly off
balance, as if it will topple in a moment.
NOT slumped, NOT hunched over, NOT dejected, NOT sad.
Keep the canonical build: big head, head-to-body 1:1.4, chunky and round,
broadest at the haunches.
```

### 第二步：03 确认后，只跑 06

```
只做一件事：重新生成 06-affectionate。

约束：
- 以 outputs/cat-ip-concepts/canonical/团子-canonical-v1.png 作为 reference image。
- 单张全幅出图，不要六宫格。
- 只输出 06-affectionate-v4.png 这一个文件。不要碰、不要复制、不要重新生成任何其他文件。
- 如果生成失败，或你决定沿用旧图，必须明确告诉我。不要静默交付旧文件。

[通用风格块]

06 AFFECTIONATE — the cat is rubbing its face against a wooden chair leg.
DRAW THE CHAIR LEG — it must be fully visible in frame on the left side.
The cat's cheek and shoulder press INTO the wood; the head is tilted up
against it; the body leans in with its weight committed so the spine curves
toward the leg. Eyes squeezed shut into two happy upward arcs — NOT
half-lidded, NOT the default aloof look. One front paw hooked around the leg.
Tail raised high with the tip curled over.
Keep the canonical build: big head, head-to-body 1:1.4, chunky and round.
```

验收：06 必须能看见椅子腿，且猫的重心明显压向它；03 必须是半睁眼、身体未塌。

---

## 3b. 世界层 · 小团子姿态页 · 2026-09-07（取代第 3 节）

界面层已于 2026-09-07 封版，见 `outputs/cat-ip-concepts/2026-09-05/expressions-approved/`。

**对原第 3 节的两处修正：**

1. **世界层保留手绘质感，不改平涂。** 原规范写「世界层平涂」是我的推断，理由是缩放和动画。但对标月兔在同等小尺寸下是保留纹理的，而且 7% 屏高在 1844px 画布上约合 129px，质感完全撑得住。改为：**只有图标层平涂，界面层与世界层共用同一种彩铅质感。**这样全 App 只有一种画法，契约更简单。
2. **canonical 只作颜色／耳角／尾形参考，不作画法参考。** 世界层的简化程度远高于它，传图时要明说，否则会被拉回精细渲染。

```
[通用风格块]

Nine poses of Tuanzi at WORLD-LAYER scale, arranged in a 3x3 grid on a plain
sage green #C6D9C4 ground.

Use the canonical image ONLY as reference for colour, ear angle and tail
shape. Do NOT copy its level of detail — this layer is far more simplified.

SIMPLIFICATION — this is the point of the layer
- Face reduces to TWO DARK EYE DOTS. No eye sockets, no whiskers, no forehead
  stripes, no nose, no mouth.
- Keep the coloured-pencil grain and the soft fur-tuft silhouette. This layer
  is simplified, NOT flattened — do not switch to clean vector fills.
- Identity must survive on silhouette alone: ear angle, the long S-curved tail
  with ring markings, the chunky round build, honey orange.

EVERY pose is attached to an object. A cat standing alone on empty ground is
wrong.
1. curled asleep inside a woven basket
2. loafing on a mushroom-house roof
3. half emerging from a hanging woven nest
4. sitting at a pond edge, tail hanging down over the water
5. kneading a cushion
6. half buried under fallen leaves, only head and tail tip showing
7. stretching up against a tree trunk
8. drinking from a bowl
9. peeking out from behind a stone

Sleeping and lying poses should dominate the grid — real cats sleep most of
the day.

Output the grid at high resolution.
```

**必须同时出的验收图（关键）：**

```
Additionally output a second image: the same nine poses placed on the same
sage green ground but rendered at their TRUE IN-APP SIZE — each cat only
120 pixels tall — arranged in a single row. No zoom, no upscaling.
```

验收标准：**在 120px 那张里**，九个姿态要能分辨，且仍认得出是团子。这一层的全部价值就在这张图上——如果 120px 下糊了，三层画法的假设不成立，要回头改。

---

# 并行轨道 · 2026-09-07

界面层已封版。以下四条互不阻塞，可同时推进。每条内部仍遵守：单张／单批出图、已通过的产物不重掷、失败必须报告不许静默交付旧文件。

依赖关系：唯一必须串行的链是 `canonical → 世界层 → 场景 → 时段变体`。轨道 2、3、4 都不在这条链上。

---

## 轨道 1 · 世界层（进行中）

world-v1 九张姿态已出，姿势与物件绑定通过，**先不要修改，保留原样**。锁画法之前先出两张验收图。

```
不要修改现有九张，保留为 world-v1。不要删除鼻子、嘴或颊线。
不要重新生成任何已有的九张。

只追加输出两张验收图：

A) 尺寸验收：把九个姿态按每只猫 120px 高排成一行，纯 #C6D9C4 底，
   不放大、不插值、不做锐化。文件名 world-v1-120px-check.png

B) 跨层一致性验收：把 canonical 正面图与 world-v1 中「坐在池边」那只
   并排放在同一张图上，各自使用在 App 里的真实尺寸
   （canonical 约 400px 高，world 约 120px 高），纯 #C6D9C4 底。
   文件名 world-v1-vs-canonical.png
```

判据：A 图里九个姿态要能分辨、五官不糊成脏点；B 图里两只要像同一只猫。
A 决定鼻子和嘴留不留，B 决定体型要不要往 canonical 的厚圆靠。

---

## 轨道 2 · 图标层记号

**说明：出图模型是探索工具，不是交付工具。**图标最终必须是矢量。这一轮只用来定剪影，定了之后由人在矢量软件里重画。

```
[通用风格块中的 FORM 与 PALETTE 部分]

Silhouette mark of Tuanzi for an app icon and tab bar.

THIS LAYER IS FLAT — this is the ONLY layer that drops the coloured-pencil
texture. Solid single-colour shapes, no grain, no shading, no outline.

Identity must survive on silhouette alone: the ear angle and the long
S-curved tail. NO facial features at all. No stripes, no fur tufts.
Keep the chunky round build of the canonical.

Output three sizes side by side on a plain cream background, each rendered at
true size, no upscaling:
- 24 x 24 px  (tab bar)
- 48 x 48 px  (notification)
- 180 x 180 px (app icon)

Draw the 24px one FIRST and design the others down from it — if it does not
read at 24px it is wrong.
```

判据：24px 那个只靠耳朵和尾巴就认得出。认不出就简化到认得出为止。

---

## 轨道 3 · 物件库

**不依赖猫，现在就能跑。**这是密度的来源，也是整条产线上最重要的可复用资产——猫咪后院两个人能做出整个游戏，靠的就是物件库加组合。

分三批出，每批 16 个，4×4 网格。物件本身很小，网格不会造成角色那种比例挤压。

```
[通用风格块]

A 4x4 grid of 16 small hand-drawn props for a cosy cat world.
Plain flat #EFE6D2 cream background. Generous even margin around each prop so
they can be cut apart later. No overlapping, no shared ground line, no shadows
between them.

Same medium as the character art: coloured pencil and crayon grain, warm brown
#6B5B4A outlines with varying weight, never black. Flat colour underneath.

Palette strictly: sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2,
wood brown #B39C86. Coral #D8705C on at most one or two props in the batch.

Scale consistency: draw every prop as if it sits in the same world at the same
distance. A stool must read as larger than a bowl.

批次一 · 家具与器物:
wooden stool, low wooden table, woven basket, clay bowl, ceramic water bowl,
wooden bucket, hanging lantern, stack of books, rolled blanket, small crate,
straw broom, wooden sign post, ball of yarn, small cushion, watering can,
tin cup

批次二 · 植物与自然:
potted leafy plant, small potted flower, tall grass tuft, low grass tuft,
fern, single mushroom, mushroom cluster, fallen leaf pile, single leaf,
small rock, mossy rock, tree stump, log, twig bundle, dandelion, clover patch

批次三 · 猫用与杂项:
cat bed cushion, woven hanging nest, scratching log, feather toy, small bell,
food bowl with kibble, blanket in a heap, paper bag, cardboard box, fish
shaped toy, string with knot, wooden crate stack, lantern on a stand,
stepping stone, birdhouse, bundle of firewood
```

判据：任取 25 个拼成一屏不违和；三批之间线宽和质感一致。

---

## 轨道 4 · 资产转换流程

**这不是出图任务，是脚本任务。**不依赖任何图，现在建立比事后补便宜，而且能反过来改进出图要求。

```
写一套图像资产转换脚本，并用已封版的 7 张图跑通验证。

输入：outputs/cat-ip-concepts/2026-09-05/expressions-approved/ 下 6 张
      加 canonical/团子-canonical-v1.png

需要的步骤：
1. 去背 —— 这些图都是纯色平底（奶油或鼠尾草绿），用颜色容差抠除背景，
   输出带 alpha 通道的 PNG。边缘保留碎毛，不要硬切。
2. 裁切与对位 —— 自动裁到内容边界，然后统一放进同一尺寸的画布，
   按脚底对齐（不是按中心对齐），使多张切换时猫不会跳。
3. 多倍图导出 —— 同一张导出 @1x / @2x / @3x 三个尺寸。
4. 命名规范 —— 建议 tuanzi-{layer}-{name}@{scale}x.png，
   例如 tuanzi-ui-aloof@3x.png、tuanzi-world-sleep-basket@2x.png、
   prop-stool-wood-01@2x.png

输出到 outputs/assets/ 下，保持原图不动。
写一份 README 说明怎么跑，以及后续新图进来怎么处理。

同时告诉我：为了让转换更省事，后续出图应该增加哪些要求？
（例如底色、画布尺寸、构图留白、猫与物件是否分开出）
```

判据：跑完能直接得到一组带 alpha、对位一致、三个倍率的 PNG。

**注意：分层不在这套脚本能力范围内。**去背、对位、多倍图可以自动化；把眼睛和尾巴拆成独立图层不行——AI 输出的是已合成的位图，图层信息不存在。要做眨眼和尾巴摆动，这一步必须有人重画。这是整条产线上唯一确定需要人工的环节。

---

# 场景 · 2026-09-07

前置全部就位：配色方向 A、世界层九姿态（两项验收通过）、48 物件库（尺度已归一）、资产转换流程、画法契约。

**方法改变：场景不再整张生成。**物件库和资产流程就位后，整张生成变成了错的选择——物件和猫会烘死在背景里（参见蹭椅子那张的椅子腿），猫无法走动换姿势，昼夜与季节变体失去「同一套资产」的前提。

拆成两步：**背景板生成 → 物件与猫合成**。

---

## 5a · 背景板（唯一需要出图模型的一张）

```
[通用风格块]

Mobile portrait background plate, 853 x 1844, for a cosy cat world.

DRAW ONLY THE ENVIRONMENT. Do NOT draw any props. Do NOT draw any cat.
This plate will have props and a character composited on top of it later.

Contents, and nothing else:
- Sky and distant low hills at the top, lightest and least saturated.
- A mushroom house sitting left of centre, mid-ground.
- A large tree on the right with an empty woven nest hanging from a branch.
- A pond at the lower left.
- Ground: flat sage green with only a faint hand-stippled texture.

DEPTH BY VALUE ONLY — distant hills lightest, mid-ground darker, foreground
ground darkest. Do not separate depth by hue.

COMPOSITION FOR COMPOSITING
- Leave the area around the mushroom house and the lower-centre ground OPEN
  and uncluttered — that is where props and the cat will go.
- Keep the top 8% and bottom 12% of the frame visually quiet for interface.
- No vignette, no strong directional light, no cast shadows on the open ground.
  Shadows will be added per prop at composite time.

Palette strictly: sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2,
wood brown #B39C86, line brown #6B5B4A. Coral #D8705C only on the mushroom
house roof.

No text, no UI, no numbers, no characters.
```

判据：画面上没有任何可移动物件；蘑菇屋周围和下方中部留空；上下安全区干净。

---

## 5b · 合成（不用出图模型）

用已有素材拼，可写脚本也可手工摆。

```
把背景板、物件库和世界层的猫合成为一张 853x1844 的陪伴主页效果图。

素材来源：
- 背景板：5a 输出
- 物件：props/revision-2/ 的 48 个，按 05-cat-scale-reference.png 的尺度缩放
- 猫：世界层九姿态之一，建议用「睡在篮子里」

规则：
1. 至少摆 25 个物件，集中成一簇围绕蘑菇屋，占画面约 55%。
2. 其余地面保持干净，只有背景板自带的细噪点。不要把物件均匀撒满全屏。
3. 每个物件加一个极淡的接触阴影把它钉在地上，阴影方向全图一致。
4. 猫必须咬着一个物件（篮子），不能悬空站在草地上。
5. 猫要压在物件簇的前面一层，不要被物件挡住。
6. 强调色 #D8705C 的总面积不超过画面 3%。
7. 上 8% 与下 12% 不摆任何东西。

单独输出一份图层清单：每个物件的文件名、坐标、缩放比例。
以后调整位置改这份清单，不重新生成。
```

**验收三条，缺一不可：**

1. **能不能一眼找到猫。**世界层线细，之前在空绿底上偏淡。这是第一次在真实语境里验证——猫要是仍然要找半天，就统一加重世界层轮廓，那时改一次即可。
2. **密度对不对。**25 个以上、集中成簇、其余留空。均匀撒满即为不合格。
3. **颜色克不克制。**强调色 ≤3%；深度只靠明度拉开，不靠色相。

---

## 遗留小事

- 日记与我的两个 tab 图标待画，须与 `outputs/icon/tuanzi-mark.svg` 同一套线宽与圆角，不要各画各的。
- 物件尺度基准图里那丛草与猫等高，摆场景时注意别挡住猫。
- 蹭椅子那张的椅子腿仍烘在猫身上，需人工拆为独立素材。

---

# 方向 A 配色扩展 · 风景明度阶梯 · 2026-09-07

## 为什么要扩

首版场景实测：地面画成了 `#C9CEA6`（卡其橄榄），而不是指定的 `#C6D9C4`（鼠尾草绿）——蓝通道被压掉约 40。池塘 `#C0CAAA` 与草地几乎同色，全画面没有一点蓝。强调色 `#D8705C` 变成 `#D6AC8A` 浅米粉。相邻层 ΔL 仅 6–10，全部「勉强」。L<60 的暗部占比 0.16%，整张发灰。

根因不是执行不力，是**色板本身不够用**：方向 A 只定义了两个绿（`#C6D9C4` / `#A6C0A3`，ΔL 仅 11），而一张风景至少需要六档。中间色只能由模型自己编，编出来就偏黄。

## 阶梯（风景专用，UI 配色不变）

| 用途 | 色值 | 明度 L | 说明 |
|---|---|---|---|
| 天空 | `#EFE6D2` | 88 | 唯一的暖色大面积，保持 L ≥ 235 |
| 远山 | `#D2DFCD` | 84 | 最淡的鼠尾草 |
| 中山 | `#B8CDB4` | 75 | |
| 近树丛 | `#9DB89A` | 66 | |
| 地面·远（地平线附近） | `#C6D9C4` | 81 | **方向 A 主色，锚点不许动** |
| 地面·中 | `#B0C8AD` | 72 | |
| 地面·近（前景） | `#9BB899` | 66 | 越靠近观众越暗，不许反过来 |
| 池塘 | `#9FC0C2` | 69 | **靠色相和草地区分，不只靠明度**。全画面唯一的冷色 |
| 木头 | `#B39C86` | 62 | |
| 线条 / 暗部锚点 | `#6B5B4A` | 36 | 树干、门窗、深处必须压到这一档 |
| 强调 | `#D8705C` | 64 | 蘑菇屋顶。**必须是这个饱和度**，不许洗淡 |

## 硬性判据（出图后我会直接测）

1. 地面主体色的**蓝通道不得低于 185**。低于就是画成橄榄了。
2. `L < 60` 的像素占全画面 **8%–15%**。首版是 0.16%。
3. 相邻层 ΔL ≥ 12。首版全部是 6–10。
4. 池塘的**色相必须落在青蓝区**，不得与草地同色相。
5. 地面明度必须从远到近**单调变暗**。首版中部比底部暗，是反的。
6. 天空 L ≥ 235，且是全图唯一的暖色大面积。

## 写进提示词的话术

```
PALETTE — use these exact values. Do not invent intermediate tones.
sky #EFE6D2 / far hills #D2DFCD / mid hills #B8CDB4 / treeline #9DB89A
ground far #C6D9C4 / ground mid #B0C8AD / ground near #9BB899
pond #9FC0C2 (the only cool colour in the frame — it must read as WATER,
not as more grass) / wood #B39C86 / line and darks #6B5B4A
accent #D8705C at full strength on the mushroom roof — do not wash it out.

The greens are SAGE, not olive and not khaki. The blue channel of the ground
must stay at or above 185. If the ground looks yellowish, it is wrong.

VALUE — the image must contain real darks.
At least 8% of pixels below L=60. Tree trunk, door, window, deep water and
the underside of the canopy all go to #6B5B4A or darker.
Ground gets progressively DARKER toward the viewer, never lighter.

---

# 世界配色定版 · 蓝天绿地 · 2026-09-07

**本节覆盖上方「方向 A 配色扩展」中的天空、远山、池塘三项。**其余不变。

## 为什么换掉奶油天

奶油天空是「手绘在暖奶油纸上」这条设定漏过来的，不是设计决定。它有两个硬伤：

1. **挡住昼夜功能。** 奶油色没有可以走向的夜，只能整体变灰。蓝天可以走晨粉 → 昼蓝 → 暮橙紫 → 夜靛。天空是承载时间的主要元素，这条是功能性的，不是审美。
2. **和猫同在暖区。** 首版实测天空 42°、猫 30°，两者只差 12 度。猫飞不出来。

## 定版色板

| 用途 | 色值 | 色相 | 明度 L |
|---|---|---|---|
| 天空 | `#CFE3EA` | 196° | 86 |
| 远山 | `#C3D5C2` | 113° | 80 |
| 中山 | `#AAC5A8` | 114° | 71 |
| 近树丛 | `#8FAF8E` | 118° | 62 |
| 地面·远 | `#C6D9C4` | 114° | 81 |
| 地面·中 | `#B0C8AD` | 113° | 72 |
| 地面·近 | `#9BB899` | 116° | 65 |
| 池塘 | `#9FC0C2` | 183° | 69 |
| 木头 | `#B39C86` | 33° | 62 |
| 线条与暗部锚点 | `#6B5B4A` | 30° | 36 |
| 团子 | `#E3A05C` | 30° | 72 |
| 强调（蘑菇屋顶） | `#D8705C` | 10° | 60 |

夜间：天 `#2E4258` / 远山 `#334A50` / 中山 `#2C4441` / 地面 `#33503F`→`#28402F` / 池塘 `#2A4550` / 灯光 `#F0B94E`。同一套资产压暗降饱和加光源，不重画。

## 三条锁死的结构规则

1. **地面色相必须在 100°–120°。** 团子是 30°，两者相差 84 度接近互补，这是猫无论走到哪都能被一眼看见的唯一保证。任何把地面推向黄或橙的改动都在削弱主角。首版画到 67°，角距塌到 37°，猫就陷进去了。
2. **画面必须有三簇色相：暖 10–33°、绿 113–118°、青 183–196°。** 首版七个颜色全挤在 27°–79° 的窄扇区，这是发闷的根本原因，与明暗无关。
3. **池塘是全图唯一的冷色块（除天空外），必须靠色相与草地区分。** 首版池塘 `#C0CAAA` 和草地同色相，等于没有。

---

## 5a 背景板 · 重出提示词

```
[通用风格块，但 PALETTE 一节整体替换为下面的 PALETTE]

Mobile portrait background plate, 853 x 1844, for a cosy cat world.

DRAW ONLY THE ENVIRONMENT. No props of any kind. No cat.
Props and the character are composited on top later.

Contents, and nothing else:
- A soft blue sky at the top.
- Distant low hills, then a nearer treeline.
- A mushroom house left of centre.
- A large tree on the right with an EMPTY woven nest hanging from a low
  branch, hanging low enough that a small cat could climb into it.
- A pond at the lower left.
- Open ground filling the lower half.

PALETTE — use these exact values, do not invent intermediate tones.
sky #CFE3EA  far hills #C3D5C2  mid hills #AAC5A8  treeline #8FAF8E
ground far #C6D9C4  ground mid #B0C8AD  ground near #9BB899
pond #9FC0C2  wood #B39C86  line and darks #6B5B4A
mushroom roof #D8705C at full strength — do not wash it out.

The greens are SAGE, not olive and not khaki. The blue channel of the ground
must stay at or above 185. If the ground looks yellowish, it is wrong.

VALUE — the image must contain real darks.
At least 8% of all pixels below L=60. The tree trunk, the door, the window
recess, the deep side of the pond and the underside of the canopy all go to
#6B5B4A or darker. Ground gets progressively DARKER toward the viewer,
never lighter.

LINE — the background must use the SAME line as the props.
Colour #6B5B4A, the same weight as the prop library, with the same variation
within a stroke. Do NOT draw the background in a pale grey-green pencil —
in the previous version the background line was much lighter than the props
and everything looked pasted on.

TEXTURE — no uniform paper grain over the whole image.
Grain appears only inside filled shapes, denser at the centre and looser at
the edges. Open ground and sky stay clean.

SCALE — the mushroom house must be 18%–22% of the frame height.
In the previous version it was 9%, shorter than a stool, which does not work
— it is a house the cat lives in, and the cat is only 120px tall.

COMPOSITION — leave the ground around the mushroom house and the lower centre
OPEN. Keep the top 8% and bottom 12% quiet for interface. No vignette, no
directional light, no cast shadows on open ground.

No text, no UI, no numbers, no characters.
```

## 出图后我会直接量的六个数

1. 地面主体色蓝通道 ≥ 185
2. `L < 60` 的像素占 8%–15%
3. 相邻层 ΔL ≥ 12
4. 天空色相落在 185°–210°，地面色相落在 100°–120°
5. 池塘色相与草地相差 ≥ 50°
6. 地面明度由远及近单调变暗

---

# 连续世界长卷 · 2026-09-07

**纠正：853×1844 是手机视口，不是世界尺寸。**此前的 5a 背景板把整个世界压成了一张竖版单屏，丢掉了 2026-08-31 已确认的「四类地点＋横向连续世界＋镜头跟着猫走」。物件也因此全部摊在同一块草地上，与地点脱钩。

世界是 **3412 × 1844（4 个视口宽，比例 1.85:1）** 的连续长卷。

## 地点顺序与归属

从家往外走：**蘑菇屋＋空地 → 摇篮 → 池塘 → 树区**

| 地点 | x 范围 | 内容 |
|---|---|---|
| 蘑菇屋＋空地 | 0.02–0.26 | 屋高占画面 20%。屋外：木凳、矮桌、书堆、提灯、柴捆、水桶、盆栽、告示牌、扫帚。屋内透过门与圆窗可见：壁炉、沙发一角、猫粮碗、饮水碗、玩具 |
| 摇篮 | 0.30–0.46 | 独立猫用摇篮挂在两根木桩之间，约 1.5 倍猫高。周围：垫子、卷毯、毛线球、逗猫棒、草丛 |
| 池塘 | 0.48–0.72 | 宽约长卷 1/4，地势最低，**水中可见鱼群**。岸边：踏脚石、苔石、蕨类、荷叶、水桶、小花 |
| 树区 | 0.74–0.99 | 大树最高，树冠伸到上三分之一。**水滴形编织吊窝挂低枝上猫够得着，树下另有圆形落地猫窝——两个窝不合并**。周围：树桩、原木、猫抓柱、鸟屋、纸箱、落叶堆 |

## 比例基准（全部以团子为尺）

团子高 = 画面高 6.5%（视口内 120px）。蘑菇屋 3.1×／大树含冠 9×／摇篮 1.5×／落地猫窝 1.2×／木凳 1.3×／水碗 0.5×／蘑菇落叶铃铛 0.2×。

**地平线固定在画面高度 26%，四地点共用同一条。**地面在池塘处最低，向两端缓缓抬起。

## 第一步 · 长卷提示词

```
[通用风格块] + [世界配色定版 · 蓝天绿地 的 PALETTE 与 VALUE 两节]

A single continuous wide panorama of a cosy cat world.
Aspect ratio 1.85 : 1 (four phone screens wide). Render at the largest
resolution available — this plate defines spatial relationships, not final
pixels.

ONE continuous ground, ONE horizon line, ONE light. The four locations below
sit along it from left to right and must feel like one place you could walk
across, not four separate pictures.

Horizon line at 26% of the image height, shared across the whole width.
Ground is lowest at the pond and rises gently toward both ends.

LEFT TO RIGHT:
1. x 0.02–0.26 — a mushroom house with an open play area in front of it.
   The house is 20% of the image height. Through its round window and open
   door you can see a little of the inside: a fireplace, the corner of a sofa,
   a food bowl and a water bowl.
   Outside on the grass: a wooden stool, a low table, a stack of books, a
   lantern, a bundle of firewood, a bucket, a potted plant, a sign post,
   a straw broom.
2. x 0.30–0.46 — a cat-sized woven hammock cradle slung between two short
   wooden posts, low enough for a cat to jump into. Around it: a cushion,
   a rolled blanket, a ball of yarn, a feather wand toy, tufts of grass.
3. x 0.48–0.72 — a pond, about a quarter of the panorama wide, sitting in the
   lowest part of the ground. FISH ARE VISIBLE IN THE WATER. Along the bank:
   stepping stones, a mossy rock, ferns, lily pads, a bucket, small flowers.
4. x 0.74–0.99 — a large tree, the tallest thing in the world, its canopy
   reaching into the upper third. A teardrop-shaped WOVEN HANGING NEST on a
   LOW branch, low enough that a cat could climb in. Separately, on the ground
   beneath it, a ROUND FLOOR CAT BED — these are two different beds, do not
   merge them. Around: a tree stump, a fallen log, a scratching post, a
   birdhouse, a cardboard box, a pile of fallen leaves.

SCALE — everything is measured against the cat, who is 6.5% of the image
height. Mushroom house 3.1x the cat. Tree with canopy 9x. Cradle 1.5x.
Floor cat bed 1.2x. Stool 1.3x. Bowls 0.5x. Mushrooms and leaves 0.2x.

DENSITY — each location is its own dense cluster of objects that belong
there. Between locations, leave the ground clean and open. Do not scatter
objects evenly across the whole width.

NO CAT anywhere in this image. No text, no UI, no numbers.
```

## 后续三步

1. 按 853 宽切成四段，逐段核对构图与地平线连续性
2. 以长卷为参考，每地点单独重出 853×1844 高清，**必须指定同一条地平线高度与同一组地面色**
3. 物件与猫分层合成，沿用现有脚本与图层清单，物件按地点归属分组

**不要一开始就分四张独立生成**——地平线、地面色、光照几乎一定对不齐，接缝会明显。先要统一基准。
