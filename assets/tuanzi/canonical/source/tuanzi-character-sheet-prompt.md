# 团子三视图 · 本轮实际出图提示词

生成方式：Codex 内置 imagegen。

本轮策略：将原文「0. 通用风格块」与「1. 界面层 · 大团子角色设定页」合并、结构化后，使用完全相同的约束独立生成 4 次。采用无眼神光基线；未加入 1b 的高光点。

```text
Use case: illustration-story
Asset type: mobile companion app character-design direction sheet; finished concept artwork, not a sketch, diagram, UI, or production layered asset.

Scene/backdrop: warm cream #EFE6D2 background, clean and quiet.
Subject: Character sheet of Tuanzi, an orange tabby cat. Exactly three full-body views in one horizontal row: front view, right side profile, back view. The same character and proportions in all three views.

STYLE — applies to the whole image.
Hand-drawn 2D children's-book illustration for a mobile app. Warm, quiet, unhurried. Finished artwork, not a sketch and not a diagram.

LINE
Every contour is drawn by hand. Line weight varies within a single stroke: heavier along the underside and where two forms overlap, tapering to almost nothing along top edges. Slight ink pooling where a stroke changes direction or ends. Line colour dark warm brown #6B5B4A, never pure black. Strokes may overshoot slightly at corners; contours need not close perfectly.

FORM — the single most important rule
No perfect circles. No perfect ellipses. No mathematically symmetrical or mirrored shapes anywhere. The head is an irregular rounded mass, a little wider on one side, softly flattened where the cheek sits. The two eyes are not identical; one sits slightly differently. If any shape looks compass-drawn or made with a vector shape tool, redraw it by hand.

SURFACE
Crayon and dry-brush grain inside colour areas: dense at the centre, loosening and becoming patchy toward edges. Warm cream paper tooth faintly visible through colour. Flat colour underneath. No smooth gradients, airbrush, glow, drop shadows, bevels, or cel-shading rim light.

PALETTE — use only these colours
sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2, wood brown #B39C86, line brown #6B5B4A, accent coral #D8705C on less than 3% of image area; cat honey orange #E3A05C, darker orange #C9823F, vanilla cream chest.

PROPORTION — follow exactly
Head-to-body ratio 1:1.3. Head nearly as large as whole body. Each eye is 30% of face width. Eye centres sit 10% below the horizontal face midline. Gap between eyes is about one eye width; wide-set. Front paws are two separate rounded shapes, clearly detached from the body silhouette, turning slightly inward.

CUTENESS THROUGH ASYMMETRY
Head tilted about 6 degrees, not upright. Ears at slightly different angles, not mirrored. Cheeks push beyond the widest point of skull, bulging at cheek line. Body slightly squashed and subtly leaning, not symmetrically upright.

FUR
Soft fur tufts break the outline at cheeks, chest, and haunches: short tapering strokes leaving the silhouette, never a clean geometric edge. Vanilla-cream chest ruff made from loose tufted strokes, flowing continuously from under chin to belly; not an oval patch, bib, or separate blob. A few thin interior fur strokes on flank and haunch. Mouth line noticeably thicker than fur strokes.

FACE AND MARKINGS
Pale yellow almond-shaped eye sockets. Inside each, a dark pupil that is not circular: bean-shaped, tilted, and slightly different in each eye. Exactly one short outward flick above the outer top edge of each open pupil: one stroke, one point per eye; never forked or fanned. No eye catchlights. Pink inner ears, soft irregular dry-brush cheek blush, cream belly. Small low-set mouth with corners gently down: mildly serious by nature, neither sad nor angry. Long straight dark-brown whiskers. Exactly three short forehead stripes, back stripes, ring markings on a long S-curved tail.

Constraints: make all three views clearly legible with generous spacing and consistent identity. No additional poses or props.
Avoid: yellowed or aged paper, stains, blotches, speckle noise, dirt texture, thick glass, gradients, heavy shadows, 3D rendering, plastic or clay appearance, any text, numbers, counters, progress bars, badges, UI chrome, generic anime cat face, uniform W-shaped or omega-shaped animation mouth, perfect geometry, mirrored symmetry, eye catchlights, watermark.

Variant N of 4: create an independent visual interpretation while obeying every constraint. Do not label the variant in the image.
```

## 已选 v4 后的锁定补图

参考图：`tuanzi-character-sheet-v4.png`，角色与画风参考，不是直接覆盖的编辑目标。

锁定要求：v4 是已确认设计；保留厚圆身体、宽胯、大而不规则的圆头、全轮廓短软毛束、半眯偏侧视线、淡黄杏仁形眼眶、非对称豆形瞳孔、低位下垂小嘴、橙色颊红、三道额纹、宽软身纹、环尾纹，以及从下巴连续延伸到腹部的奶油绒毛。性格必须读作略疏离、漫不经心、有自持感；不是悲伤、愤怒或睁圆眼卖萌。永久禁止眼神光。

三视图版布局：正面坐姿／严格 90° 右侧面／正背面，三只同尺寸、同基线。侧视图的头与口鼻必须严格朝侧面，不得转向镜头，只显示可见侧五官，整条尾巴可见。暖奶油底，无文字、道具与地面阴影。

绿底验证版布局：单只正面坐姿居中，保持 v4 的半眯偏侧视线，背景仅使用平涂鼠尾草绿 `#C6D9C4`，无场景、道具、文字、阴影、光晕或渐变。首次生成出现中心亮晕，因此又以“只改背景、猫完全不变”为单变量做了一次 imagegen 修正。

## 表情一致性测试 v1

唯一参考图：`团子-canonical-v1.png`。禁止引用三视图、绿底图或任何其他衍生图作为身份来源。

画面为暖奶油底的六格全身坐姿，两行三列：默认、满足、困倦、好奇、惊讶、亲昵。六格必须保持 canonical 的厚圆身体、宽胯、不规则大头、耳朵大小与非对称角度、三道额纹、宽软身纹、环尾、连续奶油胸毛、毛束轮廓、色彩、线宽和蜡笔彩铅颗粒。

默认保持半眯偏侧视线；好奇与惊讶完整露出淡黄杏仁形眼眶；其余状态通过眼眶压缩、眼睑、耳角、胡须和嘴形共同变化。所有状态永久无眼神光，不使用圆形瞳孔、通用萌猫脸或 W／ω 嘴。即使开心和亲昵也保持克制、有距离感、不黏人。

生成结果状态：一致性测试未完全通过。六格身份大体稳定，但好奇格未双眼完整睁开、惊讶格瞳孔过圆、满足格嘴形偏通用萌猫。本图不升级为 canonical。
