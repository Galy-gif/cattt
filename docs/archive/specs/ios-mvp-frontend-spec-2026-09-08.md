# 猫猫 iOS · 第一版前端技术 Spec

日期 2026-09-08。状态：**待评审，未开始写代码**。评审通过后按第 12 节顺序开工。

本文只讲前端。后端、模型、记忆抽取、语音全部不在范围内，前端用 Mock 服务把它们的行为模拟出来，接口留好。

---

## 0. 已经定下的事（本文的前提）

| 决定 | 结论 | 出处 |
|---|---|---|
| 界面配色 | **B「院子里」** | `docs/决策-2026-09-08.md` §1，token 在 `design/tokens-palette-b.json` |
| 世界层 | **六场景整幅插画，一次显示一张，切换淡入**。猫已画在图里，第一版不做猫在场景里走动，不做横向滚动，不用 07 全景 | `docs/决策-2026-09-08.md` §3，飞书全景清单第二十一章 |
| 场景文件 | `assets/scenes/六个场景-绘本风-v2-hue+15/01–06.png`，853×1844 | 同上 |
| 团子界面层 | `assets/tuanzi/exports-ui/` 21 张 RGBA，@1x 311pt，脚底基线 274pt。只用在聊天、日记、我的、创建流程，不叠在世界图上 | `assets/tuanzi/exports-ui/README.md` |
| 范围 | P0 页面**全部一起做**，不分批 | 用户 2026-09-08 |
| 最低系统 | **iOS 18** | 用户 2026-09-08 |
| 工程生成 | **xcodegen**（已装，2.46.0），`project.yml` 进仓库，`.xcodeproj` 不进 | 用户 2026-09-08 |
| 一级导航 | 三个 Tab：陪伴 / 日记 / 我的。「日记」还是「回忆」的命名待确认，代码里用 `diary` | 飞书全景清单第十六章 |
| 产品红线 | 无打卡、无等级、无喂养压力、无计数驱动界面；网络失败不能包装成猫的情绪 | 飞书全景清单第十三、十四章 |

我之前提的「一张长卷 + 猫精灵 + 锚点」方案**作废**，以决策文档为准。

---

## 1. 范围

### 1.1 做

按飞书全景清单里标 P0 的页面，加上前端必须有的状态。完整清单见第 5 节。概括：

- 创建流程：欢迎 → 选外观 → 起始气质（含可选四特征微调）→ 命名 → 初次见面
- 陪伴主页：六场景、地点轨、找团子、一句状态、轻提示、聊会儿、点猫反馈
- 专注聊天：主页、生成中 / 停止、发送中 / 失败重试、上滑加载更早、回到最新、日记来源条、长按消息面板、聊天记录列表、历史搜索、搜索结果定位
- 日记：今天、搜索、月历、最近日期切换、当天详情与今日小记、月份归档、团子来过三态、留言转聊天、App 内记一下、碎片查看 / 编辑 / 删除
- 我的：主页、团子档案、改名、调整性格（复用创建流程组件）、相处分寸、记忆与隐私、记忆列表 / 详情 / 更正 / 删除、不要再提列表、我们一起生活、通知与声音、显示与无障碍、帮助与关于、数据导出 / 删除入口

### 1.2 不做（前端也不做）

| 项 | 原因 | 前端留什么 |
|---|---|---|
| 语音输入、语音陪伴 | P1 | 输入框里一个麦克风图标，点了不弹任何「准备中」提示，只有轻微按压反馈 |
| 系统级「记一下」（锁屏、Action Button、分享扩展、Siri） | 要 App Intents 和 Extension，真机验证 | 只做 App 内的「记一下」按钮和录入层 |
| 登录、注册、账号恢复、注销 | 登录方案未定 | 欢迎页「已经有猫了，登录」按钮存在但只弹一句「登录还没接」 |
| 图片消息（聊天里发图） | P1 候选 | 无 |
| 主动消息、推送、定时续聊 | P1 | 通知设置页存在，开关可切，无实际效果 |
| 性格场景预览（三场景并排看回应） | 需要真人格差异，Mock 只能演假的 | 气质卡片里的行为描述承担解释职责；设置里留「预览」入口，点了显示「等它有真性格再看」 |
| 声音选择与试听 | 随语音上线 | 无 |
| 深色模式 | 留给配色 C | 全部界面锁浅色，`preferredColorScheme(.light)` |
| iPad、横屏 | 无 | 只支持 iPhone 竖屏 |

---

## 2. 技术栈与工程结构

### 2.1 技术栈

- Swift 6 语言模式，SwiftUI，零第三方依赖。
- iOS 18.0 deployment target。不用 iOS 26 的液态玻璃 API，设计语言是不透明奶油色小面加 3 到 4pt 圆角，跟玻璃无关。
- 状态：`@Observable` 类做 Store，`@Environment` 注入。不用 Combine，不用 TCA。
- 导航：`TabView` + 每个 Tab 一个 `NavigationStack`，路由用枚举 `Route` 做 `navigationDestination`。
- 持久化：一个 `AppSnapshot: Codable` 写到 `Application Support/maomao/snapshot.json`。第一版不上 SwiftData，数据量小，JSON 更容易调试和重置。
- 并发：所有 Store 标 `@MainActor`；Mock 服务用 `AsyncStream` 吐流式事件。
- 时钟：`Clock` 协议注入，Mock 世界的昼夜和猫的位置用它算，测试和调试面板可以拨时间。

