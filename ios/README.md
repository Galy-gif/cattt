# 猫猫 iOS MVP · SwiftUI 实现

原生 SwiftUI 实现。产品文档位于 `docs/产品/`，决策与方案见 `docs/README.md`；现行界面以本工程为准（`design/` 只留配色令牌）。
早期交接文档中的 `project/Maomao iOS MVP.dc.html` 与 `project/design_handoff_ios_mvp/README.md` 路径不在当前资料包中；构建不依赖它们。
覆盖核心闭环：创建流程（5 屏）、陪伴主页（毛毡小院世界层）、专注聊天、日记（院子信箱里抽出的纸）、我的（右上角头像 sheet）。2026-09-10 起没有底部 Tab 栏。

产品要旨没有变：**没有打卡、没有等级金币、没有喂养任务、没有连续天数**。
用户几天不来，猫不掉状态、不催、不怪。任何带「任务」「进度」「坚持」意味的措辞都不要往里加。

## 跑起来

```
open ios/Maomao.xcodeproj
```

选一个 iPhone 模拟器（设计基准是 390 × 844，对应 iPhone 12–15 一档）直接 Run。
签名走 Automatic，`PRODUCT_BUNDLE_IDENTIFIER` 是 `com.maomao.app` —— 上真机改成你自己的 team 和 bundle id。

- 最低系统：**iOS 17.0**（用到 `UnevenRoundedRectangle`、`Layout`、零参 `onChange`）
- 竖屏专用
- Swift 5 语言模式

陪伴世界最近一次在 iPhone 17 Pro / iOS 26.5 Simulator 构建并运行验证是 2026-09-12（逐帧 v5 树窝与走路换向），记录见 `docs/specs/逐帧v5-实施与验收.md`；更早的 v4 记录在 `docs/archive/specs/`。尚未完成 iOS 17 真机验收。

### 文件列表变了怎么办

`Maomao.xcodeproj/project.pbxproj` 是脚本生成的。平时在 Xcode 里增删文件正常操作即可；
如果想从磁盘重建整个文件列表（比如批量搬目录之后）：

```
cd ios && python3 generate_project.py
```

对象 id 是按路径 md5 定的，重跑结果逐字节一致，diff 不会炸。

## 结构

```
Maomao/
  App/           入口、根视图（路由 + 轻提示 + 信箱抽纸 / 我的 sheet 叠放）
  DesignSystem/  色板、字体、尺寸令牌、矢量图标
  Model/         地点、消息、碎片、气质与特征、种子数据；世界层：场景、猫的模拟、树窝等交互阶段、镜头、动作目录
  Backend/       聊天走本地模拟还是本机后端（server/）
  Store/         AppStore —— 全部状态与状态转换；WorldEngine 驱动世界层时钟，WorldTextureCache 按镜头加载贴图
  Features/
    Home/        陪伴主页、地点轨、世界层画布
    Chat/        专注聊天、消息行、长按菜单、光斑背景
    Diary/       日记纸（信箱里抽出来）、碎片行（团子来过三态）、记一下抽屉
    Me/          我的
    Onboarding/  欢迎 / 选外观 / 气质 / 命名 / 初次见面
    Shell/       通用零件（含信箱抽纸容器 PaperSheet）
  Debug/         调试面板（#if DEBUG）
  Assets.xcassets 团子表情、世界层动作帧（world-v2…v5）、动作目录 cat-actions-v2、场景配置 world-scene-v4 及备用链
  Resources/WorldTextures 世界层地块与物件贴图
```

状态全部集中在 `AppStore`（`@MainActor` 的 `ObservableObject`），界面只读它、只调它的方法。
交接文档里列的每个状态字段都在，命名对得上。

## 设计令牌落在哪

