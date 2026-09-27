# 界面风格验证 v1 · 出图委托单 · 2026-09-12

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 12 张，每张单独生成，按第四节的顺序做，前一张没过不做后一张。**

> **2026-09-12 第一轮否决后修订**：U9a–U9d 四张作废（原因见 `outputs/ui-style-v1-review/验收报告.md`）。页面底的比较改在 U2 起名页上做（U2a–U2d），标题字也在 U2 上出一张无衬线变体（U2t）让用户挑；UI_LOCK 加了反 neumorphism 和暗部要求；出图顺序改为 U2 → U2t → U2a–d → U1 → U8 → U5 → 其余。
这一轮出的是**方向稿**：用来验证界面层的风格，看能不能压在毛毡院子的各种天色上。
**方向稿不进 App。** 进 App 的是三样东西：从方向稿上量出来的参数（颜色、圆角、尺寸）、照着方向稿手画的 SVG 图标（`assets/icons/svg/`）、以及已经验收过的团子帧（`assets/tuanzi/frames-v5/`）。方向稿里的猫、图标都不切出来用。

这轮要说的一句话：**界面是一层安静的米白薄纸，压在彩色毛毡院子上；院子换天色它不变，只在角落留一个猫的小记号。**

---

## 一、硬规矩

1. **一个编号 = 单独生成的一张竖屏图。** 画布 **1024×1536**（对应 390×844 屏，约 2.6 px/pt）。不出网格、不拼贴、不画手机壳、不画多屏并排。
2. **文件名必须是 `编号__r轮次.png`**，例如 `U1-splash__r1.png`。
3. **失败必须上报，禁止拿旧图顶替。** `delivery.json` 每个编号一条，状态只能是 新生成 / 失败 / 没做。验收第一步比哈希。
4. **一次只改一件事。** 返工时只重出不合格的那一张，只改指出的那一处。
5. **图参考优先于文字。** 每张都传参考图；界面材质照 S1、S2，院子照 R-home，猫照 R1 和 N4。
6. **不重新设计猫。** 猫只能是 R1 这只：厚圆、宽胯、半眯眼、无眼神光、彩铅颗粒。不做 3D 毛绒玩具，不做 S3/S5 里那种潮玩质感，不加围兜式胸毛。
7. **不抄参考里的品牌。** S1–S5 只借材质、比例、版式；它们的吉祥物、字标、配色一律不出现。文案全部中文，没有"打卡、等级、任务、连续天数"。

---

## 二、参考图

放在 `assets/ui/style-v1/refs/`。S1–S5 是用户 2026-09-12 的手机截图，已裁掉小红书的界面，只留海报区域（第三方作品，只作参考，不进仓库以外的任何交付）。

| 编号 | 文件 | 用途 | 来源 |
|---|---|---|---|
| R-home | `../../scenes/atmosphere-v1/refs/R-home-screenshot.jpg` | 现在的首页。院子的样子、控件现在的位置和大小 | 仓库，SHA `604594c5a39c` |
| R1 | `../../tuanzi/frames-v5/refs/R1-cat-identity.png` | 猫的唯一身份基准 | 仓库 |
| N4 | `../../../outputs/frames-v5-delivery/N4-settle/N4-settle__r1.png` | 第 3 格坐姿：启动页、命名页里猫的姿势就是它（App 里能动的就是这套帧） | 仓库 |
| S1 | `refs/S1-light-skeuo-docs.png` | 轻拟物 + 毛玻璃的材质、图标粗细、卡片圆角与投影 | 用户截图（UX 设计便利店），SHA `ebd121517324` |
| S2 | `refs/S2-warm-membership.png` | 渐变底、白卡、按钮的高光做法、数字与说明的字级关系 | 用户截图（陈色计），SHA `14653da70d70` |
| S2-close | `refs/S2-single-screen-r2.png` | U2 r2 的最强参考：小字级、原生 iOS 顶栏、轻雾化背景、精细白框 | 用户 2026-09-12 重新截取，SHA `90d304e9398c` |
| S3 | `refs/S3-empty-states.png` | 空态的留白量、手绘细箭头、角色从边缘探出 | 用户截图（陈色计），SHA `d56a4755a041` |
| S4 | `refs/S4-mood-question.png` | 命名页的版式骨架：顶部一句话、中间角色、下面大字、控件、黑胶囊 | 用户截图（程序员八阿哥），SHA `a56a6a464097` |
| S5 | `refs/S5-splash.png` | 启动页骨架：上三分之一字标、下半角色、渐变底 | 用户截图（陈色计），SHA `584e99ef363a` |