### 2.2 目录

```
app/
  project.yml                     xcodegen 配置
  Maomao/
    App/                          入口、根路由、环境装配
    DesignSystem/
      Tokens.swift                颜色、字号、间距、圆角（从 tokens-palette-b.json 手抄）
      Typography.swift
      Components/                 通用组件，见 4.4
    Features/
      Onboarding/                 创建流程
      Home/                       陪伴主页 + 世界层
      Chat/                       专注聊天、记录、搜索
      Diary/                      日记全部页面
      Me/                         我的全部页面
      Debug/                      调试面板
    Domain/
      Models/                     数据模型，见第 7 节
      Services/                   协议，见第 8 节
    Infra/
      Mock/                       Mock 实现
      Persistence/                JSON 快照
      Clock/
    Resources/
      Assets.xcassets
      Fonts/
      World/scenes.json           六场景元数据，见 6.3
      Mock/seed.json              演示用种子数据
  MaomaoTests/                    只测状态机和 Mock 服务，不测视图
```

`project.yml` 要点：一个 App target `Maomao`，一个测试 target；`DEVELOPMENT_LANGUAGE = zh-Hans`；Info.plist 里 `UISupportedInterfaceOrientations` 只留 Portrait；`ITSAppUsesNonExemptEncryption = NO`；Bundle ID 先用 `app.maomao.ios`，正式的等账号定。

### 2.3 仓库

当前目录不是 git 仓库。开工第一步 `git init`，`.gitignore` 排除 `*.xcodeproj`、`DerivedData`、`.DS_Store`。资料包（`assets/`、`design/`、`docs/`、`wireframes/`）留在原位，工程放 `app/`，工程用到的图从 `assets/` **复制**进 `Assets.xcassets`，不引用原路径。

---

## 3. 架构

三层，方向只能从上往下依赖：

```
View（SwiftUI）
  ↓ 读状态、调方法
Store（@Observable @MainActor）   每个 Feature 一个，持有该功能的全部 UI 状态
  ↓ 只通过协议
Service（协议）                    CatService / ChatService / DiaryService / MemoryService / WorldService
  ↑ 实现
Mock 实现（Infra/Mock）            第一版唯一实现；后端接上时换成网络实现，Store 和 View 不动
```

规则：

1. View 不直接碰 Service，不持有业务状态，只有本地的动画和焦点状态。
2. Store 不知道 Mock 的存在，只依赖协议。
3. 一个 `AppStore` 做根：当前猫、是否完成创建、Tab 选中项、待处理的深链（比如从日记留言跳聊天带的上下文）。各 Feature Store 从它拿猫的引用。
4. 所有会失败的操作返回 `Result` 或抛错，Store 把错误翻成具体的 UI 状态（贴在消息旁边、贴在碎片旁边），不弹全局 alert。

---

## 4. 设计系统

### 4.1 颜色（配色 B，一比一抄自 `design/tokens-palette-b.json`）

> **2026-09-08 晚二次修订：整支底色换成中性冷薄荷（色相 147°），圆角两档改四档，图标九档收敛到两档。**
> 完整推导见 `docs/archive/specs/视觉修订-参考travel-app-2026-09-08.md`，结论记在 `docs/决策-2026-09-08.md` §1.1。
> 卡片色（奶油 / 纯白）尚未定稿，代码里用 `Palette.whiteCards` 切换。

| Token | 值 | 用途 |
|---|---|---|
| `bg` | `#D5E2D7` | 页面底 |
| `card` | `#FFFFFF` | 卡片、输入框、列表面 |
| `rule` | `#B7CEBB` | 分隔线、卡片描边 |
| `ink` | `#1F3022` | 主文、图标线 |
| `ink2` | `#394C3C` | 正文 |
| `ink3` | `#5A705E` | 日期、说明、占位 |
| `chip` / `chipInk` | `#C4DAC7` / `#4C5945` | 标签 |
| `accent` / `accentInk` | `#C25A3E` / `#F8EDE6` | 唯一强调：主按钮、未读点、错误描边。极省 |
| `catNote` / `catNoteRule` / `catNoteInk` | `#F6EEDC` / `#E0D4B4` / `#A8865A` | 团子的留言、日记来源条 |
| `selected` / `selectedRule` | `#F6EEDC` / `#C25A3E` | 创建流程里选中的卡 |
| `private` / `privateRule` | `#DBEADE` / `#ACC5B0` 虚线 | 「只留给自己」碎片 |
| `toggleOn` | `#668C6C` | 开关开态 |
| `world.*` | 天 `#CFE3EA` 地 `#C6D9C4` 团子 `#E3A05C` 池塘 `#9FC0C2` 线 `#6B5B4A` 强调 `#D8705C` | 只给世界层上的 UI（地点轨、状态条、聊会儿按钮）和聊天虚化背景 |

「只留给自己」在飞书最新口径里已经取消单条开关，但画布上还留着这种碎片样式。第一版**保留样式、不做开关**：碎片模型里有 `visibility` 字段，Mock 种子里放一条私密碎片让样式能看到，界面上没有任何地方能把碎片设成私密。等口径定了再删。

