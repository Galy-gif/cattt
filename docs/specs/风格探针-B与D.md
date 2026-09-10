# 风格探针 · 四屏 × 两套配色

**用途只有一个：定风格方向。**不是页面规格，不用抠文案，文字乱码属正常。定完方向后可点击 demo 用代码搭。

## 为什么是这四屏

它们分别压测视觉系统的四种表面。一套配色在这四屏上都成立，基本不会翻车。

| 屏 | 它在回答什么问题 |
|---|---|
| 陪伴主页 | 界面元素压在整屏插画上，看不看得清、抢不抢主角 |
| 日记 · 今天 | 文字最密的页面，长文可读性和卡片体系立不立得住 |
| 专注聊天 | 对话气泡在虚化世界上的对比够不够，两方是否分得开 |
| 我的 | 列表最密的页面，分组、分隔线、开关的语言统不统一 |

## 怎么跑

**八次独立生成，每次一张，不要拼网格。**顺序：先把 B 的四屏跑完，再跑 D 的四屏。

每次发：`通用块` + `配色块（B 或 D）` + `一个屏块`。

---

## 通用块

```
Design a mobile app UI screen for a companion cat app. Output ONE image at
390 x 844 (iPhone logical size). Do not add a device frame, do not add a grid,
do not output multiple screens in one image.

WHAT THE APP IS
The user has one cat that lives in a fenced garden and goes about its own life.
There are no tasks, no daily check-ins, no levels, no coins, no feeding
pressure. Quiet, warm, unhurried. The interface should feel like a well-made
paper object, not a game HUD.

TYPOGRAPHY
A serif with real character for headings (Songti / Noto Serif SC feel), a clean
sans for body and controls. Headings clearly larger than body. Generous line
spacing. Three distinct levels: heading, body, secondary.

COMPONENTS
4px corner radius. 1px hairline borders. NO heavy drop shadows, NO
glassmorphism, NO gradients, NO rounded shadow cards floating on a page.
Primary button: solid accent, full width, 52px tall, with a 2px darker bottom
edge. Secondary action: plain text with a thin underline. Icons: thin
hand-drawn line icons, 24px, rounded ends, NEVER emoji.

TEXT
Minimum possible text. Short Chinese labels only, no paragraphs. Garbled text
is fine — layout and hierarchy are what matter here.

THE CAT
Do NOT render a detailed cat. Where a cat appears, draw a simple flat orange
silhouette as a placeholder. The real artwork exists already and gets
composited in later.

NEVER include: a fake iOS status bar, a fake keyboard, emoji, stock photos,
purple or blue gradients, three identical feature cards, a centred hero with
two side-by-side buttons.
```

---

## 配色块 B · 院子里

```
COLOURS — use these exact values
page background      #DCE6D6
card / surface       #F4F2E6
divider / border     #C3D0BA
primary text         #26301F
secondary text       #6E7A63
accent / primary CTA #C25A3E
cat fur              #E3A05C

The interface takes its ground colour from the garden itself, so the UI reads
as an extension of the world rather than a shell wrapped around it.
```

## 配色块 D · 只有一点橙

```
COLOURS — use these exact values
page background      #EEECE6
card / surface       #F8F7F2
divider / border     #DEDBD2
primary text         #23221E
secondary text       #78766E
accent                #D98A3C
primary CTA fill     #23221E   (dark, not the accent)
cat fur              #E3A05C

The interface is almost colourless. The honey orange accent is used sparingly,
on small elements only. Illustration is the only strongly coloured thing in
the app.
```

---

## 屏块

### 屏 A · 陪伴主页

