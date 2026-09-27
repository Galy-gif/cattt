# 团子分件与合成目标图 · 出图委托单 · 2026-09-11

给出图模型（Codex / ChatGPT 内置 imagegen）。**一次交付 17 张，每张单独生成。**
为什么要这些图、图回来怎么验收和接入，见 `docs/工作约定.md` 的「出图委托」与「收图验收」（原方案 2026-09-27 从当前版本删除，原件在 git 历史）。这份委托单只写出图要做的事。

---

## 一、六条硬规矩（先读）

1. **一个编号 = 单独生成的一张完整图。** 不拼网格、不出多格、不在一张图里放两个编号的内容。
2. **文件名必须是 `编号__r轮次.png`**，例如 `P04-torso__r1.png`。编号一个字不能改，轮次从 r1 起。
3. **失败必须上报，禁止拿旧图顶替。** 没做成、放弃、或者想沿用任何以前的图，一律在 `delivery.json` 里写 `status`，不许把旧文件复制进来当新结果。验收第一步是逐张算 SHA-256，和历史所有素材比对。
4. 同一编号可以自己多试几次，**只交一张你认为最好的**，其余放 `_rejected/`。
5. **严格照参考图画这只猫。** 不重新设计，不加奶白胸口和肚皮，不写实，不做 3D 毛绒玩具质感，不做矢量平涂。
6. 不画文字、水印、签名、边框、网格线、棋盘格。

---

## 二、参考图

全部在 `assets/tuanzi/rig-v1/refs/`。

| 编号 | 文件 | 用途 | SHA-256 前 12 位 |
|---|---|---|---|
| R1 | `R1-cat-identity.png` | 猫的身份与毛毡材质，唯一角色基准 | `d4fc0cdfc852` |
| R2 | `R2-cat-walk-side.png` | 侧面角度、头身比例（六帧走路，参考第 1 帧） | `15b8c2e8b8f3` |
| R3 | `R3-scene-nest.png` | 树窝场景，1536×1024，T01–T04 在它上面加猫 | `37516a53d2cf` |
| R4 | `R4-scene-fence.png` | 栅栏场景，1536×1024，T05–T06 在它上面加猫 | `e4af776c12b3` |
| P00 | 本批第一张产出 | P01–P09 的比例和角度基准 | 生成后填 |

---

## 三、执行顺序

1. **先出 P00。** P01–P09 每一张都必须把 P00 作为参考图传入，再加 R1。
2. T01–T06：参考 R1、R2，加上对应场景 R3 或 R4。
3. F01：不需要参考图。

T 和 F 与 P 互不依赖，顺序可以交换；P00 必须在 P01–P09 之前。

---

## 四、背景与画布

| 类型 | 画布 | 背景 |
|---|---|---|
| P（零件） | 按每张要求，1536×1024 或 1024×1024 | **真透明 PNG**。做不到就用纯色 `#FF00FF` 平涂底，全图一个颜色，无渐变、无阴影、无棋盘格 |
| T（合成目标图） | **1536×1024，和 R3 / R4 取景完全一致** | 完整场景，不透明 |
| F（质感） | 1024×1024 | 铺满，不透明 |

---

## 五、通用提示词前缀

P 系列每张开头都贴 `CAT_LOCK`；T 系列贴 `CAT_LOCK` + `SCENE_LOCK`。

**CAT_LOCK**

```
Reference image R1 is the approved cat "Tuanzi": an orange tabby in soft felt-over-crayon illustration.
Keep EXACTLY: big round slightly irregular head; small triangular ears with pink inner ear; small dark-brown
bead eyes with no highlight; tiny warm-brown mouth; three darker orange forehead stripes; broad soft body
stripes; ringed tail; thick round body with low center of gravity; short legs; small round paws with 2-3 toe
lines; short soft felt fibers on the surface; fuzzy fiber edge along the outline; warm dark-brown
variable-width outline. Uniform orange chest and belly, NO cream or white chest or belly.
NOT realistic, NOT a 3D plush toy, NOT flat vector. Even soft light from the upper left. No text.
```

**SCENE_LOCK**（T 系列，`<R>` 换成 R3 或 R4）

