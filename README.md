# cattt · 猫猫 App

一个没有打卡、没有等级、没有喂养任务的陪伴 App：团子住在一个毛毡小院里，你来不来它都在过自己的日子。

**这个仓库是项目的唯一真相源。** 现在是什么样、为什么这样，只看这里。产品文档也在这里（`docs/产品/`），不再以飞书为准；本机的出图目录、AI 助手的记忆都只是输入；一条信息要算数，必须落进仓库。规则见 [工作约定](docs/工作约定.md)。

## 从这里开始

| 想知道 | 看 |
|---|---|
| 产品要做什么 | [`docs/产品/`](docs/产品/)：产品需求、功能与页面清单、猫的个体差异机制 |
| 做了哪些决定、为什么 | [`docs/决策/*.md`](docs/README.md#决策)，按日期从新往旧读 |
| 现行方案和实施记录 | [`docs/README.md`](docs/README.md) 的"现行"一节 |
| 怎么干活：出图、收图、验收、提交 | [`docs/工作约定.md`](docs/工作约定.md) |
| iOS 工程结构 | [`ios/README.md`](ios/README.md) |
| 后端 | [`server/README.md`](server/README.md) |
| 给 AI 助手的入口 | [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) |

## 现在的样子（2026-09-12）

- **导航**：没有底部 Tab 栏。院子就是首页；聊天是场景上的"聊会儿"，日记是院子里的信箱（点开抽出一张纸），"我的"是右上角头像按钮。
- **世界层**：柔软毛毡的横向长卷小院，镜头跟着团子。团子是逐帧动画：树窝进出、三方向走路、原地转身是 v5 帧；栅栏、池塘、打盹等仍是 v4 及更早的帧。v5 帧缺失时整段回退 v4。**这套 2D 世界层 2026-09-27 起冻结，只修阻断性 bug；开发准线是 3D（`web/` 的院子与 3D 团子），见 [决策](docs/决策/2026-09-27-3D为准线.md)。**
- **聊天**：默认本地模拟；调试面板可以切到本机后端（`server/`，开发者版，只在本机跑）。
- **后端本轮改动**：工具循环、聊天移动、世界回执恢复、真实天气、Soul 与临时状态初版已接入；原开发库已迁移。范围与证据见 [实施验收](docs/方案/后端与Agent循环-实施与验收-2026-09-12.md)。
- **最低系统**：iOS 17.0（`docs/决策/2026-09-12.md` 定）。
- **iOS 换成网页版的视觉**（2026-09-17 定，09-18 定走 WKWebView 内嵌）：世界层和界面都换，2D 世界层在 3D 逐项对齐前继续用。第 0 轮已选定 ×1.5 完整效果；针对真机录屏确认的 12 次运行期画布闪空、镜头自动回弹和多处穿模，A/B/C 修复已实施。最终修复版在 iPhone 16 Pro Max 连续运行 7 分 34 秒，性能、触摸和轨迹净距过线，用户确认无白闪、镜头回弹/跳动或穿模。最终系统录屏逐帧复核也已通过：冷启动约 0.78 秒见到 3D、约 0.92 秒稳定，倍率循环 53.6 秒无闪空，内容进程终止后约 0.52 秒稳定恢复，连续三次重开均在 0.9 秒内稳定且无白屏；故障注入报告仍按硬规则记为“未通过”。App 与 WebContent 合计内存峰值 281.27MB，低于 450MiB；拔线 Power Profiler 采样中位 12.23%/小时、亮度 52%、热状态 fair。**第 0 轮已通过**，结论只覆盖这台 iPhone 16 Pro Max；第 1 轮独立构图预览已实施：双指缩放、全景与找团子、七处真机画面及夜雨复核；用户要求总览只覆盖院子，并扩展真实院内空间、少量添景，形成开阔的半山小院；已按确认后的[扩展方案](docs/方案/半山小院扩展与总览收紧-方案-2026-09-26.md)实现草地与路线扩展、少量添景；后续按看图反馈放大屋／池、延长栅栏、移除木牌并把石路整理成环路；[最新真机评审图与报告](outputs/yard-layout-review/验收报告.md)已交付，布局协调性待用户评审，首页接入尚未开始。见 [第一轮构图方案](docs/方案/iOS-第一轮竖屏构图与全景-方案-2026-09-26.md)。见 [问题修复方案](docs/方案/iOS-白闪自由滑动与3D穿模-方案-2026-09-20.md)、[原方案](docs/方案/iOS-3D世界层与界面同步-方案-2026-09-17.md) 与 [实施验收](docs/方案/iOS-3D世界层与界面同步-实施与验收-2026-09-20.md)。
- **电脑网页版**（2026-09-17 起）：展示页，three.js 做的 3D 院子和 3D 团子，滚动带镜头走过院子六处地点，五个时段 × 晴雨。三轮交付（结构、材质与天色、合并）都已实施（分支 `web-desktop`）；团子的建模还在优化。见 [决策](docs/决策/2026-09-17-网页版.md) 与 [实施与验收](docs/方案/网页版-院子页面与天气-实施与验收-2026-09-17.md)。

## 跑起来

**App**：

```bash
open ios/Maomao.xcodeproj
```

选 iPhone 模拟器直接运行。App 里的 3D 院子（调试面板的实测页）读的是打进包里的网页版，构建 App 前先打一次（产物在 `ios/Maomao/Resources/YardWeb/`，不进仓库）：

```bash
pnpm --dir web build:ios
```

增删文件后重建工程文件：

```bash
cd ios && python3 generate_project.py
```

**后端**：需要 Node 22+、pnpm、Docker（本机用 colima），步骤见 [`server/README.md`](server/README.md)。App 连本机后端：调试面板切到 local 并填 token，或者启动参数 `-backendMode local -backendToken <token>`。

**网页版**：需要 Node 22+、pnpm。

```bash
pnpm --dir web install
pnpm --dir web dev        # 首页 http://localhost:5173/ ，团子调试页 /tuanzi.html ；调试面板加 ?debug=1
pnpm --dir web typecheck && pnpm --dir web build
```

改了院子物件或落点要重新生成：`python3 assets/yard-3d/make_paths.py`、`blender -b --factory-startup -P assets/yard-3d/build_yard.py`（见 [`assets/yard-3d/README.md`](assets/yard-3d/README.md)）。

**测试**：一把跑完本机能跑的全部检查：

```bash
sh tools/check_all.sh
```

它依次跑：`tools/repo_check.py --all`（大文件、日志、文档登记）、`tools/check_shared_rules.py`（行为表与关键帧等跨端规则、生成物是否与源同步）、`tools/check_world_logic.sh`（iOS 世界层逻辑测试）、网页 typecheck 与 `test:app`、后端 typecheck。`tools/repo_check.py` 和 `tools/check_shared_rules.py` 也挂在 pre-commit 钩子上。

分开跑：`sh tools/check_world_logic.sh`、`pnpm --dir web test:app`、`cd server && pnpm test`（要本机 PG/Redis）。资源校验传入构建好的 .app：`python3 assets/tools/validate_world_v4.py <Maomao.app 路径>`。

## 仓库地图

| 目录 | 放什么 |
|---|---|
| `ios/` | SwiftUI App、工程生成脚本、世界层逻辑测试 |
| `server/` | 开发者版后端：聊天流式、记忆、本地运行 |
| `assets/` | 美术源文件与出图委托单。`tuanzi/` 团子（`canonical/` 是唯一角色基准及其出处），`scenes/` 场景，`props/`、`icons/` 道具与图标，`cats/` 早期三只猫（历史） |
| `assets/tools/` | 素材产线脚本：收图验收、切帧打包、场景配置、资源校验 |
| `assets/tuanzi-3d/` | 电脑网页版的 3D 团子：Blender 建模脚本、`.blend`、烘好的贴图、与 R3 的剪影对比脚本（见 [`README`](assets/tuanzi-3d/README.md)） |
| `assets/yard-3d/` | 电脑网页版的 3D 院子：2D→3D 落点换算、路网导出脚本、Blender 建模脚本与 `.blend`（见 [`README`](assets/yard-3d/README.md)） |
| `web/` | 电脑网页版（Vite + three.js）：`index.html` 是首页（院子 + 整页，`web/src/yard/`、`web/src/page/`、`web/src/render/`），`tuanzi.html` 是团子小样调试页，`web/src/tuanzi/` 是团子运行时 |
| `docs/` | `README.md` 是文档索引，`工作约定.md` 是干活的规矩；`决策/` 按日期记"定了什么"，`方案/` 放现行方案与实施验收，`产品/` 是产品需求、功能与页面清单、猫的个体差异机制，`参考/` 是外部资料 |
| `outputs/` | 每一轮的出图交付（`*-delivery/`）与验收证据（`*-review/`、`world-v*/`） |
| `design/`、`wireframes/` | 早期设计画布与线框稿，历史参考；现行界面以 App 为准 |
| `tools/`、`.githooks/` | 仓库维护：提交前检查 `repo_check.py`（大文件、日志录屏、文档登记），白名单 `.repo-allow-large` |

构建缓存、录屏、逐帧截图、本机缓存不进仓库（见 `.gitignore`）。提交前会自动检查大文件和文档登记，见 [工作约定](docs/工作约定.md#提交)。