### 4.2 字体

- 标题：**Noto Serif SC** 500 / 700，随包内置（OFL 许可）。画布里所有页面大标题和小节标题都是它。子集化到常用字，控制包体。
- 正文和 UI：系统 PingFang SC，走 `Font.system` 加 Dynamic Type。
- 字号阶梯（画布实测）：大标题 30、页内标题 25、小节 15 衬线、正文 15 行高 1.7、卡片正文 14.5 行高 1.75、说明 13、日期 12 字距 .12em、辅助 11、微标 10.5 字距 .04em。
- 数字用 `monospacedDigit()`。
- 支持 Dynamic Type 到 xxxLarge，再大的档位按 xxxLarge 封顶，世界层上的 UI 不随字号放大。

### 4.3 尺寸

- 圆角：卡片和输入框 3pt，按钮 4pt，气泡 12pt 带一个 3pt 的尖角（猫话左上尖、人话右上尖）。**没有大圆角**。
- 主按钮：高 46pt，横向内边距 19 到 20pt，字距 .08em，底部 2pt 硬阴影（`accent` 压暗到 `#9E4630`），按下时阴影收到 0 并下移 2pt。
- 列表行：最小高 46pt，分隔线左缩进 45pt。
- 页边距 22pt（日记、我的）、16pt（聊天）、14pt（输入区）。
- 底部 Tab 栏：自绘。参考 travel app 图一：**悬浮的白色圆角条**，高 60、圆角 22、左右内缩 20、离底边 `max(安全区, 16)`、软投影；
  三个图标（`IconSize.md` = 20）没有文字，选中项坐在 42pt 的珊瑚圆角方块（`radiusControl` 12）上。
  内容从它底下穿过，各页给它让 `TabBarView.height(bottomInset:)` = 60 + 底边距 + 8。
- 卡片、列表容器、输入框、时间片、信息片：**白底 + 软投影（`softShadow`），不描边**。只有私密碎片保留虚线。
- 日记页首四层：44pt 白色圆角方块按钮一行 → 两行衬线标题（22 中 / 34 粗）→ 信息片 → 筛选片（可筛：全部 / 语音 / 照片 / 只留给自己）。
- 陪伴主页的「聊会儿」胶囊高 38pt（`Metrics.chatPill`），比 `minTap` 矮，少压掉一条草地；
点按热区靠 `PrimaryButton` 的 `tapSlop` 在胶囊外补回 46pt。

### 4.4 通用组件

| 组件 | 说明 |
|---|---|
| `MaomaoTabBar` | 自绘三 Tab，支持「日记」上一个小圆点（新记录） |
| `PrimaryButton` | 主按钮，硬阴影，支持 `isLoading` |
| `CardSurface` | `card` 底 + `rule` 描边 + 3pt 圆角 |
| `GroupedList` | 分组列表容器，行 46pt，分隔线缩进 |
| `SelectableCard` | 创建流程和调整性格的选项卡，选中态换 `selected` |
| `SectionTitle` | 衬线小节标题 |
| `CatAvatar(expression:)` | 从 21 张导出图里按表情取，尺寸参数化，脚底基线对齐 |
| `PawTrail` | 走路脚印，两到三枚，交替、微旋转、大小变化，沿短斜线。用 `Canvas` 画，不用图片 |
| `TuanziMark` | 团子记号，实心，App 图标同源 |
| `HandDrawnIcon(name)` | 22 个线图标，Template Image，`renderingMode(.template)`，1.7pt 线宽 |
| `InlineToast` | 约 1 秒的行内轻提示（「记下了」「收好了」），带轻震 |
| `StatusLine` | 世界层上那一句状态，`rgba(239,230,210,.72)` 底，字距 .06em |
| `StreamingDots` | 三个 6pt 圆点从深到浅，生成中用 |

### 4.5 图标

来源 `design/icons.html` 的 22 个 SVG（3 导航、6 地点、13 功能），逐个导成单独 SVG 拖进 Asset Catalog，设 Template Image，勾 Preserve Vector Data。**不用 SF Symbols**，一个都不用，包括返回箭头。

App 图标：`assets/icons/svg/tuanzi-appicon.svg` 栅格成 1024。

### 4.6 动效原则

- 页面切换用系统默认 push。
- 场景切换淡入 320ms。
- 猫的反馈、脚印出现、轻提示：都在 200 到 400ms 之间，`easeOut`。
- 尊重「减少动态效果」：开启时场景切换改为直接替换，脚印不做出现动画。
- 没有弹跳、没有 spring 过冲。这个 App 的动感来自克制。

---

## 5. 页面清单与路由

每个页面给一个路由 ID，后面括号里是设计依据。「状态」列是前端必须做出来、能在调试面板里强制切换的。

### 5.1 根路由

| 条件 | 去哪 |
|---|---|
| 快照里没有猫 | 创建流程，从欢迎页开始；如有未完成的创建进度则从上次那一步继续 |
| 有猫 | 主 Tab，落在陪伴，镜头落在猫当前所在场景 |
| 带深链（日记留言 → 聊天） | 先切到陪伴 Tab 再 push 聊天页并带上下文 |

### 5.2 创建流程 `onboarding/*`（`design/onboarding/`）