```
Edit reference image <R>. Keep the whole scene EXACTLY: same framing, same objects, same positions,
same felt materials and colors. Only add the cat. Output canvas exactly 1536x1024.
Draw the cat Tuanzi (identity from R1, side-view drawing from R2) at the correct size for this scene.
Integrate the cat into the scene: it receives the scene's light from the upper left, it has a soft dark
contact shadow exactly where it touches a surface, and any part of the cat that is behind an object is
correctly hidden by that object.
```

---

## 六、逐张要求

### P00-rest-pose · 站立基准全身

- 画布 1536×1024，透明底。参考 R1、R2。
- 自检：只有一只猫；四条腿都看得见且彼此分开；朝右。

```
[CAT_LOCK]
Using R1 for identity and material and R2 frame 1 for the side-view angle and proportions: ONE cat only,
full body, side view facing RIGHT (profile with the face turned very slightly toward the viewer, one eye
visible), standing still with all four paws flat on an invisible ground line. Legs straight and slightly
apart so all four legs are visible and clearly separated: near legs in front, far legs partly visible
behind. Head level, looking right. Tail raised behind in a gentle S curve.
Cat centered, total height about 55% of the canvas height, paws at about y=800. Transparent background,
no ground, no shadow.
```

### P01-head · 头

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：**没有眼睛、没有耳朵**；有嘴、有三道额纹；脖子处有一截无描边的圆帽。

```
[CAT_LOCK]
Draw ONLY the HEAD of the cat in reference P00, same angle as P00. Remove the eyes completely: leave smooth
orange fur where the eyes were (eyes are added later in animation). Remove both ears: the top of the head is
a smooth rounded fur line where the ears were. Keep the tiny mouth, the three forehead stripes and the cheek
fur tufts. At the neck (bottom left of the head), extend the fur downward as a plain rounded orange
"overlap cap" about 25% of the head height, with NO outline along that cap edge; it will be hidden under
the body. Head centered, head width about 50% of the canvas. Transparent background.
```

### P02-ear-near · 近侧耳朵

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：有粉色内耳；耳根一截无描边。

```
[CAT_LOCK]
Draw ONLY the near ear (the ear closer to the viewer) of the cat in P00, upright, with the pink inner ear
and fuzzy felt edge, outlined on its outer edges. At the base, extend it with a plain rounded orange cap
about 30% of the ear height with NO outline; it will be hidden under the head. Ear centered, ear height
about 45% of the canvas. Transparent background.
```

### P03-ear-far · 远侧耳朵

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：几乎看不到粉色；耳根一截无描边。

```
[CAT_LOCK]
Draw ONLY the far ear of the cat in P00, the ear farther from the viewer, seen mostly from behind: orange
fur only, at most a thin sliver of pink. Upright, outlined on its outer edges. At the base, extend it with a
plain rounded orange cap about 30% of the ear height with NO outline. Ear centered, ear height about 45% of
the canvas. Transparent background.
```

### P04-torso · 身体

- 画布 1536×1024，透明底。参考 P00、R1。
- 自检：没有头、没有腿、没有尾巴；有身纹。

```
[CAT_LOCK]
Draw ONLY the BODY of the cat in P00, from neck to hips, side view facing right like P00. NO head, NO legs,
NO tail. Keep the body stripes and the round belly. Where the head, the legs and the tail attach, simply close
the body with a smooth rounded fur contour; those spots will be covered by the other parts.
Body centered, body length about 60% of the canvas width. Transparent background.
```

### P05-foreleg-upper · 前腿上段

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：竖直；上端无描边、下端有描边。

```
[CAT_LOCK]
Draw ONLY the near front leg, UPPER segment (shoulder to elbow), of the cat in P00, perfectly straight and
vertical. Top end (shoulder): a plain rounded cap with NO outline; it will be hidden under the body. Bottom
end (elbow): round and fully outlined. Same thickness as the front leg in P00. Centered, length about 40% of
the canvas height. Transparent background.
```

### P06-foreleg-lower · 前腿下段带爪

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：竖直；上端无描边；爪子朝右、有趾线。

