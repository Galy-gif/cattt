# C4 r2 实际提示词：补完整不透明页面底

内置imagegen编辑r1；只修复错误的真实透明画布与Alpha边缘。保持团子和无发光玻璃布局。

```text
Use case: corrective background edit.
Edit the input Chinese iOS chat image. The previous image accidentally has an alpha-transparent canvas. Fix ONLY this BACKGROUND/ALPHA ERROR by rendering the ENTIRE screen onto a complete OPAQUE neutral white-grey background.

CRITICAL OUTPUT FORMAT: a full rectangular opaque image. Every output pixel must have alpha255; use RGB PNG or fully opaque RGBA PNG. NO real transparent canvas, NO cutout, NO alpha holes, NO black background, NO checkerboard, NO erased white areas. “Transparent glass” means the visual appearance of glass WITHIN the already-rendered opaque screenshot, NOT actual transparency in the PNG file.

Fill all currently transparent / black-looking missing backdrop regions with a continuous solid very light neutral grey-white #F5F5F5, with only an imperceptible grey tonal variation between #F3F3F3 and #F7F7F7. Balanced RGB, white-dominant, no blue, lilac, pink, peach, magenta or colored gradient. Smooth, clean, fully present background behind the status bar, header, messages, negative space, mushroom motif, composer and home indicator. Remove jagged alpha residue around every element. The finished output must be a clean complete app screenshot.

Preserve the existing correct illustrated TUANZI orange cat in all THREE round windows, face, forehead stripes, dot eyes, orange chin, soft colored-pencil/felt texture, attached orange paws resting on lower circular rims; preserve all three poses. Do not replace him with a photo or generic cat. Preserve the existing light non-glowing chat bubbles, wide text wrapping, subtle fine grey borders and calm glass illusion. NO bright glass rim, halo, corner flares or emission. All glass interiors should look lightly translucent against the opaque grey-white backdrop, without being actual PNG cutouts. Keep the faint grey mushroom house outlines at lower right and tiny warm window subdued, no bright glow. Keep the input container, “说点什么”, grey mic, small coral circular send button INSIDE its right end and thin white arrow, without halo. Keep native21:03 status bar, back arrow, “团子”, “记录” and black home indicator.

Keep five Chinese message strings:
“你回来了。”
“今天有点累”
“嗯。那就先不用讲道理。”
“路上看到有人在卖桂花”
“桂花是真的开了吗，我没出去过。你走近的时候，闻到香味了吗？”
Third bubble stays one line, long fifth bubble two naturally flowing lines. Same foreground arrangement and typography.
One complete opaque portrait iOS screen, same aspect ratio. No phone frame, grid, outside canvas, watermarks or extra text. ONLY repair background completeness and alpha residue; do not redesign the foreground.
```