| 路由 | 页面 | 内容 | 状态 |
|---|---|---|---|
| `welcome` | 欢迎 | 大标题「养一只只属于你的猫」，三句说明，「这里没有」四项反面清单（喂养任务、每日打卡、等级和金币、连续天数），「去认领一只」，「已经有猫了，登录」 | 登录按钮点了显示未接 |
| `pickCat` | 选外观 1/4 | 四张卡：橘猫可选，奶牛猫、黑猫、三花标「待定稿」置灰不可选。「就它了」 | 默认选橘猫 |
| `temperament` | 起始气质 2/4 | 四卡：慢热、黏人、安静、好奇，每张一句**行为**描述。「想再细调四个特征」展开四个三档滑杆（活力节奏、主动性、表达直接度、亲近表达），每档一句解释。「下一步」 | 展开 / 收起；微调后卡片显示「已微调」 |
| `naming` | 命名 3/4 | 木牌上显示名字，输入框，8 个推荐名分批显示「再换一批」，格式校验（1 到 8 个字，不含换行）。两句说明 | 空名禁用下一步；非法格式行内提示 |
| `firstMeeting` | 初次见面 4/4 | 世界层用草丛场景（04），猫先说「你来了。」停一下再说「我要怎么叫你？」，底部输入框。用户回一句后猫回一句带名字的话，然后「进院子」 | 猫说话逐句出现；输入为空时也可以「先不说」跳过 |

创建进度每一步写快照，退出后回来从当前步继续。完成时生成 `Cat` 和 `PersonalityProfile v1`，记录 `metAt`。

### 5.3 陪伴主页 `home`（`design/Main.dc.html`，`wireframes/陪伴主页状态-rev07/`）

| 元素 | 规格 |
|---|---|
| 世界层 | 当前显示的场景图铺满，`aspectFill`，图的上 8% 和下 12% 是给 UI 的留白区 |
| 地点轨 | 左侧竖排六个 34pt 圆钮，`rgba(239,230,210,.62)` 底，当前地点橙色，猫所在地点右侧一个 7pt 橙点。点击切换场景，淡入 |
| 一句状态 | 顶部居中 `StatusLine`，文案由 `WorldService` 给，如「团子在树下睡着了」 |
| 找团子 | 左下小字带下划线，`opacity .55`。**只在**用户看的场景不是猫所在场景时出现。点击回到猫的场景，不改猫的状态 |
| 聊会儿 | 右下主按钮，带聊天图标。push 聊天页 |
| 点猫 | 每个场景 JSON 里有猫的热区矩形。点中：场景图做一次 2% 的缩放回弹，状态句换成一句反应（「团子抬头看了你一眼」），400ms 后换回。热区外点击无反应 |
| 轻提示 | 同一时刻最多一条。三种：返回欢迎（进入 App 时状态句本身承担，不额外弹）、可继续话题（一张可关的小卡，「接着聊」进聊天并带话题）、新记录（Tab 栏日记图标小圆点 + 一次性行内提示「团子收好了一条」） |
| 底部 Tab | `MaomaoTabBar` |

**状态：** 猫在视野 / 猫不在视野；有话题卡 / 无；有新记录点 / 无；六个场景各一。

### 5.4 专注聊天 `chat/*`（`design/Chat.dc.html`，`wireframes/聊天状态-rev09/`）

| 路由 | 页面 | 内容 |
|---|---|---|
| `chat.main` | 专注聊天 | 综合色彩虚化背景（四个径向渐变，见画布）；顶部可收起的来源条（从日记或话题进来时才有）；消息列表猫左人右，猫话首条带 30pt 小头像，同一组连续猫话后续不带；输入区：输入框 + 麦克风占位 + 发送 / 停止按钮。**没有新建会话**。右上角一个「记录」入口进列表 |
| `chat.history` | 聊天记录 | 顶部常驻搜索框；按今天 / 昨天 / 日期分组；每组显示当日标题（Mock 生成）、末条摘要、时间；点进去定位到那天第一条。不显示 Tab 栏，不显示输入框 |
| `chat.search` | 历史搜索结果 | 关键词局部橙色高亮；结果带日期时间；点击进入原位置，高亮该条 2 秒；导航栏返回回到搜索结果 |

**消息状态机（用户消息）：** `draft → sending → sent`，失败进 `failed`。`failed` 保留原文，气泡加珊瑚色描边，下方「未发送 · 点按重试」。发送中气泡透明度 .6，下方「发送中…」。`sent` 不显示任何提示。发送键在 `sending` 期间禁用，防重复。

**回复状态机（猫）：** `waiting → streaming → done`，`streaming` 期间发送键变停止键，停止后进 `stopped`，已生成文字保留。`waiting` 显示 `StreamingDots`；超过 8 秒无首字进 `timeout`，气泡显示「它走神了 · 再试一次」，**不写成猫不想理你**。

**历史滚动：** 上拉到顶加载更早 20 条（Mock 有 200 条种子）；离底部超过一屏出现「回到最新」小钮；有新猫话且不在底部时小钮带数字。

**长按消息：** 面板四项：复制、删除、反馈（点赞 / 点踩，只记状态）、「不要再提」。「不要再提」只对猫话可用，选择后写入 `Boundary`，并在气泡下显示「已经记下了」。