```
[CAT_LOCK]
Draw ONLY the near front leg, LOWER segment with the paw (elbow to paw), of the cat in P00, perfectly
straight and vertical. Top end (elbow): a plain rounded cap with NO outline. Bottom: the small round paw
seen from the side, pointing right, with 2-3 toe lines, outlined. Same thickness as in P00. Centered, length
about 40% of the canvas height. Transparent background.
```

### P07-hindleg-thigh · 后腿大腿

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：竖直的饱满水滴形；上端无描边。

```
[CAT_LOCK]
Draw ONLY the near hind THIGH (hip to knee) of the cat in P00: a plump rounded teardrop shape like the
haunch in P00, standing vertical. Top end (hip): a plain rounded cap with NO outline. Bottom (knee): round
and outlined. Centered, length about 45% of the canvas height. Transparent background.
```

### P08-hindleg-lower · 后腿下段带脚

- 画布 1024×1024，透明底。参考 P00、R1。
- 自检：竖直；上端无描边；脚朝右。

```
[CAT_LOCK]
Draw ONLY the near hind leg, LOWER segment with the foot (knee to foot), of the cat in P00, straight and
vertical. Top end (knee): a plain rounded cap with NO outline. Bottom: the foot seen from the side, pointing
right, with 2-3 toe lines, outlined. Same thickness as in P00. Centered, length about 40% of the canvas
height. Transparent background.
```

### P09-tail · 尾巴（拉直）

- 画布 1536×1024，透明底。参考 P00、R1。
- 自检：**完全拉直、水平**；左端无描边；环纹和 P00 一致。

```
[CAT_LOCK]
Draw ONLY the TAIL of the cat in P00, but perfectly STRAIGHT and horizontal (the animation will bend it).
Base at the LEFT: a plain rounded cap with NO outline. Tip at the right: rounded and outlined. Same thickness
and the same ring stripes as the tail in P00, same length as P00's tail would be if straightened.
Centered, tail length about 70% of the canvas width. Transparent background.
```

### T01-nest-crouch · 树窝：起跳前蓄力

- 画布 1536×1024。参考 R3、R1、R2。
- 猫在这张图上的尺寸：**头宽约 143px，站高约 271px**。
- 自检：猫朝左；四脚在石板路上；场景没被改动。

```
[CAT_LOCK]
[SCENE_LOCK with R3]
The cat stands on the stone path at the foot of the tree, paws at about x=810, y=940, facing LEFT toward
the hanging woven basket. It is in a deep loaded crouch, ready to jump, looking up at the lower lip of the
basket opening (around x=710, y=600). Its whole body is in front of the tree roots.
Cat size on this canvas: head width about 143 px, standing height about 271 px.
```

### T02-nest-air · 树窝：腾空

- 画布 1536×1024。参考 R3、R1、R2。尺寸同 T01。
- 自检：猫在空中；地上还有一块更小更淡的影子。

```
[CAT_LOCK]
[SCENE_LOCK with R3]
The cat is in mid-jump between the stone path (about x=810, y=940) and the lower lip of the basket opening
(about x=710, y=600), facing LEFT, body stretched diagonally up and to the left, front paws reaching forward
toward the lip, hind legs extended behind after pushing off. Its shadow stays on the ground below it,
smaller and fainter than when standing.
Cat size on this canvas: head width about 143 px.
```

### T03-nest-grip · 树窝：前爪抓住窝沿

- 画布 1536×1024。参考 R3、R1、R2。尺寸同 T01。
- 自检：两只前爪压在窝沿**上面**；身体挂在窝外；窝被压得微微倾斜。

```
[CAT_LOCK]
[SCENE_LOCK with R3]
Both front paws of the cat are hooked over the lower lip of the basket opening at about x=710, y=600, the
paws resting ON TOP of the lip. The chest is pressed against the outside of the lip, the hind legs dangle and
push against the basket's outer wall. The cat faces LEFT and slightly into the opening. The basket tilts
very slightly from the cat's weight.
Cat size on this canvas: head width about 143 px.
```

### T04-nest-inside · 树窝：趴在窝里

