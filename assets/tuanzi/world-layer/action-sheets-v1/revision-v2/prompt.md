# 团子动作横条 · Revision v2 实际修订提示词

生成方式：Codex 内置 imagegen 定点编辑；随后只做背景归一、主体碎片清理、尺寸整理与可复核的确定性局部处理。v1 原图保留，没有覆盖。

## 蜷睡呼吸

```text
Reduce only the breathing amplitude. Keep the underside, paws, tail, head, ear tips and baseline anchored. Breathing comes only from a tiny 2–3% upper-flank contour expansion; never scale the whole cat, inflate it, roll it, or reshape it. Keep six frames, three forehead stripes, back stripes, ringed tail, closed eyes, faint warm-brown mouth and #C6D9C4 background unchanged.
```

生成编辑仍为约 5.2%，因此未直接采用其六帧差异。最终横条从同一睡姿锁定头、爪、尾和基线，只对右上背／胸腹轮廓施加 `0 / 2 / 4 / 6 / 4 / 2 px` 的局部位移；最大值为猫高的 2.63%。

## 困倦点头

```text
Keep the seated torso, rump, paws, tail, baseline and overall body scale unchanged. Animate only the head and eyelids through upright, slight dip, deeper dip, deepest nod, partial rise and return. Keep exactly three forehead stripes with stable shape, width, spacing and placement. No whole-cat shrink or zoom.
```

生成后将第 1 帧下半身作为锁定底板：原始横条 `y >= 410`（交付放大后 `y >= 820`）六帧像素一致；`y <= 350` 保留各帧头部动作，中间 60px 软融合。

## 奔跑

```text
Remove every gray-green contact shadow, ground smear and loose mark beneath the paws. Remove the cream/white belly patch from all running frames and repaint it the same honey-orange fur as the walk sheet. Preserve the exact run poses, phase order, short legs, faint mouth, three forehead stripes, back stripes and ringed tail.
```

生成后按每只猫的最大主体连通区整理，删除与猫不相连的脚下碎片；六帧腹部均为蜂蜜橙，不再出现奶白肚皮。

## 树干磨爪

```text
Create six CAT-ONLY frames scratching against one invisible fixed vertical contact plane on the left. No tree, bark, flecks, roots, leaves, grass or shadow. Keep the overall cat scale stable; hind-paw baseline fixed. The change in visible height comes from alternating paw reach, not zooming. Keep the ringed tail and exactly three forehead stripes.
```

树干不再进入角色资产。定位参考由同一张猫-only 横条确定性生成：每格使用同宽、同坐标的场景层树干示意，并把最左接触点对齐到同一条竖线；不使用生成式树干。