**空状态：** 第一次进来没有消息时，猫先说一句（Mock 按气质给不同开场）。

### 5.5 日记 `diary/*`（`design/Diary.dc.html`，`wireframes/日记-rev19/`）

| 路由 | 页面 | 内容 |
|---|---|---|
| `diary.today` | 今天 | 顶部日期行 + 大标题「今天」+ 右侧搜索、日历两个图标；时间线：左列时间，右列碎片卡；碎片三种：语音（时长 + 转写 + 「原始转写，未整理」）、照片（图 + 一句）、文字；团子的留言卡（`catNote` 色，左侧团子记号锚点，署名「团子」，右下「聊聊」）；脚印态在碎片卡留白处画 `PawTrail`。往下滚出现「这个月」分组，只列有记录的日期卡。右下主按钮「记一下」 |
| `diary.capture` | App 内记一下 | 底部弹层：文字输入为主，麦克风占位，「记下了」行内提示 + 轻震后自动收起。第一版不做录音 |
| `diary.search` | 搜索 | 搜正文和转写，结果保留日期、类型、到访状态，高亮命中词。无结果状态 |
| `diary.calendar` | 完整月历 | 有记录的日期小圆点，读过未评论的日期两枚极小脚印；点日期看当天预览并可进入 |
| `diary.dateSwitcher` | 最近日期切换 | 点顶部日期行弹的底部面板，前后 7 天 |
| `diary.day` | 当天详情 | 完整时间线 + 页尾「今日小记」（Mock 生成，标「AI 整理 · 可编辑」，可编辑保存，可关闭） |
| `diary.entry` | 碎片查看 / 编辑 | 原文、时间、来源；编辑文字；删除带确认，说明「团子的留言和小记里引用它的部分也会一起去掉」 |
| `diary.month` | 月份归档 | 纵向只列有记录的日子，点进当天 |
| → `chat.main` | 留言转聊天 | 带来源条：碎片摘要 + 团子留言 |

**团子来过三态：** `unread` 无标记；`readNoComment` 只画脚印；`commented` 显示留言卡，**不再画脚印**。同一条碎片不能同时脚印和留言。三态由 Mock 按时间推进（碎片写入后 5 到 30 分钟内随机变为读过，其中约 40% 再变为有留言，每天最多 2 条留言）。

**空状态：** 今天没有碎片时显示一句「今天还没记什么」，不催。

### 5.6 我的 `me/*`（`design/Profile.dc.html`，`wireframes/我的-rev21/`）

| 路由 | 页面 | 内容 |
|---|---|---|
| `me.home` | 我的 | 顶部团子本人（`CatAvatar` 128pt）+ 名字 + 「在一起 N 天」，这一块是档案唯一入口。分组：「我们怎么相处」标签 + 一句主动频率说明；「它记得的事」三行（长期记忆 N 条、在聊的话题 N 个、不要再提的 N 条）；「设置」：新记录默认给团子看（开关）、通知与声音、显示与无障碍、帮助与关于。**没有齿轮**。 |
| `me.catProfile` | 团子的档案 | 名字、外观、相遇日期、起始气质、当前性格的自然语言说明。入口：改名、调整性格。不提供换猫、重建、改外观 |
| `me.rename` | 改名 | 输入 + 预览「团子会这样认自己」 |
| `me.personality` | 调整性格 | 复用创建流程的气质卡和四滑杆；跨两档以上或同时改多项时弹「身份连续性提醒」：未来行为会明显改变，历史不会被改写。保存生成新版本 |
| `me.together` | 我们一起生活 | 日期时间线：相遇第 N 天、碎片数、团子来过次数。**只是上下文，不是奖励** |
| `me.boundaries` | 相处分寸 | 称呼、给建议前先问、低落时少讲道理、不希望出现的词（可加多条）、主动来找频率（少 / 一般 / 多）、安静时段。自动保存，行内「已保存」 |
| `me.memory` | 记忆与隐私 | 记忆数量、查看与更正入口、记忆使用范围两个开关（形成新记忆 / 使用已有记忆，分开）、日记阅读规则说明、数据导出、数据删除（本页唯一红色） |
| `me.memoryList` | 长期记忆 | 按偏好 / 目标 / 重要事件分组；每条显示内容、来源（哪次对话）、时间、有效状态 |
| `me.memoryDetail` | 记忆详情 | 内容、来源消息（可跳转）、时间、状态；更正、删除 |
| `me.memoryEdit` | 更正 | 编辑内容，保存后旧版本标「已更正」 |
| `me.boundaryList` | 不要再提 | 列表，可撤销，撤销时说明「它以后可能会再提起」 |
| `me.notifications` | 通知与声音 | 开关若干，无实际效果 |
| `me.display` | 显示与无障碍 | 字号跟随系统、减少动态效果（读系统设置，显示状态） |
| `me.about` | 帮助与关于 | 版本号、几条常见问题（静态） |
| `me.export` / `me.delete` | 数据导出 / 删除 | 导出：选范围、提交、显示「处理中」「完成」「失败重试」四态（Mock 3 秒完成）；删除：确认流程 + 处理中 + 完成后回到欢迎页 |

---

## 6. 世界层规格