### 从参考里提取的参数

R-home 与 S1–S5 的底色是量出来的（在裁好的截图上取区域平均色）；圆角、投影、字级是目测估的。

| 项 | R-home（量） | S1 轻拟物（估） | S2 会员页（估） | 我们这轮采用 |
|---|---|---|---|---|
| 页面底 | 场景本身 | 屏内近白：顶 `#F3F0EE`（S0.02 V0.95）→ 中 `#E6E6E6`，几团极低饱和的粉蓝虚光；海报外底 `#EBECF0→#C9D1F2` | 屏内：左屏顶 `#F9F0DD`（S0.11）→ 右屏 `#FBFAF1→#F7F6F7`；海报外底是暖黄 `#A79250→#F1F1F1` | **本轮不定**：U2a–U2d 在通过的 U2 上换四种候选底试效果（见交付清单）。其余各张统一用候选 a 米白平纸 `#F6F2EA→#FBF8F2`；**不用暖黄，不用冷薄荷** |
| 卡片 | — | 纯白、圆角约 20pt、投影 y8 模糊 24 约 6%、顶边 1px 白高光 | 纯白、圆角约 20pt、暖投影 | 纯白或 `#FDFBF7`，圆角 18–20pt，投影 = ink 7%、y6 模糊 14（`Metrics.cardShadow` 现值），顶边 1px 高光（轻拟物就靠这一条线） |
| 场景上的控件面 | 半透明，透出天空：节点内色量得 `(179,210,221)`，偏蓝 | 毛玻璃白，卡面量得 `#D5D4E4`（S0.07，透出了底的淡紫） | 白卡量得 `#F4F3F4`（S0.00） | 米白 `#F3EFE6` 88–92% 不透明 + 轻模糊；**不能透出天空的色相**，否则夜里、雨天会变色。S1 那种透底的做法只许用在页面里，不许用在院子上 |
| 圆形控件直径 | 地点轨节点 32–36pt、头像 42pt | 底栏图标位约 44pt | 数值图标圆 36pt | 32 / 36 / 44 三档（`iconSlotSm/Md/Lg` 不变） |
| 图标 | 棕线 `#6B5B4A`，约 1.5pt | 单色深灰细线，约 22pt、1.5pt | 彩色填充圆图标 | 单色细线，20pt 图标在 36–44pt 圆里，线宽 1.5pt（1024 画布上约 4px）；**不用彩色填充图标** |
| 胶囊 | 状态句 154×25pt；「聊会儿」92×36pt | 分段胶囊高约 28pt | 主按钮通宽、高约 48pt、黄渐变 + 顶部白高光 | 主按钮通宽 52pt 珊瑚 `#C25A3E` + 顶部 1px 高光；场景上的小胶囊 36pt |
| 珊瑚占屏 | 1.3%（按钮 + 选中节点） | — | — | ≤ 2% |
| 字 | 中文无衬线 | 名字用衬线、其余无衬线 | 数字大、说明 11–12pt 灰 | 标题衬线 25–34pt（`Typo.serif`），正文无衬线 13.5–16pt，说明 `ink3` |

---

## 三、通用提示词前缀

**UI_LOCK**（每张都贴）

```
Mobile app screen, portrait 1024x1536, Chinese UI text. Style: quiet light-skeuomorphic UI —
off-white (#F6F2EA to #FBF8F2) surfaces with a faint paper/felt grain, pure-white cards with soft
diffuse shadow and a 1px top highlight, generous whitespace, thin monoline icons in a single dark
ink (#1F3022), 1.5pt stroke, no filled or multicolor icons. Exactly one accent colour: coral
#C25A3E, used on at most one primary control per screen. No yellow, no gradient buttons, no
glossy plastic, no neon, no black pill buttons. Corner radius 18-20 on cards, full pill on bars.
Typography: serif for titles, sans for body, all Chinese. NOT flat vector, NOT 3D render,
NOT glassmorphism with rainbow blur. Match the material of reference S1 and the card/shadow
handling of S2, but in off-white instead of their colours.
NOT neumorphism: no puffy raised cards, no inner glow, no embossed circles, no double
(light+dark) shadows. A card is separated from the page by ONE flat shadow or a 1px hairline,
and by being clearly lighter than the page (card L at least 8 higher than the page base).
The screen must contain real darks (ink text, a dark detail on the cat, the wood sign edge):
at least 4% of pixels darker than L60. The page must be filled top to bottom with structure;
if the lower third is empty there must be a reason (the cat sits there, or a button).
Every screen shows at least three hue clusters: the off-white base, Tuanzi's honey orange
(#E3A05C), and the ink; a page with only beige and grey is a failure.
```

