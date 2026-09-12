# 院子氛围 v1 · 出图委托单 · 2026-09-12

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 12 张，每张单独生成。** 分两组：
A 组是四张**氛围目标图**（黄昏、傍晚、夜晚、雨天），只用来看方向和给代码取颜色参数，不进 App；
P/S 组是八张**独立物件**（水碗两张、夕阳、月亮、星星、雨云两朵、亮窗），进 App。
为什么这样出，见 `docs/specs/情绪-喝水-时段与雨天-方案-2026-09-12.md` 第 4 节。猫的帧在另一份委托单 `assets/tuanzi/frames-v6/brief.md`，不要混在一起做。

---

## 一、硬规矩

1. **一个编号 = 单独生成的一张图。** 不出网格、不拼贴。
2. **文件名必须是 `编号__r轮次.png`**，例如 `S1-sun__r1.png`。
3. **失败必须上报，禁止拿旧图顶替。** 在 `delivery.json` 里写明。验收第一步比哈希。
4. **一次只改一件事。** A 组只改光和天，构图、物件、猫都不动。
5. **图参考优先于文字。** 每张都传参考图；物件的材质必须和参考里现有的云、碗一致。
6. **物件只画物件。** P/S 组背景用纯色 `#FF00FF` 平涂，不画地面、阴影、文字、边框。禁止棋盘格。
7. **不画猫。** 物件组里一律没有猫；A 组保留截图里的猫，但不重画它、不改它的姿势和颜色。

---

## 二、参考图

全部在 `assets/scenes/atmosphere-v1/refs/`。

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| R-home | `R-home-screenshot.jpg` | 现在的首页（白天）。A 组的构图基准，图生图从它出 | `604594c5a39c` |
| R-cloud | `R-cloud-current.png` | 现有的云：奶白毛毡、边缘一圈缝线。所有"缝在天上的东西"照这个做法 | `1cc42346be20` |
| R-bowls | `R-bowls-current.png` | 门口现有的两只碗，蓝的那只是水碗，现在是空的 | `d5d331e103f2` |
| R-door | `R-house-door.png` | 蘑菇屋门口局部：圆窗、门、碗 | `0f7f23c70ff7` |

---

## 三、通用提示词前缀

**WORLD_LOCK**（每张都贴）

```
Reference R-home is the approved look of this world: a handmade felt and fabric diorama, soft wool felt
surfaces, visible stitching along edges, matte, no gloss, no plastic, gentle even light. Everything new must
look cut from felt and sewn on, exactly like the cloud in R-cloud. NOT 3D render, NOT photo, NOT vector,
NOT watercolor.
```

**PROP_LOCK**（P/S 组每张都贴）

```
A single object centered on a flat pure #FF00FF background, canvas exactly 1024x1024. Only the object: no
ground, no shadow, no text, no border, no checkerboard. The object fills about 70% of the canvas width.
Felt material with a stitched edge, same craft as R-cloud.
```

---

## 四、A 组：氛围目标图（不进 App）

四张都用 R-home 做图生图。**构图、镜头、房子、树、信箱、垫子、猫、左侧图标都保持原样**，只改天空、光线、影子和天上的东西。画布和 R-home 一样（竖屏）。界面元素（顶部状态句、右上头像、左侧图标、右下按钮）可以保留也可以去掉，不影响验收。

#### A1-dusk · 黄昏（太阳还在）

```
[WORLD_LOCK]
Same scene as R-home at sunset. The sky becomes a warm gradient: orange near the horizon rising to soft
pink and then dusty violet at the top. A large felt sun disc sits low, just above the distant hills on the
right. Long soft shadows stretch to the left. Everything is washed in warm light but the felt stays matte.
The cat keeps its exact pose and stays clearly visible against the ground.
```

#### A2-evening · 傍晚（太阳已落，窗户亮了）

```
[WORLD_LOCK]
Same scene as R-home just after sunset, blue hour. No sun. The sky is a deep dusty blue fading to a thin
band of faded peach at the horizon. The scene is dimmer and cooler; the round window of the mushroom house
glows warm yellow from inside and spills a little warm light on the ground in front of the door. The cat
keeps its exact pose and stays clearly visible.
```

#### A3-night · 夜晚

```
[WORLD_LOCK]
Same scene as R-home at night. Deep navy felt sky with a cream felt crescent moon and a few small felt
stars, each with stitched edges like the cloud. The whole scene is darker and blue-tinted but still readable:
the house, tree and cat remain clearly visible, not black. The round window glows warm yellow. The cat keeps
its exact pose and is clearly lighter than the ground around it.
```