| 交接文档 | 代码 |
|---|---|
| 配色方案 B 全套色值 | `DesignSystem/Palette.swift` |
| 字号 / 衬线字体 / 行高 / 字距 | `DesignSystem/Typography.swift`，字距用 `track(em, size)` 折算 |
| 圆角 / 间距 / 点按高度 / 动效时长 | `DesignSystem/Metrics.swift` |
| 手绘线性图标 | `DesignSystem/Icons.swift`，SVG 路径逐条搬成 `Path` |
| 各地点落脚点（长卷归一化坐标）、状态句、反应句 | `Model/Location.swift`；世界层几何以场景配置 `world-scene-v4` 为准 |
| 语料池、名字池、三档解释 | `Model/ChatMessage.swift` |
| 种子数据（四条碎片、五条消息） | `Model/DiaryEntry.swift` |

图标**没有**换成 SF Symbols —— 交接文档明确写了「非任何图标库」，
换成系统图标会把这套院子的手绘笔触冲掉。所有路径都在 24 × 24 设计空间里写，
`VectorIcon` 负责缩放，描边宽度跟着缩。

## 和原型不一样的地方

都是移植到原生时必须做的判断，逐条列出来备查：

1. **字体**。设计稿用 Noto Serif SC，那是 Google Web Font，iOS 不自带。
   现在退到系统自带的 **Songti SC**（同属思源宋体一路，字面略宽）。
   把 `NotoSerifSC-Medium/Bold` 加进 target 并在 Info.plist 的 `UIAppFonts` 里登记，
   `Typo.serif` 会自动改用它，**代码一行都不用改**。这是唯一影响保真度的替换。

2. **底部安全区**（Tab 栏已于 09-10 拆掉，这一条只剩顶部规则有效）。设计稿把 Tab 栏底部写死成 22pt —— Web 画框里没有真的 Home Indicator。
   真机取 `max(安全区, 22)`：参考机型看着和设计稿一致，带 Home Indicator 的机器也不会压上去。
   顶部同理，`designTopInset` 取 `max(设计值, 安全区 + 5)`，在参考机型上恒等于设计值。

3. **日记「记一下」按钮**（已随 Tab 栏拆除而过时，日记改为信箱抽纸）。原型里它被绝对定位的 Tab 栏盖住了（Web 端的定位疏漏）。
   这里给它让出了 Tab 栏的高度。「我的」页底部同样让了位，最后一个分区能滚干净。

4. **回复超时后重试**。原型把「……」气泡留在原地又追加一条新回复，看起来像猫说了两次。
   这里改成先撤掉超时气泡再重发前一句。

5. **长按菜单**。原型受运行时限制用的是单击；这里是真的 `onLongPressGesture`。
   「复制」接了 `UIPasteboard`，「删除」真的删本地这条（标了 `TODO: 后端`）。
   「反馈」还是空的 —— 上报格式交接文档里没写。

6. **聊天背景光斑**。CSS 的 `radial-gradient` 能分别给横竖半径，SwiftUI 的 `RadialGradient` 只有一个半径。
   这里画正圆再按比例拉成椭圆，四层光斑的中心、半径、渐隐位置和设计稿逐个对齐。

7. **状态句轮换**。原型里 `statusIdx` 恒为 0，永远只显示第一句；
   交接文档写的是「随机一句」，这里按文档来：猫每次换地点时随机取一句。

8. **深色模式**。全套令牌只有浅色一版，根视图锁 `.preferredColorScheme(.light)`。
   要做深色得先补一套令牌。

## 调试面板

`#if DEBUG` 里才有，Release 构建整个文件是空的。

原型是手机右边一块常驻面板；真机上没有那块地方，所以收成右上角一枚 `DEBUG` 小胶囊，
点开是底部抽屉。胶囊上的 `×` 可以把它收成一个几乎看不见的小点，再点一下又出来 ——
不会挡界面，也不会找不回来（状态存在 `UserDefaults` 的 `debug.chipVisible`）。