**SCENE_LOCK**（U5、U6 贴）

```
The screen background is reference R-home unchanged: the handmade felt courtyard (mushroom house,
tree, mailbox, cushion, cat). Do not redraw or move anything in the courtyard. Only the UI layer
changes: every control becomes an off-white (#F3EFE6, ~90% opaque, slightly frosted) surface that
reads the same on blue sky, green grass, or a dark night sky — it must NOT take on the colour of
the sky behind it.
```

**CAT_LOCK**（U1–U4 贴）

```
The cat is exactly reference R1: chunky round body, wide hips, low centre of gravity, half-closed
almond eyes with dark bean pupils and NO eye highlight, three forehead stripes, ring-striped long
S tail, cream chest fur flowing from chin to belly, warm-brown variable line, coloured-pencil
grain. Pose from reference N4 cell 3 (sitting, facing viewer slightly right) unless stated.
Do not restyle, do not make it plush/3D/toy-like, do not widen the eyes.
```

**MOTIF_RULE**（每张都贴）

```
Decoration: at most ONE small motif per screen, monoline in the same ink, 16-24pt, tucked into
a corner or beside a caption, never on top of the courtyard scene. Allowed motifs: cat paw print,
a trail of 3 paw prints, cat head outline, a pair of cat ears, a small mushroom, a hand-drawn thin
curved arrow (as in reference S3). No stars, hearts, sparkles, confetti.
```

---

## 四、交付清单

每张：编号、画的是什么、传哪些参考、允许改什么。

### U1-splash · 启动页

传：S5（骨架）、R1、N4、R-home（取院子的天色做底的色感）。
- 版式照 S5：上三分之一是字标「猫猫」（衬线，深墨，不描边不发光），下半是团子 N4 坐姿，占屏宽约 45%；底部一行极小的灰字（版本号占位）。
- 底：**不是暖黄**。米白到淡天蓝的极柔竖向渐变（`#FBF8F2` → 顶部略带 R-home 的天蓝 `#CFE3EA`），有毛毡纹。
- 点缀：字标旁一枚 20pt 爪印，或团子脚边三个脚印，二选一。
- 注意：App 里这只猫是用 N4/N5 的帧播出来的（坐着眨眼、甩尾），方向稿只画一格。

### U2-naming · 起名页（新用户）· **这轮的母版，最先做**

传：S4（骨架）、R1、N4、`ios/Maomao/Features/Onboarding/NamingStep.swift` 的现状截图（如有）。
- 这张要先过，因为它自带三簇颜色（团子蜂蜜橙、木牌暖棕、珊瑚按钮）和真正的暗部（木牌描边、猫的条纹、墨字），底色好不好压在这些下面才看得出来。猫占屏宽约 50%，坐在页面中段，不许缩成一个小图标。
- 版式照 S4：顶部一句衬线大字「给它起个名字」，下一行说明 13.5pt `ink3`「它会用这个名字认自己。以后也能改。」；中间团子 N4 坐姿；猫下面是**木牌**（现有 `signFace #D9C39C`、描边 `#6B5B4A`）写着名字「团子」，衬线 30pt；木牌下面一个白色输入框（圆角 12，高 46）；底部通宽珊瑚主按钮「下一步」。
- 底：米白渐变；不做 S4 那种整屏跟情绪变色。
- 点缀：说明文字末尾一枚小猫耳，或没有。
- 这是把现有命名页搬进 S4 的骨架，木牌保留是因为它是"暖色重音"（`docs/决策/2026-09-08` 1.1 再修订），不要换成黄色。

### U3-empty-diary · 日记空态

传：S3（留白与箭头）、R1。
- 版式照 S3 右上那格：几乎全白，左上角一行 13pt 灰字「还没有记下什么。团子今晚会自己写一条。」，一条手绘细弧箭头从文字指向下方，团子从屏幕右侧边缘探出半个身子（只露头和一只前爪，R1 的脸，半眯眼，不卖萌）。
- 不放按钮。不放"开始记录"之类的行动号召。
- 点缀：箭头本身就是点缀，不再加。
- 这一格里的猫姿势是新的（探出边缘），只用于方向稿；要进 App 得另开一轮逐帧委托。

### U4-offline · 连不上的空态

