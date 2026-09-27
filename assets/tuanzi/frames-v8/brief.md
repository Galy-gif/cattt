# 团子逐帧 v8 · 自然动作委托稿 · 2026-09-16

> 2026-09-27：**2D 世界层已冻结，这份委托单暂停，不要按它出图**；团子的新造型与新动作走 `assets/tuanzi-3d/`（[决策](../../../docs/决策/2026-09-27-3D为准线.md)）。

同日体型补记：禁止每个朝向横向脸宽都归40pt；固定K1侧站物理标尺并校准对应朝向的源像素→世界pt，保持原画比例。树窝不加猫专用缩放，猫校准后再配原窝。最新换算/量值/选中饮水眼睛加工见 `outputs/tree-nest-v1-review/本轮图片复查报告.md` 及两份delivery.json；App未改。

状态：**用户已授权按本稿出图；第一批三张关键端点姿势方向已获用户确认，K2r4口碗修正版已合成、待接触端点评审，连续动作尚未生成。** v7 的 A/B 组旧要求暂停。App 播放逻辑接入尚未实施；交付与检查在 `outputs/frames-v8-delivery/`、`outputs/frames-v8-review/`。
正式动作过程与接入计划：[自然动作规范](../../../docs/方案/团子自然动作-规范-2026-09-16.md)。v7 树窝 C 组仍保留；已确认信箱不重出。

## 要说的一句话

团子先注意、再调整重心、再行动，中间会停一停；不是不断左右摆头、喝一口吐一次舌头的玩具。

## 角色、格式、连续性

- 角色身份只用 `../canonical/` 与已确认世界层参考；沿用 v5 R1、R2、R3 与 v6 G1 的毛毡彩铅画法。旧喝水、歪头、转身只标反例，不能用作新的姿势母版。
- 保留全橙胸腹、三道额纹、无眼神光豆眼、短圆腿、环纹尾、柔软棕色轮廓；不加胡须、腮红、奶白肚皮，不改成写实或立体玩具。
- 每页 1536×1024，最多 3×2 六格，每格 512×512；多个六格页组成一个动作，不把全部帧挤在一张。猫不相碰，不画网格、符号、编号、道具、地面、阴影。
- 生成目标为纯 `#FF00FF` 背景；近似洋红留原件并在整理阶段归一化；若返回干净真 Alpha，先保留原 Alpha，再生成对应格式交付。禁止把棋盘格当透明。
- 各动作统一角色比例与缩放。同朝向的头宽初始目标约 170px，关键端点量测后固定；转向造成的投影宽度变化不能逐帧强行拉伸。运行时沿用 40pt 头宽产线，出图尺寸只缩不放。
- 实际绘制帧与参考／复制接力帧分开记；不能贴旧帧冒充新图，也不能复制六帧三遍声称有十八帧。
- 长段命名 `D1-drink-down__p01__r1.png`、`__p02__r1.png` 等，页内顺序从左到右、从上到下。实际提示词、传入参考、SHA、生成／加工记录与每项 new / failed / skipped 状态写进新 `outputs/frames-v8-delivery/delivery.json`。

## 先锁端点，再出动作短片

用户已确认三端点方向，K1与K3保留；K2与水盆衔接须满足现有碗高，当前近地面姿势不能靠整体位移救回，仅修正其颈肩／嘴部高度。具体几何与实现见 [口碗衔接方案](../../../docs/方案/喝水与水盆衔接-方案-2026-09-16.md)。先评审同一只猫的三个姿势：侧面放松站姿、嘴接现有水面的低头饮水姿、门口放松坐姿。一次一张全幅；完整关键点可见，后脚、臀部支撑点不能被尾巴盖住。端点通过后做 D1→D2→短停→D3 的完整喝水短片，再做 S1→S2→S1 的门口关注短片。两段自然感没通过，不继续整批。

每次出连续页必须传已锁端点与上页末帧。光照、画风与角色形状不变；需要变化的是动作过程。

## 分段单

