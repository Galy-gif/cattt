# 轨道 3 revision-2 实际提示词

内置 imagegen，三次独立图参考编辑。每次引用上一版同批原图，保留物件设计，调整尺度、颜色与质感；三批均新生成，没有把旧图冒充新图。

## 01-furniture

```text
STYLE — applies to the whole image.
Hand-drawn 2D children's-book illustration for a mobile app. Warm, quiet, unhurried. Finished artwork, not a sketch and not a diagram.
LINE: Every contour drawn by hand. Line weight VARIES within a single stroke: heavier along underside and overlaps, tapering along top edges. Slight ink pooling at direction changes. Dark warm brown #6B5B4A, NEVER black. Slight corner overshoots permitted.
FORM: NO perfect circles, perfect ellipses or mathematically symmetrical mirrored shapes. Draw irregular organic handmade forms.
SURFACE: Coloured-pencil, crayon and dry-brush grain INSIDE colour areas, dense centre and patchier near edges; faint warm cream paper tooth. Flat underlying colour. No smooth gradients, airbrush, glow, drop shadows, bevels or rim light.
PALETTE: sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2, wood brown #B39C86, line brown #6B5B4A. Accent coral #D8705C on at most one or two props and LESS THAN 3% image area.
NEVER: aged paper, stains, blotches, speckle noise, dirt, thick glass, gradients, heavy shadows, 3D, plastic/clay rendering, text, numbers, labels, UI.
Use case: stylized-concept.
A 4x4 grid of exactly 16 small hand-drawn props for a cosy cat world. Plain flat #EFE6D2 cream background. Generous even margins in every grid cell for cutting apart. No overlapping, no shared ground, no shadows. Do not draw grid lines. Every prop at same world scale and distance: stool much larger than a bowl. Composition is square 1536x1536. Place each listed prop in its own cell in reading order. Keep consistent restrained warm brown outline and textured flat fills across all objects.
Exactly these 16 items, each once, in row-major order:
1. wooden stool
2. low wooden table
3. woven basket
4. clay bowl
5. ceramic water bowl
6. wooden bucket
7. hanging lantern
8. stack of books
9. rolled blanket
10. small crate
11. straw broom
12. wooden sign post (blank, no text)
13. ball of yarn
14. small cushion
15. watering can
16. tin cup
REVISION: Reference image is the preceding batch's edit target. Preserve the 16 individual object designs, orientation, motifs and row-major ordering; modify scale, restricted palette and finish only. Correct exactly these failures:
Preserve all 16 furniture designs in exact reading order. Keep stool and table silhouettes. Same world metric: stool height 40cm -> 160px; table width 60cm -> 240px; basket height 35cm -> 140px; clay bowl width 20cm -> 80px; water bowl 20cm -> 80px; bucket height 30cm ->120px; lantern height 25cm ->100px; book stack width25cm ->100px; rolled blanket width30cm ->120px; crate width35cm ->140px; broom length55cm ->220px; sign total height50cm ->200px; yarn diameter8cm ->32px; cushion width30cm ->120px; watering can total height25cm ->100px; cup height9cm ->36px. Keep small objects visibly small with generous empty cell space. Water must be cream/sage, no blue, tin cup sage/cream, no gray.
Four equal rows and four equal columns on a square 1536px sheet, each object CENTERED in its own cell. Small objects must NOT be enlarged to fill cells. Pixel targets are approximate but ratios are essential. Pure uniform solid #EFE6D2 outside objects, absolutely zero grain or vignetting in background. Lighter clean coloured-pencil/crayon texture exclusively within shapes, sparse restrained grain rather than dense antique crosshatch. Consistent fine warm-brown contour weight throughout, 1-2px at 1536 scale, slight natural variation, same weight even on tiny objects. Flat fills, no shading. No text or dimensions in image.
```

## 02-nature