传：S3（同上）、R1。
- 同 U3 的留白量。灰字「网络睡着了，团子还在院子里。」；团子 N4 坐姿缩到屏宽 30%，坐在画面下三分之一；一枚 36pt 米白胶囊「再试一次」，**不用珊瑚**（这不是主操作）。
- 猫不做沮丧表情（`docs/决策/2026-09-12` 第 6 条：网络失败不是情绪）。

### U5-home-day · 首页控件换新（白天）

传：R-home（图生图）、S1（控件材质）。
- 院子一像素不动。只重画界面层：顶部状态句胶囊、右上头像圆、左侧地点轨六个圆钮 + 竖线、右下「聊会儿」胶囊。
- 全部控件面换成米白 `#F3EFE6` 约 90% 不透明、轻磨砂、1px 顶高光、极软投影；图标改成单色细线（棕线 `#6B5B4A` 或墨 `#1F3022`，整张只选一种）；选中节点仍是珊瑚实心；「聊会儿」仍是珊瑚。
- 位置和尺寸照 R-home 量出的值：状态句 154×25pt、头像 42pt、节点 32–36pt、「聊会儿」92×36pt。

### U6-home-night · 同一套控件压在夜色上

传：U5 的结果、`outputs/atmosphere-v1-delivery/A3-night`（若氛围 v1 已交付）。
- 目的只有一个：证明 U5 那套米白控件放在深蓝夜空和暗草地上不用改就能看清。
- **只换背景，不动控件。** 如果 A3-night 还没到，这张标"没做"，不要自己把 R-home 调暗。

### U7-motif-sheet · 点缀图案表

传：S3（箭头的手绘感）、R1（猫头轮廓比例）。
- 画布 1024×1024，纯白底（这张是唯一允许多个图案同画的，因为它们是图标不是角色）。
- 十二个图案，等距排 4×3，每个约 160px，之间留足空白，不画格线：爪印、三连脚印、猫头轮廓、一对猫耳、小蘑菇、手绘弧箭头（左弯、右弯各一）、水碗、信箱旗、树窝、云朵、月牙。
- 全部单色细线，同一线宽（约 6px，对应 24pt 尺寸下 1.5pt），无填充，无阴影。
- 这张只做方向；最终图标要按目标像素尺寸手画成 SVG（小尺寸下线要更粗，不是缩小）。

### U8-component-sheet · 控件表

传：S1、S2、U5 的结果。
- 画布 1024×1536，分三横带，底色从上到下分别是：米白页面底、R-home 的天蓝、深蓝夜色 `#1D2B44`。
- 每一带里同一组控件：主按钮（珊瑚）、次按钮（米白胶囊）、输入框、一张白卡（带 1px 顶高光）、一个 36pt 圆图标钮、一个开关（开态 `#668C6C`）、一枚 chip。
- 目的：同一套控件在三种底上都能看清，且颜色不随底变。

### U2t · 标题字候选，在 U2 上只换字（U2 通过后、换底之前做）

传：通过的 U2。
- 和 U2 一个像素都不差，**只换标题「给它起个名字」和木牌上的名字的字体**：衬线换成圆润的人文无衬线（类似苹方／思源黑体的中黑，笔画末端略圆），字号、位置、颜色不变。说明文字和按钮本来就是无衬线，不动。
- 目的：现在 App 的标题用衬线（`docs/决策/2026-09-08` 三稿定），第一轮 U9 里它显旧。用户在 U2（衬线）和 U2t（无衬线）之间挑一个，挑中的再拿去换底。挑无衬线就要在决策记录里推翻 09-08 的那条。

### U2a–U2d · 页面底候选，在挑中的 U2 或 U2t 上换

传：通过的 U2、S1（a 与 d 的材质感）、S2（c 的暖感）。
- 四张画的是**用户挑中的那张（U2 或 U2t）**，猫、木牌、输入框、按钮、文字一个像素都不许差，**只换页面底**：
  - **U2a 米白平纸**：`#F6F2EA→#FBF8F2` 竖向渐变，纹理明度差 ≤ 0.02。
  - **U2b 米白毛毡**：同一组色，铺极淡的毛毡纤维纹，纹理明度差 0.03–0.04，让页面和院子是同一种材料。
  - **U2c 暖纸**：现有留言纸色 `#F6EEDC→#FBF6EA`（S 约 0.10），带纸纹。看它和木牌撞不撞色。
  - **U2d 淡天青灰**：`#EEF1F1→#F7F8F7`（S ≤ 0.03），可有几团极低饱和的虚光。
