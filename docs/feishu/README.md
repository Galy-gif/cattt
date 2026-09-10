# 飞书文档本地镜像

猫猫 App 三份飞书文档的本地 Markdown 副本，2026-09-08 用 lark-cli 抓取。**飞书仍是真相源**，这里只是可离线读、可 grep、可给 Agent 喂上下文的镜像；改动请回飞书改，然后重跑刷新脚本。

| 文件 | 飞书原文 | 抓取时 revision | 表格 | 图片 |
|---|---|---|---|---|
| 猫猫功能与页面全景清单.md | https://my.feishu.cn/docx/N0urdST5LojCWMxe5NycAKjInlg | 188 | 28 | 54，在 assets/panorama/ |
| 猫的个体差异机制.md | https://my.feishu.cn/docx/KODZdLGbUoobNMxHNXccxV2FnFd | 4 | 13 | 0 |
| 猫猫产品需求文档-方向草案v0.2.md | https://my.feishu.cn/wiki/NSwzwJlf6iABKSklAQ8cA0WGnWb | 66 | 23 | 0 |

- `raw/` 是 lark-cli 返回的原始 JSON（DocxXML 含 block id），转换有疑问时对照它。
- `assets/panorama/` 文件名格式 `序号-飞书原文件名`，序号是图在文档中的出现顺序；图片和飞书原件 md5 一致。
- 表格里的换行转成了 `<br>`，表格内图片保留为 `![]()` 相对路径。
- 刷新：`bash tools/refresh.sh`。lark-cli 的 `--output` 只允许写到当前目录、/tmp 或 ~/files，脚本已绕开。