```text
STYLE — applies to the whole image.
Hand-drawn 2D children's-book illustration for a mobile app. Warm, quiet, unhurried. Finished artwork, not a sketch and not a diagram.
LINE: Every contour drawn by hand. Line weight VARIES within a single stroke: heavier along underside and overlaps, tapering along top edges. Slight ink pooling at direction changes. Dark warm brown #6B5B4A, NEVER black. Slight corner overshoots permitted.
FORM: NO perfect circles, perfect ellipses or mathematically symmetrical mirrored shapes. Draw irregular organic handmade forms.
SURFACE: Coloured-pencil, crayon and dry-brush grain INSIDE colour areas, dense centre and patchier near edges; faint warm cream paper tooth. Flat underlying colour. No smooth gradients, airbrush, glow, drop shadows, bevels or rim light.
PALETTE: sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2, wood brown #B39C86, line brown #6B5B4A. Accent coral #D8705C on at most one or two props and LESS THAN 3% image area.
NEVER: aged paper, stains, blotches, speckle noise, dirt, thick glass, gradients, heavy shadows, 3D, plastic/clay rendering, text, numbers, labels, UI.
Use case: stylized-concept.
A 4x4 grid of exactly 16 small hand-drawn props for a cosy cat world. Plain flat #EFE6D2 cream background. Generous even margins in every grid cell for cutting apart. No overlapping, no shared ground, no shadows. Do not draw grid lines. Every prop at same world scale and distance: stool much larger than a bowl. Composition is square 1536x1536. Place each listed prop in its own cell in reading order. Keep consistent restrained warm brown outline and textured flat fills across all objects.
Exactly these 16 items, each once, in row-major order:
1. potted leafy plant
2. small potted flower
3. tall grass tuft
4. low grass tuft
5. fern
6. single mushroom
7. mushroom cluster
8. fallen leaf pile
9. single leaf
10. small rock
11. mossy rock
12. tree stump
13. log
14. twig bundle
15. dandelion
16. clover patch
REVISION: Reference image is the preceding batch's edit target. Preserve the 16 individual object designs, orientation, motifs and row-major ordering; modify scale, restricted palette and finish only. Correct exactly these failures:
Preserve all 16 nature designs in exact reading order. Keep plants organic. World metric 4px/cm: leafy potted plant total height45cm ->180px; potted flower 25cm ->100px; tall grass35cm ->140px; low grass10cm ->40px; fern30cm ->120px; single mushroom8cm ->32px; cluster15cm ->60px; leaf pile width25cm ->100px; SINGLE LEAF length6cm ->24px, extremely tiny compared with stump; small rock width10cm ->40px; mossy rock25cm ->100px; stump height30cm ->120px; log length50cm ->200px; twig bundle30cm ->120px; dandelion height20cm ->80px; clover patch width20cm ->80px. CORAL only the small flower petals and single mushroom cap; flower pot wood brown, mushroom cluster wood brown and cream. Dandelion ONLY cream seed-head with sage stem: remove yellow flower entirely. Leaf pile sage/wood brown only. No yellow, orange, ochre, blue or gray. Keep small things tiny in cells.
Four equal rows and four equal columns on a square 1536px sheet, each object CENTERED in its own cell. Small objects must NOT be enlarged to fill cells. Pixel targets are approximate but ratios are essential. Pure uniform solid #EFE6D2 outside objects, absolutely zero grain or vignetting in background. Lighter clean coloured-pencil/crayon texture exclusively within shapes, sparse restrained grain rather than dense antique crosshatch. Consistent fine warm-brown contour weight throughout, 1-2px at 1536 scale, slight natural variation, same weight even on tiny objects. Flat fills, no shading. No text or dimensions in image.
```

## 03-cat-misc

```text
STYLE — applies to the whole image.
Hand-drawn 2D children's-book illustration for a mobile app. Warm, quiet, unhurried. Finished artwork, not a sketch and not a diagram.
LINE: Every contour drawn by hand. Line weight VARIES within a single stroke: heavier along underside and overlaps, tapering along top edges. Slight ink pooling at direction changes. Dark warm brown #6B5B4A, NEVER black. Slight corner overshoots permitted.
FORM: NO perfect circles, perfect ellipses or mathematically symmetrical mirrored shapes. Draw irregular organic handmade forms.
SURFACE: Coloured-pencil, crayon and dry-brush grain INSIDE colour areas, dense centre and patchier near edges; faint warm cream paper tooth. Flat underlying colour. No smooth gradients, airbrush, glow, drop shadows, bevels or rim light.
PALETTE: sage green #C6D9C4, deeper green #A6C0A3, cream #EFE6D2, wood brown #B39C86, line brown #6B5B4A. Accent coral #D8705C on at most one or two props and LESS THAN 3% image area.
NEVER: aged paper, stains, blotches, speckle noise, dirt, thick glass, gradients, heavy shadows, 3D, plastic/clay rendering, text, numbers, labels, UI.
Use case: stylized-concept.
A 4x4 grid of exactly 16 small hand-drawn props for a cosy cat world. Plain flat #EFE6D2 cream background. Generous even margins in every grid cell for cutting apart. No overlapping, no shared ground, no shadows. Do not draw grid lines. Every prop at same world scale and distance: stool much larger than a bowl. Composition is square 1536x1536. Place each listed prop in its own cell in reading order. Keep consistent restrained warm brown outline and textured flat fills across all objects.
Exactly these 16 items, each once, in row-major order:
1. cat bed cushion
2. woven hanging nest
3. scratching log
4. feather toy
5. small bell
6. food bowl with kibble
7. blanket in a heap
8. paper bag
9. cardboard box
10. fish shaped toy
11. string with knot
12. wooden crate stack
13. lantern on a stand
14. stepping stone
15. birdhouse
16. bundle of firewood
REVISION: Reference image is the preceding batch's edit target. Preserve the 16 individual object designs, orientation, motifs and row-major ordering; modify scale, restricted palette and finish only. Correct exactly these failures:
Preserve all 16 cat-prop designs in exact reading order. World metric 4px/cm: cat bed width45cm ->180px; hanging nest total height60cm ->240px; scratching log length45cm ->180px; feather toy length45cm ->180px; TINY BELL total height3cm ->12px (only about one fifteenth the bed width), it must be tiny with huge empty space; kibble bowl20cm ->80px; blanket heap width40cm ->160px; paper bag height30cm ->120px; cardboard box width40cm ->160px; fish toy12cm ->48px; knotted string20cm ->80px; crates stack height50cm ->200px; lantern with stand55cm ->220px; stepping stone width35cm ->140px; birdhouse total height30cm ->120px; firewood bundle width40cm ->160px. Coral only one feather; no gold/yellow bell, make bell sage with warm brown contour.
Four equal rows and four equal columns on a square 1536px sheet, each object CENTERED in its own cell. Small objects must NOT be enlarged to fill cells. Pixel targets are approximate but ratios are essential. Pure uniform solid #EFE6D2 outside objects, absolutely zero grain or vignetting in background. Lighter clean coloured-pencil/crayon texture exclusively within shapes, sparse restrained grain rather than dense antique crosshatch. Consistent fine warm-brown contour weight throughout, 1-2px at 1536 scale, slight natural variation, same weight even on tiny objects. Flat fills, no shading. No text or dimensions in image.
```

