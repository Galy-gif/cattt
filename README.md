# cattt · 猫猫 App

一个没有打卡、没有等级、没有喂养任务的陪伴 App：团子住在一个毛毡小院里，你来不来它都在过自己的日子。

**这个仓库是项目的唯一真相源。** 现在是什么样、为什么这样，只看这里。产品文档也在这里（`docs/产品/`），不再以飞书为准；本机的出图目录、AI 助手的记忆都只是输入；一条信息要算数，必须落进仓库。规则见 [工作约定](docs/工作约定.md)。

## 从这里开始

| 想知道 | 看 |
|---|---|
| 产品要做什么 | [`docs/产品/`](docs/产品/)：产品需求、功能与页面清单、猫的个体差异机制 |
| 做了哪些决定、为什么 | [`docs/决策-*.md`](docs/README.md#决策)，按日期从新往旧读 |
| 现行方案和实施记录 | [`docs/README.md`](docs/README.md) 的"现行"一节 |
| 怎么干活：出图、收图、验收、提交 | [`docs/工作约定.md`](docs/工作约定.md) |
| iOS 工程结构 | [`ios/README.md`](ios/README.md) |
| 后端 | [`server/README.md`](server/README.md) |
| 给 AI 助手的入口 | [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) |

## 现在的样子（2026-09-12）

- **导航**：没有底部 Tab 栏。院子就是首页；聊天是场景上的"聊会儿"，日记是院子里的信箱（点开抽出一张纸），"我的"是右上角头像按钮。
- **世界层**：柔软毛毡的横向长卷小院，镜头跟着团子。团子是逐帧动画：树窝进出、三方向走路、原地转身是 v5 帧；栅栏、池塘、打盹等仍是 v4 及更早的帧。v5 帧缺失时整段回退 v4。
- **聊天**：默认本地模拟；调试面板可以切到本机后端（`server/`，开发者版，只在本机跑）。
- **后端本轮改动**：工具循环、聊天移动、世界回执恢复、真实天气、Soul 与临时状态初版已接入；原开发库已迁移。范围与证据见 [实施验收](docs/specs/后端与Agent循环-实施验收-2026-09-12.md)。
- **最低系统**：iOS 17.0（`决策-2026-09-12.md` 定）。

## 跑起来

**App**：

```bash
open ios/Maomao.xcodeproj
```

选 iPhone 模拟器直接运行。增删文件后重建工程文件：

```bash
cd ios && python3 generate_project.py
```

**后端**：需要 Node 22+、pnpm、Docker（本机用 colima），步骤见 [`server/README.md`](server/README.md)。App 连本机后端：调试面板切到 local 并填 token，或者启动参数 `-backendMode local -backendToken <token>`。

**测试**：

```bash
# 世界层逻辑测试（在仓库根目录跑）
d=$(mktemp -d); for t in ios/Tests/*.swift; do
  swiftc ios/Maomao/Model/WorldScene.swift ios/Maomao/Model/WorldInteraction.swift ios/Maomao/Model/WorldCamera.swift "$t" -o "$d/$(basename "$t" .swift)" && "$d/$(basename "$t" .swift)" assets/scenes/courtyard-v4/scene.json || break
done
# 资源校验（传入构建好的 .app）
python3 assets/tools/validate_world_v4.py <Maomao.app 路径>
# 后端
cd server && pnpm typecheck && pnpm test
```

## 仓库地图

| 目录 | 放什么 |
|---|---|
| `ios/` | SwiftUI App、工程生成脚本、世界层逻辑测试 |
| `server/` | 开发者版后端：聊天流式、记忆、本地运行 |
| `assets/` | 美术源文件与出图委托单。`tuanzi/` 团子（`canonical/` 是唯一角色基准及其出处），`scenes/` 场景，`props/`、`icons/` 道具与图标，`cats/` 早期三只猫（历史） |
| `assets/tools/` | 素材产线脚本：收图验收、切帧打包、场景配置、资源校验 |
| `docs/` | 决策记录、现行方案、工作约定；`产品/` 是产品需求、功能与页面清单、猫的个体差异机制；`archive/` 是历史与已被取代的文档 |
| `outputs/` | 每一轮的出图交付（`*-delivery/`）与验收证据（`*-review/`、`world-v*/`） |
| `design/`、`wireframes/` | 早期设计画布与线框稿，历史参考；现行界面以 App 为准 |
| `tools/`、`.githooks/` | 仓库维护：提交前检查 `repo_check.py`（大文件、日志录屏、文档登记），白名单 `.repo-allow-large` |

构建缓存、录屏、逐帧截图、本机缓存不进仓库（见 `.gitignore`）。提交前会自动检查大文件和文档登记，见 [工作约定](docs/工作约定.md#提交)。
