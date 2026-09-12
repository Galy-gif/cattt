# U9a–U9d 最终提示词 · 2026-09-12

执行方式：Codex 内置 imagegen。U9a 单独生成；U9b–U9d 分别以 U9a 为编辑母版，各自单独调用，只改页面底。

## U9a

```text
Use case: ui-mockup
Asset type: single full-bleed portrait mobile app direction mockup, 1024×1536. No phone frame, no presentation board, no grid, no multiple screens.
Input images: S1 is a style/material reference only for quiet light-skeuomorphic off-white surfaces and soft shadows; S2 is a style/material reference only for warm paper handling; the historical diary image is a functional hierarchy reference only. Do not copy brands, mascots, bottom navigation, orange icons, or unrelated layout.
Primary request: Create U9a, a Chinese diary list page used solely to compare page background. Calm, restrained, premium, generous whitespace.
Scene/backdrop: nearly flat warm off-white paper, #F6F2EA at top to #FBF8F2 at bottom, very subtle vertical gradient; texture luminance variation <= 0.02.
Layout: status bar; upper-left serif “九月十二日 · 星期六”; bold serif “今天” about 34pt; upper-right 42pt circular avatar with monoline cat-head; chip “全部 · 2条”; two stacked cards. White user card: “我 · 10:18” and “今天风有点大，路边的花开得很好。” Warm-paper Tuanzi card #F6EEDC: “团子 · 今晚” and “你回来以前，我在树窝里睡了一会儿。” At most one tiny monoline paw beside the second caption.
Style: shippable high-fidelity iOS UI, quiet light-skeuomorphic paper UI; white cards #FFFFFF or #FDFBF7; 18–20pt radius; 1px white top highlight; soft diffuse ink shadow around 7%, y6 blur14. Serif title/date, sans body, ink #1F3022, one dark monoline icon color, 1.5pt stroke.
Constraints: two cards, one chip, one avatar. No bottom tab bar, primary button, yellow, cold mint, black pill, colorful icon, rainbow blur, plastic, 3D character, English UI, extra text, or watermark. Chinese text must be legible and verbatim.
```

## U9b

```text
Change ONLY the exposed page background outside the cards to 米白毛毡. Keep every non-background pixel as unchanged as possible. Use #F6F2EA to #FBF8F2 with extremely subtle short fine natural felt fibers, luminance variation 0.03–0.04. Matte felt paper, not furry fabric. No layout, text, card, ink, icon, shadow, or decoration changes.
```

## U9c

```text
Change ONLY the exposed page background outside the cards to 暖纸. Keep every non-background pixel as unchanged as possible. Use #F6EEDC to #FBF6EA, saturation about 0.10, restrained fine paper grain, luminance variation <= 0.04. Preserve the Tuanzi card color to expose possible collision. No layout, text, card, ink, icon, shadow, or decoration changes.
```

## U9d

```text
Change ONLY the exposed page background outside the cards to 淡天青灰. Keep every non-background pixel as unchanged as possible. Use #EEF1F1 to #F7F8F7, saturation <= 0.03, slightly warmer than cold mint gray; add only a few broad nearly invisible pale cyan-white light blooms, luminance variation <= 0.04. No layout, text, card, ink, icon, shadow, or decoration changes.
```
