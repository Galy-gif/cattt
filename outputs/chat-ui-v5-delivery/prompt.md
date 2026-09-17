# C5 实际提示词

内置imagegen编辑C4r2，传当前团子R1参照；一张静态改稿，未改聊天页代码。

```text
Use case: precise UI image edit.
Edit Image 1, the white-grey Chinese Tuanzi chat screen. Image 2 is the locked existing TUANZI character reference, used only to maintain his identity, not its beige backdrop. Create ONE complete opaque full-screen iOS portrait screenshot, same aspect and overall arrangement, no phone frame, grid, captions or watermark. RGB PNG or RGBA with EVERY alpha255, no actual transparent canvas or missing background. Glass is a visual material INSIDE an opaque screenshot.

Make EXACTLY these requested visual adjustments:

1. SMALLER TUANZI AVATARS.
Uniformly scale down the ENTIRE round window plus Tuanzi head and two paws to about TWO THIRDS (0.66) of the current diameter, approximately36pt at390pt reference screen width. Preserve the exact current character head, tiny bead eyes, three forehead stripes, pink ears, all-orange chin and paws, soft warm-brown outline and colored-pencil/felt texture from the reference. Do not shrink only the head inside an unchanged huge circle. The whole avatar is smaller, quietly centered in its existing left avatar slot, retaining good proximity to the corresponding bubble. Do not move or resize the messages. Still a close HEAD view with attached orange paws resting on/over the lower circular windowsill, never a tiny full-body orange lump. Same three subtle calm / closed-eye / slight-tilt poses. Thin quiet round-window rim is allowed because the user requested a window, but no halo. No photo cat, generic kitten, line icon or big black eyes. Do not independently stretch or squash head or paws.

2. ABSOLUTELY BORDERLESS CHAT BUBBLES.
Remove EVERY outline stroke around ALL five chat bubbles. NO grey contour, NO white contour, NO hairline border, NO highlighted rim, NO dark edge, NO bright edge. Remove the existing drawn rounded rectangle lines entirely rather than changing their color. Keep the continuous rounded SHAPE expressed by a very light translucent surface and very subtle tonal separation only. Cat bubbles have lightly clear-white interiors; user bubbles lightly smoky pearl-grey interiors, all like thin quiet clear glass. A tiny soft diffused grey shadow is acceptable, no visible perimeter line. The glass DOES NOT GLOW: no bright rims, inner edge highlighter, bloom, corner shine, flares or halos. Dark Chinese text stays crisp and readable. Avoid opaque thick white cards and heavy shadows.
Also make the composer a BORDERLESS lightly translucent rounded surface in the same calm material; remove its drawn grey contour while retaining all input elements and the integrated send button. Do not remove the avatar circular window itself.
This is the main correction: the new screenshot must have NO DRAWN OUTLINES around message rectangles or the input rectangle.

3. MORE COLOR IN THE MUSHROOM HOME, NO GREY SCENE LINES.
Keep the existing mushroom house glimpse in the same lower-right location, size and cropped silhouette. Change its old grey outlines to DELICATE MUTED COLORED outlines. The mushroom-cap contour can be soft pale terracotta/coral; house-wall/door contours pale warm honey/ochre; existing little leaves subtle soft sage green. Add a little extremely pale peach to the cap, warm creamy offwhite to the wall and a small warm honey window. This is a quiet translucent colored architectural sketch, with enough color to recognize a cozy home. No grey line around the cap/house/door/ground/leaves. The lines must be gentle and thin, not bright saturated red or thick brown. Background architectural color is LOCAL, not a page-wide wash or new scenery. No stars, floating decoration, extra trees, big filled illustration or strong glow.

KEEP ALL OTHER REQUIREMENTS:
The overall background is still WHITE WITH A VERY LIGHT NEUTRAL GREY TONE, approximately#F5F5F5, balanced RGB in open areas, no blue-purple-pink full-screen gradient. Keep native21:03 status bar, small dynamic island, back chevron, “团子” header, “记录”, black home indicator, same modest15pt Chinese typography and generous alignment.
Same five message roles/text and wrapping:
cat left “你回来了。”
user right “今天有点累”
cat left “嗯。那就先不用讲道理。” — ONE uninterrupted line
user right “路上看到有人在卖桂花”
cat left “桂花是真的开了吗，我没出去过。你走近的时候，闻到香味了吗？” — full available bubble width, naturally TWO lines.
Short bubbles fit content, longer messages expand to the full right inner boundary, no early wrapping or font shrinking. Keep bubble sizes/positions as in the input.
Bottom composer: “说点什么” left, slim grey mic near right, a SMALL coral circular send button INSIDE the far right, thin clean white upward arrow, no external send block or visible glow.
Elegant restrained native iOS UI: SMALLER TUANZI, BORDERLESS QUIET TRANSPARENT CHAT SURFACES, LOCAL SOFT COLOR IN THE MUSHROOM HOUSE, predominantly neutral white-grey background. No other redesign.
```