- 这四张的目的只有一个：让用户挑页面底的颜色和材质。挑中的值回填 `Palette.bg`，写进决策记录；没挑中的不返工。
- **为什么不再用空壳日记页比底**：第一轮 U9 证明了底色在没有内容的页面上比不出来，四张一起土。底要压在团子、木牌、珊瑚按钮这三簇颜色下面才看得出好坏。

### 出图顺序

U2 → U2t → （用户挑字）→ U2a–d → （用户挑底）→ U1 → U8 → U5 → U6 → U3 → U4 → U7。U2 是这轮的母版：它过了，材质、卡、按钮就定了；字和底各由一组变体让用户挑；后面的图只是换内容。U2 没过就停，不做后面的。每个"用户挑"都是一次停顿，挑完才继续。

---

## 五、验收判据（先量数再看图）

图回来后按 `docs/工作约定.md` 五道关。第四关"内容指纹"对这轮量这些：

| # | 量什么 | 过线 | 为什么是这个数 |
|---|---|---|---|
| 1 | 每个控件面中心 24×24 像素的平均色：饱和度 S、明度 V | S ≤ 0.08 且 V ≥ 0.90 | S1、S2 的卡片都是纯白；给米白留暖调余量到 0.08。现在首页节点内色 `(179,210,221)` S≈0.19，就是透了天，不合格 |
| 2 | 珊瑚像素占整屏 | ≤ 2% | 现在首页量出来 1.3%，允许多一个胶囊 |
| 3 | 图标线的颜色簇 | 整张只有一种深色 | 单色线是这轮的定义 |
| 4 | 图标线宽（1024 画布） | 3–5px | 1.5pt × 2.6 |
| 5 | 圆形控件直径 | 落在 32 / 36 / 44pt ±3pt | `Metrics.iconSlot` 三档 |
| 6 | 点缀数量 | 每屏 ≤ 1 处；U5/U6 院子区域内 0 处 | `art` 规矩：摆的东西要有理由 |
| 7 | 页面底纹理 | U2a ≤ 0.02、U2b 0.03–0.04、U2c 与 U2d ≤ 0.04；其余各张 ≤ 0.04 | S1 的底量得几乎是平的（相邻区块 V 差 < 0.01），纹理不能抢内容 |
| 7b | U2a–d 四张的非底区域像素差 | 猫、木牌、按钮、文字区域 ΔE 均值 ≤ 4 | 四张只许差底，否则比的不是底 |
| 10 | 暗部 `L<60` 占整屏 | ≥ 4% | 第一轮 U9 只有 1.8%，整页蒙着；S1 左屏 5.6% |
| 11 | 卡面与页面底 ΔL | ≥ 8，或有 1px 描边 | 第一轮 U9 只有 4，模型只能靠鼓起来的投影分卡，读成 neumorphism |
| 12 | 卡的投影 | 只有一层、只朝下、无内高光、无亮边浮雕 | 反 neumorphism |
| 13 | 色相簇 | 有色像素（S > 0.15）至少落在两个相距 ≥ 60° 的扇区 | 第一轮 U9 全在 37–42°；团子的蜂蜜橙 30° 与墨绿 150° 就是两簇 |
| 8 | U6 与 U5 的控件区域像素差 | 控件区域 ΔE 均值 ≤ 6 | 证明"不随天色变" |
| 9 | 猫 | 人眼对 R1：眼型、无眼神光、体型；不量 | 方向稿，猫不进 App |

判据 1 若因为磨砂透出一点底色而普遍过不了，把 S 上限放到 0.10 并写明；再过不了就是材质本身不对，不是数的问题。

---

## 六、交付方式

- 目录 `outputs/ui-style-v1-delivery/`，每个编号一个子目录（U2a–U2d 各自一个），图 + `delivery.json`。作废的 U9 移到 `_rejected/`。
- `delivery.json` 每条：`id`、`file`、`status`（新生成 / 失败 / 没做）、`refs_used`、`note`。
- 验收报告写 `outputs/ui-style-v1-review/验收报告.md`；过了的参数值回填到 `ios/Maomao/DesignSystem/Palette.swift`、`Metrics.swift`，再改代码。

---

## 七、这轮不做

- 不出聊天页、日记页、我的页的整页方向稿（先用 U8 控件表验证材质，页面结构已有实现）。
- 不做深色模式。
- 不出任何进 App 的位图：图标最终是 SVG，猫最终是帧。
- 不改院子。