- 画布 1536×1024。参考 R3、R1、R2。尺寸同 T01。
- 自检：只露出头和两只前爪搭在窝沿上；身体被窝沿挡住；猫比 T01 略暗略冷。

```
[CAT_LOCK]
[SCENE_LOCK with R3]
The cat lies INSIDE the basket. Only its head and both front paws rest on top of the lower lip (around
x=710, y=600), looking out calmly; the rest of its body is hidden behind the lower lip inside the basket, the
tail tip may hang over the lip. The inside of the basket is shaded, so the cat is a little darker and cooler
than it would be in open sunlight.
Cat size on this canvas: head width about 143 px.
```

### T05-rail-perch · 栅栏：趴在横档上

- 画布 1536×1024。参考 R4、R1、R2。
- 猫在这张图上的尺寸：**头宽约 202px，身长约 516px**。
- 自检：猫趴在右段上横档的顶面；尖桩挡住猫身体的重叠部分；横档顶面有接触影。

```
[CAT_LOCK]
[SCENE_LOCK with R4]
The cat lies relaxed on top of the upper horizontal wooden rail of the RIGHT fence section, belly resting on
the rail top near x=1211, y=445, facing RIGHT, head raised. The cat is longer than the gap between two
pickets: the pointed picket tops stand IN FRONT of the cat and hide the parts of its body they overlap.
One front paw and the tail tip hang down in front of the rail, between the pickets. Soft contact shadow on
the rail top under the belly.
Cat size on this canvas: head width about 202 px, body length about 516 px.
```

### T06-rail-reach · 栅栏：前爪搭上横档

- 画布 1536×1024。参考 R4、R1、R2。尺寸同 T05。
- 自检：后脚在草地上；前爪搭在上横档的下沿；叶丛和猫的前后关系合理。
- 如果你判断猫转成背对观众的四分之三角度更自然，可以这样画，但必须在 `delivery.json` 的 `notes` 里写明。

```
[CAT_LOCK]
[SCENE_LOCK with R4]
The cat stands on the grass in front of the RIGHT fence section, hind paws at about x=1185, y=923, and rears
up on its hind legs to hook both front paws onto the lower edge of the upper rail (around x=1211, y=545).
The cat faces RIGHT and slightly toward the fence. The leafy bush at the fence base is behind the cat's hind
legs. Soft contact shadow under the hind paws.
Cat size on this canvas: head width about 202 px.
```

### F01-felt-grain · 毛毡纤维纹理

- 画布 1024×1024，铺满。无参考图。
- 自检：中性灰、无颜色；均匀；无暗角；看不到任何物体或缝线。

```
A flat, evenly lit close-up texture of soft wool felt fibers, neutral light gray with no color, filling the
entire canvas edge to edge. Uniform fiber density everywhere. No objects, no stitches, no seams, no folds, no
shadows, no vignette, no text.
```

---

## 七、交付

目录结构（放在你的输出目录下，整个文件夹交回）：

```
rig-v1-delivery/
  delivery.json
  P00-rest-pose/P00-rest-pose__r1.png
  P01-head/P01-head__r1.png
  …（每个编号一个文件夹）
  F01-felt-grain/F01-felt-grain__r1.png
  _rejected/                 自己试过但没选的，可选
```

`delivery.json` 必填，每个编号一条，**没做成的也要有一条**：

```json
{
  "batch": "rig-v1",
  "items": [
    {
      "id": "P04-torso",
      "file": "P04-torso/P04-torso__r1.png",
      "round": 1,
      "status": "new",
      "sha256": "…",
      "refs": ["P00-rest-pose__r1.png", "R1-cat-identity.png"],
      "prompt": "实际使用的完整提示词",
      "background": "transparent",
      "notes": ""
    },
    {
      "id": "T06-rail-reach",
      "file": null,
      "round": 1,
      "status": "failed",
      "notes": "失败原因"
    }
  ]
}
```

- `status` 只能是 `new`（本次新生成）、`failed`（没做成）、`skipped`（没做）三种之一。**不存在"沿用旧图"这个选项。**
- `background` 写 `transparent`、`magenta` 或 `scene`。
- `prompt` 写实际发给模型的全文，不要写"同上"。
