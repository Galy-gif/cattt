# 资产转换修订 2

本轮主交付是 `ui/` 的 21 张 PNG：**@1x 311×311、@2x 622×622、@3x 933×933，全部禁止上采样**。脚本从请求的 512 逐像素检查全套安全画布，受 canonical 原图限制选择 311。逻辑显示尺寸因此由 512 降为 311；不能把本包拉伸到 512 后再声称无放大。首轮 `outputs/assets/ui/` 及封版原图保留。

## 运行

在当前工作区执行：

```sh
/Users/gouzi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 outputs/assets/revision-2/convert_assets_v2.py --source-root '/Users/gouzi/Documents/ChatGPT/猫'
```

默认目标是本目录，重复运行更新本轮派生结果。脚本复用上级 `convert_assets.py` 的既有奶油/棋盘格去底函数；移动时请保留父子目录关系。`--size 512` 是允许的最大 1x 尺寸，不是强制尺寸。需要保留 512 模式可显式 `--allow-upscale --out outputs/assets/revision-2/upscale-512`，manifest 会逐张标记放大；该模式不属于本次无放大主交付。

新增图片通过 `--config jobs.json` 指定列表：

```json
[{"name":"world-new-pose","source":"outputs/new-pose.png","background":"sage","foot_y":800}]
```

相对 source 以 `--source-root` 为基准。背景支持 `cream`、`neutral`、`sage`（#C6D9C4）、`auto`（四角中位数估计单色底）。检测到真实透明/半透明 alpha 时原样保留该 RGBA，再裁切、对齐和缩放，不二次颜色抠除。`auto` 适用单色底，不能识别任意复杂背景；烘焙棋盘格请显式 neutral。`foot_y: 0` 也是有效坐标，与未指定区分。

## 本轮修复与验证

06 在原图区域 x=130..845、y=1330..1500 内做局部地面笔触清理，使用人工逐点确定的猫爪和椅脚保护多边形，保护边再外扩 1px。仅调整保护范围外浅色像素的 alpha，均值 RGB 135..190 平滑衰减；保护区和 ROI 外像素零修改。准确多边形与修改像素数量记录在 manifest。这个清理坐标只适用于封版 919×1711 的 06，尺寸不匹配即报错，其他新图不默认应用。

`qa/06-ground-before-after.png` 展示同源坐标的清理前后。猫脚旁大部分白色地面笔触已去除，猫爪、椅脚和深色轮廓保留。紧贴轮廓的少量底色混合像素仍可能存在；不把颜色去底宣称为人工逐像素精修或恢复原始分层。

7 张源图 SHA-256 转换前后相同；只用 README 指定的 6 张封版加 canonical，排除 ALT。21 个导出文件写入后重新读取，验证 RGBA、尺寸、完整透明/不透明/中间 alpha，@3x 角色实际宽高不超过裁切原图，脚底映射误差不超过 0.51 输出像素。

共同脚底基线为 **274 / 548 / 822**。六张自动采用实体内容底边；06 人工猫脚底 y=1412，椅脚仍在猫脚底以下，不误用椅脚作为锚点。

| 素材 | @3x / 源图像素缩放率 |
|---|---:|
| aloof | 0.6604 |
| content | 0.7023 |
| sleepy | 0.6007 |
| curious | 0.7184 |
| startled | 0.7243 |
| affectionate | 0.5883 |
| canonical | 0.9983 |

`test_pipeline.py` 的小型合成测试验证：现有半透明 RGBA 逐像素保留；sage 与 auto 单色背景可正确移除、主体保持不透明且边缘有半透明；零脚底坐标计算有效。

## 产线约束

后续优先真实透明 PNG；若用单色底，禁止烘焙棋盘、渐变、背景纸纹与地面阴影。统一源画布、角色尺度、脚底锚点、留白；猫与物件尽量分开交付并附组合参考。若需要 512 逻辑尺寸的无放大 @3x，应交付足够大的 canonical 与每个姿态源图，而不是把旧图插值扩尺寸。

本包保持比例并对齐落点，但不保证独立生成姿态的头部/身体尺度一致。眼睛、尾巴独立图层以及遮挡身体仍需人工重绘；去底脚本没有恢复分层能力。
