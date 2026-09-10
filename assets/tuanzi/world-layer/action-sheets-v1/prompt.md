# 团子世界层动作横条 v1 · 实际提示词

生成方式：Codex 内置 imagegen；每个动作单独调用一次。第一轮仅验动作，不进入产线。

## 参考图职责

- `assets/tuanzi/world-layer/01-nine-poses.png`：本轮由用户指定为最终世界层形象，锁定简化画法、厚圆体型、短腿、额纹、背纹与环尾。
- `assets/tuanzi/canonical/团子-canonical-v1.png`：只辅助校准蜂蜜橙颜色、耳角与环尾身份，不继承界面层的黄色眼眶、胡须、奶油胸毛或精细五官。

## 用户本轮覆盖项

原走路规范写“完全不画嘴”。用户在首轮生成后改为：保留九姿态版若隐若现的小嘴，颜色稍微深一档。

最终统一口径：每个可见脸只保留一枚极小、低对比的暖棕色短笔触；正常尺寸下不抢眼，放大后可辨。禁止黑色重嘴、张嘴、舌头、`W/ω` 猫嘴、分叉嘴、鼻口连接线与胡须。

## 共享提示词

```text
Use case: stylized-concept
Asset type: first-round six-frame horizontal animation action sheet for a mobile app world-layer character; action validation only.

Image 1 is the FINAL visual identity and world-layer style reference for Tuanzi. Preserve its simplified chunky round orange-tabby build, tiny eyes, short legs, three forehead stripes, back stripes, rounded ears, soft pencil/crayon texture, and clearly ringed tail.

Image 2 is secondary reference ONLY for exact honey-orange color, ear angle, and ring-tail identity. Do not copy its detailed face, yellow eye sockets, whiskers, cream muzzle, chest bib, or detailed interface-layer rendering.

Create exactly SIX equal-size sequential frames in one horizontal row only. Use a perfectly uniform flat sage green #C6D9C4 backdrop, consistent character scale, generous margins, and no labels.

The mouth is one extremely small, faint, understated warm-brown dash below the eyes, slightly darker than the barely visible mouth in the nine-pose reference but still low-contrast. No black mouth, smile, open mouth, tongue, W/omega/forked mouth, nose-to-mouth line, muzzle, whiskers, or eye highlights.

Keep three forehead stripes, back stripes, and the clearly ringed tail. The body stays round and the legs stay short, never sleek or long-bodied.

Avoid text, numbers, labels, watermark, borders, gradient, paper texture in the background, checkerboard, cast shadow, ground line, extra cats, cropped tail, or missing tail rings.
```

## 动作分镜

### 1. 走路 `tuanzi-walk-sheet-v1.png`

```text
Strict 90-degree side profile facing right. 01 contact: left front paw lands and right hind paw pushes. 02 down: weight compresses and body is lowest. 03 passing: opposite legs pass under the body and body is highest. 04 contact: opposite leg phase of frame 01. 05 down: opposite phase of frame 02. 06 passing: opposite phase of frame 03 and reconnects to frame 01. Body bob is 3–5% of cat height; head lags the body by about one quarter beat. Full ringed tail visible in all six frames.
```

### 2. 困倦点头 `tuanzi-sleepy-sheet-v1.png`

```text
Seated three-quarter view. 01 eyes small and half-open, head upright. 02 eyelids droop and head lowers slightly. 03 eyes almost closed and head dips farther. 04 deepest nod, eyes fully closed and body softly compressed. 05 head rises a little but eyes stay heavy. 06 returns toward frame 01 with one tiny slow blink. Tail rests beside the body with rings visible.
```

### 3. 呆萌眨眼看你 `tuanzi-blink-look-sheet-v1.png`

```text
Front-facing seated pose, calm and slightly goofy blank direct gaze. 01 both dot eyes open. 02 upper eyelids lower. 03 half closed. 04 fully closed as two short soft curved strokes. 05 half open. 06 fully open. Head and body remain almost still; only a barely perceptible ear twitch and 1–2% breathing motion.
```

### 4. 伸懒腰 `tuanzi-stretch-sheet-v1.png`

```text
Strict right-facing side profile. 01 compact standing. 02 front paws step forward and shoulders lower. 03 chest sinks and forelegs extend. 04 deepest stretch with forepaws forward, chest low, hindquarters raised and tail lifted. 05 release begins. 06 returns toward compact standing. The motion is lazy and satisfying, not athletic.
```

### 5. 树干磨爪 `tuanzi-tree-scratch-sheet-v1.png`

```text
One identical simple vertical tree trunk repeats as the necessary interaction anchor in every frame. Tuanzi stands on short hind legs in side profile, both forepaws on the bark. Paws alternate low, rising, highest reach, downward rake, opposite rise, and return. Tiny bark flecks may appear only at the contact point. No roots, leaves, grass, scenery, or ground.
```

### 6. 玩尾巴转圈 `tuanzi-tail-chase-sheet-v1.png`

```text
Fixed slightly elevated three-quarter camera. Tuanzi curls into a compact comma and turns clockwise while following the tip of its own ringed tail. Across frames 01–06, body orientation advances evenly through a full circle and reconnects to frame 01. Short paws make quick small steps. No arrows and no duplicate tails.
```

### 7. 奔跑 `tuanzi-run-sheet-v1.png`

```text
Strict right-facing 90-degree side profile. 01 gathered contact. 02 strong push-off. 03 first airborne stretch. 04 gathered airborne phase with paws tucked. 05 opposite airborne stretch. 06 landing compression, reconnecting to frame 01. Body bob is 6–8%; keep the chunky body and short legs. Ears trail subtly and the full ringed tail streams behind.
```

### 8. 蜷睡呼吸 `tuanzi-sleep-breathe-sheet-v1.png`

```text
Consistent three-quarter side view. Tuanzi is curled into a soft round ball, head on paws, eyes closed, ringed tail wrapped around the body. 01 neutral exhale. 02 chest and flank expand. 03 gentle inhale. 04 fullest inhale, only 1–2% fuller. 05 begins exhale. 06 returns toward frame 01. Paws and tail stay anchored so it reads as breathing, not rolling or shape-shifting. No sleep symbols, blanket, basket, or cushion.
```