> **2026-09-09 改**：本节的「没有独立的猫图层」「每次只显示一张、切换淡入、不做横向连续滚动」已翻案。
> 现在是一张无猫长图 + 独立逐帧猫层 + 连续相机（跟随 / 自由 / 拖拽），猫换地点是走过去。
> 定版内容见 `docs/决策-2026-09-09.md`，下面保留的是 09-08 的原文，只作历史。

### 6.1 结构

陪伴主页 = 场景图（底）+ 世界层 UI（地点轨、状态句、找团子、聊会儿、轻提示）+ Tab 栏。**没有独立的猫图层**，猫在场景图里。

### 6.2 镜头规则

- 进入 App 落在猫所在场景。
- 地点轨切换的是「用户看的场景」`viewedLocation`，不改「猫在的场景」`catLocation`。
- `viewedLocation != catLocation` 时显示「找团子」，点击把 `viewedLocation` 设回 `catLocation`。
- 猫换场景时（Mock 每 20 到 90 分钟随机换，跟随时钟：夜里在猫窝或蘑菇屋，白天在草丛、池塘、栅栏、树屋）：如果用户正看着猫，镜头跟着淡入到新场景，状态句说「团子去池塘了」；如果用户看的是别处，只是「找团子」出现。

### 6.3 `scenes.json`

```json
{
  "locations": [
    {
      "id": "mushroomHouse", "name": "蘑菇屋", "icon": "loc-mushroom",
      "image": "scene-01", "catHotspot": {"x": 0.42, "y": 0.61, "w": 0.18, "h": 0.12},
      "uiSafeTop": 0.08, "uiSafeBottom": 0.12,
      "statusLines": ["团子在蘑菇屋门口打盹", "团子把脸埋进了垫子"]
    }
  ]
}
```

六个地点：`mushroomHouse` 蘑菇屋、`treeHouse` 树屋、`catBed` 猫窝、`grass` 草丛、`pond` 池塘、`fence` 栅栏上。热区坐标是相对场景图的比例，开工时从六张图上量。状态句每个地点先写 3 到 5 句，Mock 轮换。

### 6.4 图片

- 六张 853×1844 进 Asset Catalog，作为 @2x 放，不提供 @1x 和 @3x。在 iPhone 17 系列（@3x）上系统会用 @2x 放大，会略糊。**这是已知代价，第一版接受。** 要真机验收清晰度时，需要重出 1170×2532 以上的图。
- 图用 `.aspectFill` 铺满整个屏幕（含安全区），不同机型比例差异靠裁上下。上 8% 下 12% 的留白区在 19.5:9 机型上会被裁掉一小部分，UI 层用安全区布局，不依赖图里的留白。
- 首次显示前把六张预热解码到内存（约 6 × 6MB），切换才能真淡入不卡。

### 6.5 猫的反馈

点热区：场景图 `scaleEffect` 1.0 → 1.02 → 1.0 共 350ms，同时状态句换成反应句 2 秒。轻震一次。**不做猫的动画**，因为猫在图里。这是 P0 简化，飞书全景清单第五章明确允许。

---

## 7. 数据模型

全部 `Codable`、`Identifiable`、`Sendable`。ID 用 `UUID`。时间用 `Date`。

```swift
struct Cat { id, name, appearance: CatAppearance(.orange 唯一可选), metAt: Date, profileVersion: Int }

struct PersonalityProfile {
  id, catId, version, effectiveAt, source: .userCreated | .userEdited
  preset: Temperament(.slow | .close | .quiet | .curious)
  traits: VisibleTraits { energyRhythm, initiative, directness, closeness: Level(.low|.medium|.high) }
  summary: String   // 自然语言说明，Mock 按 preset + traits 拼
}

struct UserPrefs {            // 相处分寸
  addressAs: String           // 猫怎么称呼用户
  askBeforeAdvice: Bool
  lessLecturingWhenDown: Bool
  bannedPhrases: [String]
  initiativeFrequency: .low | .normal | .high
  quietHours: ClosedRange<Int>?
}

struct Message {
  id, role: .cat | .user, text, createdAt
  sendState: .draft | .sending | .sent | .failed          // user
  genState: .waiting | .streaming | .done | .stopped | .timeout   // cat
  feedback: .none | .up | .down
  sourceRef: SourceRef?       // 从日记或话题进来时挂的来源
}
struct DayIndex { date, title, lastSnippet, lastAt, firstMessageId }   // 聊天记录列表用，Mock 生成

struct DiaryEntry {
  id, createdAt, kind: .voice(duration, transcript) | .text | .photo(assetName, caption)
  visibility: .sharedWithCat | .privateOnly      // 见 4.1 说明，第一版界面不可改
  visit: CatVisit
}
enum CatVisit { case unread; case readNoComment(at: Date); case commented(CatNote) }
struct CatNote { id, text, at, entryId }
struct DailyNote { date, text, isEdited, isDismissed }

struct Memory { id, text, category: .preference | .goal | .event | .fact, sourceMessageId, createdAt, state: .active | .corrected(from: String) | .deleted }
struct Boundary { id, text, sourceMessageId, createdAt, revokedAt: Date? }
struct Topic { id, title, sourceMessageId, state: .open | .pinned | .done }

struct WorldState { catLocation: LocationID, since: Date, statusLine: String }

struct AppSnapshot {
  cat, profiles: [PersonalityProfile], prefs, messages, dayIndex,
  diary: [DiaryEntry], dailyNotes, memories, boundaries, topics,
  world, onboardingProgress: OnboardingStep?, settings: AppSettings, schemaVersion: Int
}
```

