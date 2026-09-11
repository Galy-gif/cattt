# 风格探针 · iOS 界面层

方向变更：**世界保持手绘，界面改为 iOS 原生语言。**

理由：这张主页证明了插画够强的时候，界面自己再讲味道就是抢戏。iOS 系统语言的价值恰恰是它**不表达**——毛玻璃、标准 tab bar、系统字重，全部退到插画后面，让世界成为唯一的声音。

配色仍用方向 B 的绿系作为 tint，但界面表面改为系统材质而非实心奶油药丸。

---

## 通用块 · iOS 界面层

```
Design a mobile app UI screen for iOS. Output ONE image at 390 x 844 (iPhone
logical size). No device frame, no grid, one screen only.

THE APP
A companion cat app. The user has one cat living in a hand-painted garden. No
tasks, no check-ins, no levels, no coins. Quiet and unhurried.

INTERFACE LANGUAGE — this is the point of this pass
The interface must look NATIVE iOS, not like a custom themed skin. Specifically:

MATERIALS: interface surfaces are SYSTEM BLUR MATERIALS over the illustration,
not opaque cream pills. Think iOS .regularMaterial and .thinMaterial: the
artwork behind them stays faintly visible and colour-shifted through the blur.
Text and icons on those surfaces use vibrancy, so they take a tint from what is
behind them rather than sitting as flat solid ink.

TYPOGRAPHY: SF Pro / PingFang SC. System sizes — 17pt body, 15pt secondary,
11pt tab labels, 34pt large title where a title exists. System weights only:
regular and semibold. No decorative serif anywhere in the interface layer.

CONTROLS: capsule buttons with a material fill, or a prominent tinted button
for the single primary action. 1px hairline separators. NO drop shadows, NO
custom wooden or paper textures, NO hand-drawn borders, NO gradients. Corner
radii follow iOS: continuous rounded corners, capsules for pills.

TAB BAR: a standard iOS tab bar pinned to the bottom — blurred material, a
hairline separator along its top edge, three items, each a line icon above an
11pt label, the active item tinted, the inactive ones in secondary grey.

SPACING: 16pt horizontal margins. Respect the safe areas: leave the top ~8% and
the bottom ~12% free of content other than the tab bar itself.

TINT COLOUR: a deep garden green for active states and the primary action.
Cat fur, where it appears, is honey orange #E3A05C.

NEVER: a fake iOS status bar, a fake keyboard, emoji, gradients, heavy shadows,
three identical cards, Material Design shapes, Android-style floating action
buttons.

THE CAT AND THE WORLD
The garden illustration is hand-painted storybook art: a mushroom house, a big
tree with a hanging woven nest, a fence, a pond, dense clover and wild flowers.
Keep it warm and detailed. The cat is a small orange tabby, about 8% of the
screen height, always resting in or against something.
```

---

## 屏 A · 陪伴主页（先做这张）

```
SCREEN: the home screen. The hand-painted garden fills the entire screen, edge
to edge, behind everything.

INTERFACE OVER IT:

Top centre: a single capsule in blurred material with one short line of text
inside, vibrancy styled. Nothing else at the top.

Left edge, vertically centred: a rail of SIX small circular buttons in blurred
material, evenly spaced, each holding one thin line icon. The icons are all
PLACES in the garden and must be six visibly DIFFERENT pictographs — a mushroom
house, a tree, a cat bed, a tuft of grass, a pond, a fence. There is NO settings
gear in this rail; it is a location rail only. The ACTIVE one differs from the
other five only by tint and a slightly stronger material — it is the same shape
and size as the rest, not a solid filled badge.

Bottom left, above the tab bar: one short piece of plain text in vibrancy grey,
deliberately quiet, no capsule around it. It must read as clearly WEAKER than
the button on the right.

Bottom right, above the tab bar: one capsule button, the single primary action,
in a prominent tinted fill with a short label.

Bottom: a standard iOS tab bar, blurred material with a hairline top separator,
three items with line icons above 11pt labels, the first active and tinted.

The interface must stay legible over the painting while covering as little of
it as possible. The cat must remain the most eye-catching thing on screen.
```

## 屏 B · 日记 · 今天

```
SCREEN: a diary list, iOS style. No world imagery — a plain grouped-list
background in a very light warm grey.

Top: an iOS large title, with a small date line above it in secondary grey, and
two thin line icons aligned right on the title's baseline.

Main area: a vertical timeline. Each entry has a small timestamp in a narrow
left column and a content card on the right, in the style of iOS inset grouped
list cells: white-ish fill, continuous corner radius, hairline separators, no
shadow.

FOUR entries that must be tellable apart at a glance:
1. a plain cell with a small waveform icon, a tiny label, two lines of text and
   a small caption
2. a cell with a warm tinted fill, indented further right, with a small
   paw-print glyph overlapping its leading edge, and a small name caption
3. a cell containing a flat image placeholder above one line of text
4. a cell with a subdued fill and greyer text, with a small lock glyph and a
   short caption

Bottom right, above the tab bar: a prominent tinted capsule button.
Bottom: the standard tab bar, second item active.
```

## 屏 C · 专注聊天

```
SCREEN: a chat view, iOS style.

Background: the garden reduced to a soft blurred colour field — no recognisable
house, tree or horizon, just large soft areas of green with a little sky blue.

Top: a collapsible source strip in blurred material, containing a small
paw-print glyph, two short stacked lines and a chevron on the trailing side.

Middle: FIVE message bubbles, iOS Messages proportions.
- Cat bubbles on the LEADING side, in a light material fill, with the tail
  corner squared off. A small flat orange cat silhouette avatar sits beside the
  first one.
- User bubbles on the TRAILING side, in the tinted green fill with white text.
- The last cat bubble is a typing indicator: three dots.

Bottom: an iOS input bar — a rounded field in material with a microphone glyph
on its trailing side, and a circular tinted send button beside it. No tab bar
on this screen.
```

## 屏 D · 我的

```
SCREEN: a profile page, iOS inset grouped list style, light warm grey
background.

Top: a soft band of garden colour with a large flat orange cat silhouette
centred, a name in semibold below it, and one line of secondary text under the
name. No serif.

Below: THREE inset grouped sections, each with a small uppercase-ish section
header in secondary grey above it.

Section 1: a row of four small capsule tags, then one line of secondary text.
Section 2: one grouped card with THREE rows, hairline separators inset from the
leading edge. Each row: a small line icon, a label, a right-aligned value in
secondary grey, and a chevron.
Section 3: one grouped card with a single row — a label on the leading side and
an iOS toggle switch on the trailing side, switched on, in the green tint.

Bottom: the standard tab bar, third item active.

This must NOT read as a generic settings screen. The cat comes first; memory
and boundaries come before preferences.
```

---

## 这一版明确修掉的四个问题

上一张主页里出现的，写进提示词了：

1. **左侧轨里混进了设置齿轮**——地点轨只放地点，设置在「我的」里
2. **六个图标有两个是重复的植物**——必须是六个明显不同的象形：蘑菇屋、树、猫窝、草丛、池塘、栅栏
3. **选中态是实心深绿圆钮，和其他五个不是一套**——改为同形同尺寸，只靠 tint 和材质浓度区分
4. **「找团子」和「聊会儿」都是药丸，权重一样**——找团子改为无容器的弱文字，聊会儿是唯一的主操作

## 怎么挑

只看一件事：**界面有没有退到插画后面。**

如果你的眼睛先看到猫和院子，界面是过一秒才注意到的，就对了。如果先看到一排按钮，就是没退开。

其余的（图标画歪、文字位置微妙）这轮全部忽略。