能做的事和原型一样：搬猫换地点、推进团子来过三态、全部回到未读、
强制下一条发送失败 / 回复超时、触发话题卡与新记录点、从零走创建流程、重置种子数据。

## 后端接入点

**聊天已经能接本机后端（09-12）。** 后端在仓库根目录的 `server/`，怎么跑见 `server/README.md`。
调试面板最上面的「后端」切到「本机后端 localhost:8787」，填上 `pnpm create-dev-user` 生成的 token 就行；
不切就还是本地 mock。网络层在 `Backend/Backend.swift`，聊天接后端的逻辑在 `Store/AppStore+Remote.swift`，
气泡状态和服务端事件的对应见 `docs/specs/后端-开发者版-2026-09-11.md` 第 8 节。

已接：发送、流式、停止、重试、断线续传、「记下了」、「不要再提」、「我的」页的记忆数和边界数、创建流程写猫的设定。
还是本地 mock 的（代码里标了 `TODO: 后端`）：

- **世界状态** —— 猫位置 + 状态句（`moveCat`）
- **日记碎片** —— 列表与团子访问状态（`entries` / `advanceVisit` / `saveCapture`）
- **记忆条目的查看、修改** —— 二级页还没做；后端已有 `GET /v1/memories`、`DELETE /v1/memories/:id`
- **消息的删除、反馈**

语音转写、记忆抽取、模型调用都在后端，前端只消费结果。

## 本版未做

跟交接文档的「本版未做」一致，代码里对应位置都标了 `TODO: 二级页`：

记忆条目列表与编辑、在聊话题列表、不要再提列表、相处分寸设置、数据导出与删除、
通知与声音详情页、显示与无障碍详情页、登录流程、聊天顶栏的「记录」入口、日记的搜索与折叠。

## 资产缺口

- **奶牛猫 / 黑猫 / 三花**三种外观待美术定稿。现在按设计稿画成占位灰圆、名称降级、不可点，
  说明尾部带「· 待定稿」。定稿后往 `Assets.xcassets` 加图，改 `CatAppearance.all` 的 `ready` 即可。
- **聊天头像**用的是全身图缩到 34pt，效果偏「橘色团块」。建议补一版头部裁切图，
  换掉 `MessageRow.avatarSlot` 里的图名就行。
- **App 图标**是空的占位 `AppIcon.appiconset`。

## 第 1 轮独立构图预览（09-26）

Debug 面板 → **3D 构图预览**；或启动参数 `-yardComposition`。场景是打包内的 3D 院子，保留原 2D 首页；首次设置截图机位，之后地点轨、全景与找团子只改变镜头。

- `-yardCompositionView house|bed|tree|grass|pond|fence|overview`：首次机位及截图猫位置。
- `-yardCompositionTime day|night`：白天晴或夜雨；`-yardCompositionUI YES|NO`：显示/隐藏评审控件。
- `-yardCompositionDemo YES`：程序驱动镜头演示，不是人工触摸证据。
- `-yardCompositionRecovery YES`：缩放浏览后的原生内容进程终止回调注入，不是真实系统杀进程。
- `-yardCompositionDuration 60`：60 秒渲染后自动保存量测并暂停；0 为不自动暂停。
- 量测写入 App 的 `Documents/yard-composition/`，失败会显示错误。真机截图、报告与边界见 [构图验收](../outputs/ios-3d-composition-review/验收报告.md)。

扩院预览（09-26）：新增 `-yardCompositionView comparison` 固定旧机位作前后比较；`-yardCompositionStroll YES` 以正常步速走扩展路线，也可从头像菜单启动。`tools/check_yard_expansion.py` 收集真机近景、夜雨全景、散步及回调恢复证据；截图脚本通过 `--output outputs/yard-expansion-review` 指定新目录。第二次布局图使用 `--output outputs/yard-layout-review`；详见 [最新布局验收](../outputs/yard-layout-review/验收报告.md)，原2D首页保留。