```
SCREEN: the home screen. The whole screen is the garden world, edge to edge.

Sky at the top, rolling green ground below, a mushroom house on the left in the
middle distance, a large tree on the right. Keep the world simple and flat —
this is a placeholder for real artwork.

A small flat orange cat silhouette sits low and centre, resting inside a basket.

INTERFACE ELEMENTS OVER THE WORLD:
- On the left edge, a vertical rail of SIX small round translucent buttons,
  evenly spaced, each holding a thin line icon. One of them is in an active
  state.
- Near the top centre, a single short pill-shaped hint label in a translucent
  fill.
- Lower left, one small piece of plain underlined text, deliberately faint.
- Lower right, a solid accent pill button with a small icon and short label.
- At the very bottom, a translucent tab bar with THREE items, each an icon
  above a tiny label. The first is active.

The interface must stay readable over the illustration without covering it, and
must not compete with the cat.
```

### 屏 B · 日记 · 今天

```
SCREEN: a diary page, page background, no world imagery.

Top: a small date label, then a large serif page title on its own line, with
two thin line icons aligned to its right.

Main area: a vertical timeline. Each entry is a row with a small timestamp in a
narrow left column and a card on the right.

Show FOUR entries, and make them visually DIFFERENT from one another:
1. a card with a thin hairline border, containing a small waveform icon with a
   tiny label, two lines of text, and a very small caption underneath
2. a card in a warmer tint with a slightly different border, indented further
   right than the others, with a small paw-print mark overlapping its left
   edge, two lines of text, and a small name caption
3. a card with a hairline border containing a flat rectangular image
   placeholder above one line of text
4. a card with a DASHED border and greyer text, with a tiny lock icon and short
   caption at the bottom

Bottom: an accent pill button aligned right, then a tab bar with three items,
the second one active.

The four card types must be tellable apart at a glance. That difference is the
point of this screen.
```

### 屏 C · 专注聊天

```
SCREEN: a chat screen.

Background: the garden world reduced to a soft blurred field of colour — no
recognisable house, tree or ground line, just large soft areas of the palette's
greens and a little sky blue. Everything else sits on top of it.

Top: a small collapsible source strip in a warm translucent card, containing a
tiny paw-print icon, two stacked short lines of text, and a small chevron on
the right.

Middle: FIVE chat bubbles.
- Cat bubbles are on the LEFT, in a light cream fill, with one square corner at
  the top left and three rounded corners. The first one has a small flat orange
  cat silhouette avatar beside it.
- User bubbles are on the RIGHT, in a muted green fill, with one square corner
  at the top right.
- The last cat bubble is a "typing" state: three small dots instead of text.

Bottom: a rounded input field with a small microphone icon on its right, and a
square accent send button beside it.

The two speakers must be instantly distinguishable by side, shape and fill.
```

### 屏 D · 我的

```
SCREEN: a profile page, page background.

Top third: a soft band of colour, with a large flat orange cat silhouette
centred in it, a short serif name below the silhouette, and one line of small
secondary text under the name.

Below, three sections separated by generous space. Each section has a small
serif section heading.

Section 1: a row of four small pill-shaped tags, then one line of secondary
text.
Section 2: a single grouped card containing THREE rows separated by hairline
dividers that are inset from the left. Each row has a small line icon, a label,
a right-aligned number, and a small chevron.
Section 3: a single card row with a label on the left and a toggle switch on
the right, shown in the on position.

Bottom: a tab bar with three items, the third one active.

This page must NOT read like a generic settings screen. The cat comes first,
memory and boundaries come before preferences.
```

---

## 八张回来后怎么挑

**不要看细节，只看四件事：**

1. **哪一套的层级更清楚**——标题、正文、次要文字三档，一眼分得开吗
2. **哪一套在陪伴主页上更好**——界面压在插画上，是不是既看得清又不抢猫
3. **哪一套在日记上更好**——四种卡片的差别够不够，长文读着累不累
4. **哪一套更像这个产品**——如果两套都能用，选那个截图发出去一眼认得出的

**B 的赌注**是界面和世界连成一体；**D 的赌注**是极度克制，让插画独自承担色彩。两套都成立时，问自己一句：**我希望用户记住的是这个世界，还是这只猫？**

文字乱码、图标画歪、猫的剪影难看，全部忽略。这一轮只定方向。
