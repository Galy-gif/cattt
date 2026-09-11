# 给 AI 助手的入口（与 CLAUDE.md 内容相同）

这个仓库是猫猫 App 的**唯一真相源**。开始任何工作前按顺序读：

1. [README.md](README.md)：项目现状、怎么跑、仓库地图。
2. [docs/README.md](docs/README.md)：文档索引。先读最新的 `docs/决策-*.md`，已经定了的事不要重新提案。
3. [docs/工作约定.md](docs/工作约定.md)：出图、收图、验收、提交的规矩。

## 硬规矩

- 先写方案（`docs/specs/`）给用户评审，再动代码。
- 只在用户要求时提交、推送；删除和其它不好撤回的动作先确认。
- 你的会话记忆、用户的个人笔记都不是真相源。有价值的结论写进仓库，登记到文档索引。
- 出图委托与收图验收按工作约定的六条和五道关；验收先跑哈希、先量数再看图。
- 工程文件用 `ios/generate_project.py` 生成；场景配置用原地修改的脚本，不要重跑 `configure_world_v4.py`。
- 界面文案和文档用中文；没有打卡、等级、任务、连续天数这类措辞。

## 常用命令

```bash
# 世界层逻辑测试（仓库根目录）
d=$(mktemp -d); for t in ios/Tests/*.swift; do swiftc ios/Maomao/Model/WorldScene.swift ios/Maomao/Model/WorldInteraction.swift ios/Maomao/Model/WorldCamera.swift "$t" -o "$d/$(basename "$t" .swift)" && "$d/$(basename "$t" .swift)" assets/scenes/courtyard-v4/scene.json || break; done
# 模拟器构建
xcodebuild -project ios/Maomao.xcodeproj -scheme Maomao -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath /tmp/maomao-build build
# 后端
cd server && pnpm typecheck && pnpm test
# 提交前检查（钩子会自动跑；每台机器先设一次 git config core.hooksPath .githooks）
python3 tools/repo_check.py
```

## 每轮收尾

新决定写进决策记录并登记；过时文档标注或归档；状态行改成真实状态；中间产物和录屏不进暂存区；仓库外的新"真相"收进来。详见 [工作约定](docs/工作约定.md#每轮收尾清单)。