| 编号 | 内容／建议帧数 | 必须画出的过程 | 禁止 |
|---|---|---|---|
| D1-drink-down | 18 帧，3 页 | 稳定站姿→鼻子前伸→颈部下探→肩胸顺势略降→嘴到水面；后腿稳定、腹部离地 | 强制压低一个头高、前腿弯成趴姿、整只猫滑向碗 |
| D2-drink-lap | 12 帧，2 页，低头循环 | 连续小幅下颌／喉部运动，嘴留在水面附近；只偶尔见极小舌尖朝下接水，其他帧收回 | 大 U 形粉舌、朝镜头吐舌、每口都站起再压低、全身起伏表演 |
| D3-drink-up | 18 帧，3 页 | 从收舌闭嘴的低头姿→嘴离水面→头颈肩逐步恢复→稳定站姿闭嘴 | 挂着舌头抬头、默认舔嘴或左右甩头、末尾趴下 |
| S1-sit-breathe | 12 帧，2 页，轻呼吸循环 | 放松坐姿，背胸轻呼吸，头随颈肩微动，支撑稳定 | 每帧全身大动、每轮必眨眼必甩尾 |
| S2-attend-tilt | 18 帧，3 页，一次 | 视线注意→耳先动→头少许转向→单侧轻倾→短停→自然回正；肩颈重心轻跟随 | 左右 25° 钟摆、头刚性旋转而身体完全锁死、机械重复 |
| S3-stand-to-sit | 18 帧，3 页，一次 | 收步稳定→前爪承重→后腿弯曲→臀降→胸背放松→尾巴安放；接 S1 | 同一帧同时转身与突然坐下、肚子贴地 |
| S4-sit-to-stand | 18 帧，3 页，一次 | 注意出发方向→身体前倾→后脚撑起→站稳；末帧接相应转向／走路 | 直接倒放坐下、不换承重整体竖起 |
| S5-drowsy-nod | 18 帧，3 页，一次 | 眼睑沉下去→颈部放松→头轻落→小幅恢复，肩背呼吸继续 | 定时同幅点头、突然切成另一代猫的睡姿 |
| S6-groom | 24 帧，4 页，一组 | 调整支撑→抬爪→短舔爪→头靠向爪擦脸→落爪→恢复 S1 | 把吐舌作为画面中心、擦脸时头／肩始终冻住 |
| T1-turn | 24 帧，4 页，一次 | 右侧站姿→头注意左方→前爪踏步→肩转→后爪跟进→左侧站稳 | 六帧内全身侧滑旋转、末帧朝左后再镜像跳右 |
| W1-walk-toward | 12 帧，2 页，一轮 | 近前腿与胸有遮挡，远腿部分藏在身体后；肩交替承重、头轻起伏、尾尖缓随 | 四条腿向两侧平摊成蛙形、靠整只猫平移冒充迈步 |

S2 左右是分别交付、分别命名的变体；先只做一个方向。T1 先只做右→左，反向另绘，不假设镜像／倒放自然。未做变体列 skipped，不能默认为全做完。
低头短停和抬头后站稳可用已锁的收舌低头／站姿帧配小呼吸；不是必须新画一整组。默认收尾不含舔嘴，变体需要单独审核。

## 自然节奏锁（每次生成贴入，按分段调整）

```text
Draw Tuanzi performing one continuous believable action, not six unrelated poses.
Use anticipation, supported weight transfer, a small settling motion and quiet pauses.
The head is attached through a flexible neck to the shoulders; it never rotates like a rigid toy joint.
Only the body parts needed for this action move. Stable support and quiet holding poses are allowed.
Keep planted paws stable until they actually lift. Show the hips following the shoulders during a turn.
For drinking: stay lowered through a series of small laps. The belly remains off the ground.
The tongue is very small, points down toward the water, retracts completely before the head rises,
and is not displayed as a broad pink U or a hanging expression. Finish standing calmly with the mouth closed.
For seated attention: notice something first, then make one gentle tilt to ONE side with subtle neck and
shoulder adjustment, pause and return. No repeated left-right pendulum, no large symmetric head rotations.
No motion symbols, ghosting, smear, Zs, speed lines, drops, sparkles or eye highlights.
```

## 验收必须覆盖整个播放过程

机器先过清单／历史与加工哈希／格式，再量关键点与接缝。既有连续性判据只判断跳变；不以“所有 IoU 很高”宣称自然。嘴与水面、腹部离地、舌头占比与支撑爪轨迹的数值先在新端点上标注后锁，尚未给出跑通阈值。

原速短片必须同时包含段间切换、停顿、返回、坐下和安静待机。另看 0.25 倍速、两分钟门口待机与左右转身接走路。请用户看自然感之后才锁定；静态六格漂亮不算动画通过。

## 口碗站位最新选择

用户否决左侧喝水被红盆遮爪的布局；改从蓝盆右侧朝左喝水，实际接触参考点、绕行路径、层级见最新口碗方案与统一/树窝方案。当前仅复用原r4镜像几何预览，正式中间帧须传固定身份+相应左向端点，核对光向/非对称纹样，不把镜像图冒充新生成图。