#### A4-rain · 雨天（白天下雨）

```
[WORLD_LOCK]
Same scene as R-home on a rainy day. The sky is a soft grey felt; two darker grey felt rain clouds with
stitched edges hang above the house. Thin pale diagonal rain threads fall across the whole picture, like
fine embroidery thread. Colors are muted and slightly desaturated; the grass looks damp and a touch darker.
The cat keeps its exact pose, sitting dry under the mushroom cap. No lightning.
```

自检（模型交付前自己看一遍）：四张里猫的姿势、位置、颜色和 R-home 一致；房子和树没有被重画成别的样子。

---

## 五、P 组：水碗（两张，盖在现有贴图上）

两张必须是**同一只碗、同一个角度、同一个大小、同一个位置**，只差碗里有没有水。碗照 R-bowls 里的蓝碗画：青蓝色毛毡，碗身有菱形缝线纹，碗口一圈略深的边。碗在画布里的位置两张必须完全一样。

#### P1-bowl-empty · 空碗

```
[WORLD_LOCK] [PROP_LOCK]
The blue felt cat bowl from R-bowls, seen from the same slightly-above front angle, empty: the inside of the
bowl is visible and dry. Same teal-blue color, same diamond stitch pattern on the side, same rim.
```

#### P2-bowl-full · 满碗（把 P1 作为参考图传入）

```
[WORLD_LOCK] [PROP_LOCK]
Exactly the bowl of reference P1, same angle, same size, same position on the canvas, but now filled with
water almost to the rim: a calm pale-blue water surface with a soft felt texture and a faint lighter ring
near the edge. Nothing else changes.
```

---

## 六、S 组：天上的东西

#### S1-sun · 夕阳

```
[WORLD_LOCK] [PROP_LOCK]
A round felt sun disc, warm orange-gold, slightly irregular hand-cut circle, with a stitched edge and a
subtle lighter felt center. No rays, no face, no glow outside the disc.
```

#### S2-moon · 月牙

```
[WORLD_LOCK] [PROP_LOCK]
A cream felt crescent moon, hand-cut, gently rounded tips, stitched edge, same cream as the cloud in R-cloud.
No face, no glow.
```

#### S3-stars · 五颗星星

```
[WORLD_LOCK] [PROP_LOCK]
Five small cream felt stars scattered across the canvas, each a soft five-point star with rounded points and
a stitched edge, three sizes (large, medium, small), none touching each other, none touching the canvas edge.
```

#### S4-raincloud-a · 雨云 A

```
[WORLD_LOCK] [PROP_LOCK]
A rain cloud in the same construction as R-cloud (felt with a stitched outline and stitched inner lobes),
but wider and flatter, in a muted blue-grey felt with a slightly darker grey underside. No rain, no face.
```

#### S4-raincloud-b · 雨云 B（把 S4-raincloud-a 作为参考图传入）

```
[WORLD_LOCK] [PROP_LOCK]
A second rain cloud in exactly the same felt, color and stitching as reference S4-raincloud-a, but a
different shape: taller, with three lobes on top and a small lobe on the left. No rain, no face.
```

#### S5-window-lit · 亮着的圆窗补丁

这张要**盖在房子贴图的圆窗上**，所以形状、大小、木框十字必须和 R-door 里的窗一模一样。

```
[WORLD_LOCK]
Canvas exactly 1024x1024, flat pure #FF00FF background. Reproduce exactly the round window of the mushroom
house in R-door: the same cream felt round frame, the same wooden cross bars, the same size and angle,
centered on the canvas and filling about 80% of the canvas width. The only change: the four panes behind
the cross bars glow warm yellow felt, as if a lamp is on inside, slightly brighter at the center of each
pane. No light spill outside the window frame. No text, no shadow.
```

---

## 七、交付

```
atmosphere-v1-delivery/
  delivery.json
  A1-dusk/A1-dusk__r1.png
  …（每个编号一个文件夹）
  S5-window-lit/S5-window-lit__r1.png
  _rejected/                 可选
```

`delivery.json` 格式和 `outputs/frames-v5-delivery/delivery.json` 相同：每个编号一条，没做成的也要有一条；`status` 只能是 `new`、`failed`、`skipped`；`prompt` 写实际发出的全文；参考图写实际传入的文件名。