删除联动（前端在 Mock 里就要做对，后端接上时行为一致）：

| 操作 | 联动 |
|---|---|
| 删除碎片 | 它的 `CatNote` 一起删；当天 `DailyNote` 标「来源已变，需要重新整理」；聊天里引用它的来源条显示「原记录已删除」 |
| 删除记忆 | 状态置 `deleted`，列表隐藏，详情里的来源消息不删 |
| 不要再提 | 写 `Boundary`；对应 `Topic` 置 `done`；Mock 的话题推荐不再出它 |
| 删除消息 | 只删消息；派生的记忆和话题保留，并在记忆详情里显示「来源消息已删除」 |
| 数据删除 | 整个快照清空，回欢迎页 |

---

## 8. 服务协议与 Mock 行为

```swift
protocol CatService {
  func createCat(name:, appearance:, preset:, traits:) async throws -> (Cat, PersonalityProfile)
  func rename(_:) async throws
  func updatePersonality(preset:, traits:) async throws -> PersonalityProfile
  func firstMeetingReply(userLine: String?) -> AsyncStream<ChatEvent>
}

protocol ChatService {
  func send(_ text: String, context: SourceRef?) -> AsyncStream<ChatEvent>
  // ChatEvent: .userAccepted(id) | .userFailed(id, reason) | .catToken(id, String) | .catDone(id) | .catTimeout(id)
  func stop(_ messageId: UUID)
  func loadEarlier(before: UUID, limit: Int) async throws -> [Message]
  func search(_ query: String) async throws -> [SearchHit]
  func dayIndex() async throws -> [DayIndex]
  func delete(_ messageId: UUID) async throws
  func feedback(_ messageId: UUID, _ f: Feedback) async throws
}

protocol DiaryService {
  func entries(on: Date) async throws -> [DiaryEntry]
  func datesWithEntries(in month: Date) async throws -> [Date: DaySummary]
  func add(_ entry: DiaryEntry) async throws
  func update / delete
  func search(_ query: String) async throws -> [DiaryEntry]
  func dailyNote(for: Date) async throws -> DailyNote?
  func saveDailyNote(_:) async throws
  var visits: AsyncStream<CatVisitEvent> { get }     // 三态推进推给 Store
}

protocol MemoryService {
  func memories() / correct(id, text) / delete(id)
  func boundaries() / addBoundary(text, source) / revoke(id)
  func topics()
  func exportData() -> AsyncStream<TaskProgress>
  func deleteAllData() -> AsyncStream<TaskProgress>
}

protocol WorldService {
  var state: AsyncStream<WorldState> { get }
  func pokeCat() -> String          // 返回反应句
  func locations() -> [Location]
}
```

Mock 规则（全部可在调试面板调）：

| 行为 | 默认 |
|---|---|
| 用户消息发送 | 300 到 800ms 后 `accepted`；失败率 8% |
| 猫首字延迟 | 600 到 1500ms；超时率 3%（触发 `timeout`） |
| 流式速度 | 每 40 到 90ms 一个字 |
| 猫回复内容 | 按 `preset` 从四套模板选，模板按用户消息长度和是否含「？」分支；含「记住」时回一句确认并写一条 `Memory`，气泡下显示「记下了」 |
| 猫换场景 | 每 20 到 90 分钟，随时钟分白天夜里 |
| 团子到访 | 碎片写入后 5 到 30 分钟读过；40% 有留言；每天最多 2 条留言 |
| 今日小记 | 当天 ≥ 2 条碎片时生成，延迟 10 秒 |
| 话题卡 | 每天最多出现一次，来自最近一条含「？」的用户消息 |
| 导出 / 删除 | 3 秒完成；失败率 10% |

种子数据 `seed.json`：一只叫「团子」的橘猫、慢热、相遇 16 天前；200 条聊天跨 12 天；31 条碎片跨 16 天，含语音、照片、文字、一条私密；6 次到访（3 留言 3 脚印）；37 条记忆、4 个话题、2 条不要再提。**这是演示用**，调试面板可以一键「从零开始」跳过种子。

---

## 9. 调试面板

Debug 构建下，我的页最底部长按版本号打开。Release 不编译进去。

- 配色：B / D 切换（D 的 token 也写进 `Tokens.swift`，只为对比，不算交付）
- 世界：把猫挪到任一场景；拨时钟到白天 / 夜里
- 聊天：强制下一条失败 / 超时 / 立刻完成；清空
- 日记：让某条碎片立刻变成读过 / 有留言；生成今日小记
- 提示：触发话题卡 / 新记录点
- 数据：重置为种子；从零开始；导出快照 JSON 到 Files
- 动效：模拟「减少动态效果」

---

## 10. 资产导入清单

