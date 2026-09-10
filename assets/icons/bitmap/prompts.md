# 图标轨道实际提示词

工具：内置 imagegen；两次调用均只引用 canonical 正面图。

## 第一次

Use case: logo-brand. Asset: Tuanzi silhouette mark exploration, designed for a 24px tab bar first.
Reference image: use the attached canonical cat ONLY to preserve chunky round build, big irregular head, asymmetric ear angles and long S-curved tail. This layer intentionally drops all character drawing detail.
Produce ONE large clean monochrome master silhouette of the cat, not a sheet. We will mechanically export real 24x24,48x48,180x180 rasters from it afterward. Design the 24px recognition first: broad connected chunky seated body with very short feet, large head; two obvious differently angled ears; one long thick S-shaped tail protrudes left with generously open negative space between tail and body. Tail must remain distinguishable at 24px. Keep only broad essential silhouette gestures.
FORM: no perfect circles, ellipses or mirror symmetry. Head irregular rounded mass with one soft flattened cheek. Organic hand-shaped contour but no fur tufts.
PALETTE: solid single-colour honey orange #E3A05C cat on uniform cream #EFE6D2 background.
Flat opaque solid shapes, no grain, no shading, no outline. NO facial features, NO eye holes, NO stripes, NO interior lines, NO text, no props, no decorative frames. No symmetrical generic cat head logo; entire seated chunky cat and long S tail visible with 12% clean margin. Vector-friendly smooth organic silhouette but output raster illustration.

结果：尾形偏 C 钩，未采用。

## 第二次追加约束

CRITICAL TAIL: a long distinct S curve, not a C-hook: starts at left haunch curving outward to left, then reverses direction inward, then the upper tip bends outward again. Two opposite bends create a clear sinuous S with rounded tip. Make the tail thicker than a 24px pixel stroke. Keep body short broad and heavy with almost no neck.

采用第二次生成轮廓。真实像素导出由 Swift 机械处理，未重新生成三个尺寸。
