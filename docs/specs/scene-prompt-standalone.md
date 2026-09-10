# 猫猫 App · 陪伴主页场景 · 独立提示词

自包含，不需要任何上下文。直接整段贴给出图模型。

---

```
Paint ONE complete illustration. Do not assemble it from separate cut-out
objects. It must read as a single scene drawn by one hand.

WHAT IT IS
The home screen of a gentle companion app. A small orange cat lives in a
fenced garden. This is the cat's whole world. The picture should feel like
somewhere quiet you would want to sit down in, not a display of things.

FORMAT
Mobile portrait, 853 x 1844. Leave the top 8% and bottom 12% visually quiet
for interface elements. No text, no UI, no numbers anywhere.

STYLE
Hand-drawn 2D children's-book illustration. Coloured pencil and crayon grain
inside the colour areas, denser at the centre of a shape and looser toward its
edges. Flat colour underneath. No smooth gradients, no airbrush, no glow, no
drop shadows, no 3D rendering, no uniform paper texture laid over everything.

LINE
Every contour drawn by hand, in dark warm brown #6B5B4A, NEVER pure black.
Line weight varies within a single stroke: heavier along undersides and where
forms overlap, tapering to almost nothing on top edges. No perfect circles, no
perfect ellipses, no mirrored shapes. If anything looks like it was made with
a compass or a vector tool, redraw it by hand.

PALETTE — use these values, do not invent intermediate tones
sky #CFE3EA      far hills #C3D5C2   mid hills #AAC5A8   treeline #8FAF8E
ground far #C6D9C4   ground mid #B0C8AD   ground near #9BB899
pond #9FC0C2     wood #B39C86        line and darks #6B5B4A
the cat #E3A05C with a darker tone #C9823F and a vanilla cream chest
accent coral #D8705C on the mushroom roof only, at full strength, on less
than 3% of the image area.
The greens are SAGE, not olive and not khaki. If the ground looks yellowish it
is wrong. The image must contain real darks: the tree trunk, the doorway, the
window recess and the deep side of the pond all go to #6B5B4A or darker.
Ground gets progressively darker toward the viewer, never lighter.

WHAT IS IN THE GARDEN
A low wooden picket fence runs along the back and turns forward at both ends,
enclosing the garden. A mushroom house sits left of centre, its roof coral, its
wall cream. A large tree stands on the right, its canopy reaching into the
upper third, with a teardrop woven nest hanging from a LOW branch that a cat
could climb into. A pond lies in the lower left, in the lowest part of the
ground, with fish visible in the water. A narrow stone path runs from the fence
gate past the house door.

THE MOST IMPORTANT RULE — placed things versus growing things

GROWING THINGS cover the ground freely. Grass tufts, clover, dandelions, wild
flowers, small mushrooms, ferns at the pond edge, moss on stones. They appear
all over the lawn, including the foreground, with no ordering and NO CONTACT
SHADOWS, because they grew there. They are what makes the ground feel alive.
The lawn must read as a lawn, not as a surface with objects sitting on it.

PLACED THINGS are few, and every one must be something the CAT can use:
somewhere to sleep, hide, climb, scratch, eat, drink or play.
  - two small bowls, food and water, right against the house door
  - a round cat bed and a cushion under the tree
  - a cardboard box the cat can get into
  - a tree stump and a fallen log the cat can jump onto
  - a scratching post against the tree
  - a ball of yarn
  - two flat stones at the pond edge the cat can stand on
That is all. Around ten placed objects, no more. Each one sits on the ground
with a soft contact shadow, because someone put it there.

NEVER scatter household objects across the grass. No books, no teacups, no
tables, no stools, no brooms, no watering cans, no crates, no buckets, no
paper bags, no sign posts, no firewood on the lawn. Those belong INDOORS:
through the open door and the round window of the mushroom house you can see
a little of the inside, a fireplace, the corner of a sofa, a shelf. That is
where a household lives. On the grass they read as litter.

THE CAT
One small orange tabby, only about 7% of the image height. It is asleep,
curled inside a woven basket under the tree. It must be touching or inside an
object, never standing alone in the middle of the lawn. Simplified at this
size: two dark eye dots, no whiskers, no stripes on the face. Its identity
comes from the silhouette, the ear angle and the long ringed tail.
The cat is the only strongly saturated warm thing in the picture, so it should
be findable at a glance without any outline or glow.

SCALE — measure everything against the cat
mushroom house 3.1x the cat, tree with canopy 9x, cat bed 1.2x, stump 1.3x,
bowls 0.5x, mushrooms and leaves 0.2x.

DENSITY
Richness comes from the structure of the place, the tree, the house, the fence,
the pond, and from the growing plants. It does NOT come from scattering objects.
Large parts of the lawn are simply grass and flowers, and that is correct.

NEVER include: any text, numbers, counters, progress bars or badges; yellowed
or aged paper, stains, speckle noise; thick glass, heavy shadows, plastic or
clay look; a generic anime cat face; any human figure.
```

---

## 用法

1. 整段贴过去，一次出 3 到 4 版。
2. 不满意时**只改一个变量**再出，不要一次改多条。
3. 满意的那版存为 canonical，之后任何变体都以它作 reference image，不要纯文字复现。

## 这版提示词解决的是什么

前几轮失败的根因不是配色也不是笔触，是**摆放没有逻辑**：物件按空间算法撒在草地上，每一件都没有存在的理由，所以怎么调都像货摊。

这版把规则收敛成两条：

- **长的和摆的是两套语法。**草、花、蘑菇是长出来的，可以铺满、没有影子、没有规律；猫窝、碗、箱子是摆的，必须少、有影子、有理由。
- **一个物件如果猫不能用它做点什么，就不该在草地上。**人类物品全部进屋，透过门窗露出来，在屋里是生活痕迹，在草地上是垃圾。