| 源 | 目标 | 处理 |
|---|---|---|
| `assets/tuanzi/exports-ui/tuanzi-ui-*@{1,2,3}x.png` × 7 | `Assets.xcassets/Tuanzi/tuanzi-{expr}.imageset` | 直接放，`manifest.json` 里的基线写进 `CatAvatar` 常量 |
| `assets/scenes/六个场景-绘本风-v2-hue+15/01–06.png` | `Assets.xcassets/World/scene-0N.imageset` 作 @2x | 不动像素。07 全景不进 |
| `design/icons.html` 22 个 SVG | `Assets.xcassets/Icons/*.imageset` Template + Preserve Vector | 手工拆出来。团子记号 `fill=currentColor`，其余 `stroke=currentColor` |
| `assets/icons/svg/tuanzi-appicon.svg` | `AppIcon.appiconset` 1024 | 栅格化 |
| Noto Serif SC 500 / 700 | `Resources/Fonts/` | 子集化，`UIAppFonts` 登记 |
| `design/tokens-palette-b.json` | `Tokens.swift` | 手抄，写单元测试比对 JSON 防漂移 |

不进工程：物件库、三只候选猫、5a/5b、世界层九姿态、所有 wireframes 位图。

---

## 11. 验收清单（模拟器，iPhone 17 Pro 和 iPhone 17e 各跑一遍）

创建流程

- [ ] 冷启动无猫 → 欢迎页；中途退出 → 回到上次那步
- [ ] 奶牛猫、黑猫、三花不可选，视觉是置灰不是禁用感
- [ ] 四气质卡描述是行为不是形容词；微调展开四滑杆
- [ ] 空名、9 个字、含换行都不能下一步，提示贴在输入框下
- [ ] 初次见面猫先开口，两句间有停顿；跳过也能进院子

陪伴主页

- [ ] 进入落在猫所在场景；猫在视野时**没有**「找团子」
- [ ] 切到别的场景「找团子」出现，点击回到猫，猫的状态句不变
- [ ] 猫换场景时镜头跟随（在看猫）或只出「找团子」（没看猫）
- [ ] 点热区有反馈，点热区外无反应
- [ ] 同一时刻只有一条轻提示

聊天

- [ ] 发送中 → 已发送不出现任何「成功」提示
- [ ] 失败保留原文，点按重试成功后变正常
- [ ] 生成中停止，已生成文字保留；超时文案不是猫的情绪
- [ ] 上拉加载更早；离底一屏出「回到最新」；新猫话计数
- [ ] 长按猫话有「不要再提」，人话没有
- [ ] 记录列表无输入框无 Tab 栏；搜索结果点进去定位并高亮，返回回到结果

日记

- [ ] 三态互斥：脚印和留言不同时出现
- [ ] 「聊聊」进聊天带来源条，来源条可收起
- [ ] 删除碎片后它的留言消失，小记标注来源已变
- [ ] 月历只标有记录的日子；月份归档不补空白日期
- [ ] 记一下：记下了 + 轻震 + 自动收起，不弹聊天

我的

- [ ] 主页没有齿轮；档案只从顶部身份卡进
- [ ] 调整性格跨两档弹连续性提醒；保存后档案里版本号 +1
- [ ] 记忆更正后旧文可见；删除后列表不再出现，来源消息还在
- [ ] 不要再提撤销时有后果说明
- [ ] 导出四态都能强制出来；数据删除后回欢迎页
- [ ] 全站唯一红色是数据删除

通用

- [ ] 没有一个 SF Symbol；没有一个 emoji
- [ ] Dynamic Type xxxLarge 下无截断；世界层 UI 不放大
- [ ] 减少动态效果开启时场景切换无淡入
- [ ] 锁浅色；横屏不旋转
- [ ] 任何错误都不弹全局 alert（数据删除确认除外）

---

## 12. 实施顺序

不按天排，按依赖排。每一步结束都能在模拟器里跑。

1. **骨架**：git init、`project.yml`、Tokens、字体、图标、Tab 栏、根路由、快照读写、调试面板空壳。能在三个空 Tab 之间切。
2. **世界层**：六场景、`scenes.json`、地点轨、找团子、状态句、点猫、`WorldService` Mock。
3. **创建流程**：五屏 + 进度恢复 + `CatService` Mock。此时冷启动到主页整条能走通。
4. **聊天**：主页 + 两个状态机 + `ChatService` Mock + 记录列表 + 搜索 + 长按面板。
5. **日记**：今天 + 三态 + 记一下 + 详情 / 编辑 / 删除 + 搜索 / 月历 / 切换 / 归档 + 留言转聊天。
6. **我的**：全部页面 + `MemoryService` Mock + 导出 / 删除。
7. **收口**：验收清单逐条过、Dynamic Type、减少动态效果、种子数据打磨、调试面板补全。

每步完成后我会发模拟器截图，不发文字描述。

---

## 13. 开放问题（不阻塞开工，但要在第 7 步之前定）

1. 一级导航叫「日记」还是「回忆」。代码里是 `diary`，改文案是一处。
2. 「只留给自己」碎片样式去留（见 4.1）。
3. 场景图要不要重出 @3x。影响真机清晰度，不影响代码。
4. 六张场景图上猫的热区坐标，开工第 2 步时我量出来给你确认。
5. 相处分寸的具体字段。第一版按 wireframes rev21 的六项做，飞书标「字段待定」。
6. 初次见面用户回答「怎么叫你」之后，猫那句回应的文案。我先写四套按气质分。
