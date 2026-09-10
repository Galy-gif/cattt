# 团子毛毡世界层 v1 — 生成提示词记录

生成方式：Codex 内置 imagegen；九姿态与每个动作分别生成，未使用 CLI。

## 共享材质提示词

```text
Use case: style-transfer
Change only the visual material while preserving the source layout, pose sequence, scale and identity. Keep Tuanzi approximately 80% original wax-crayon illustration and 20% matte short-fiber felt: warm-brown imperfect crayon outline, subtle felt nap inside the orange fills, and a restrained fuzzy felted silhouette edge. Do not turn the cat into a plush toy, 3D object, stitched doll or fabric-patch character.

Keep the chunky orange-tabby identity: huge round head, bean-shaped torso, very short legs, small round paws, tiny dark eyes, no whiskers, no cream/white chest or belly, stable forehead/back stripes and ringed tail. The mouth is one tiny low-contrast warm-brown stroke, slightly deeper than the fur and barely visible.
```

## 九姿态

严格保留原 3×3 布局、九个情境、猫数量、姿态轮廓、道具位置和相对尺度。猫使用轻毛毡蜡笔材质；篮子、蘑菇屋、吊巢、池塘、软垫、树叶、树干、碗和石头使用选定小院的剪裁毛毡材质。背景为安静的浅鼠尾草绿。

## 八组动作

所有动作严格保留一行六帧、原帧序、主体尺度、间距和动作意图：

- 走路：保留右向接触／下沉／经过的交替循环。
- 困倦：身体、臀部、脚、尾和基线不动，只改变头部下沉和眼睑。
- 眨眼：正面对视，开眼—下压—半闭—闭眼—半开—睁眼，身体只有 1–2% 呼吸。
- 伸懒腰：紧凑站立—前爪前伸—胸口下沉—最深伸展—释放—返回。
- 磨爪：cat-only，对齐同一隐形接触面，后脚基线与躯干尺度稳定。
- 追尾：固定略俯视镜头，身体朝向均匀完成顺时针一圈，不重复尾巴。
- 奔跑：沿用 v2 的蹲—推—伸展腾空—收—反向伸展—落地，无腹部白斑和脚下接触影。
- 蜷睡呼吸：沿用 v2，头、爪、尾、腹面和基线固定，只有上侧胸腹轮廓 2–3% 起伏。

动作表使用统一浅鼠尾草绿展示背景，不添加道具、场景、文字、编号、网格或水印。

## 磨爪定位参考

六格各放同宽、同高、同位置的简化毛毡树干条，猫爪接触点对齐同一竖线。该图只用于定位，不进入角色运行资产。

