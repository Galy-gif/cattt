# 猫猫后端 · 开发者版

方案见 `docs/specs/后端-开发者版-2026-09-11.md`。这一版只在本机跑，不部署。

## 第一次跑

需要 Node 22 以上、pnpm、Docker（本机用 colima：`colima start`）。

```bash
cd server
pnpm install
cp .env.example .env          # 填 MAOMAO_DEEPSEEK_API_KEY；没有 key 就把 MODEL_PROVIDER 改成 mock
docker compose up -d --wait   # PG 和 Redis，只绑 127.0.0.1
pnpm db:migrate
pnpm create-dev-user 你的名字  # 打印 token，只显示这一次
pnpm dev                      # api（:8787）和 worker 一起起
```

试一句：

```bash
curl -N localhost:8787/v1/messages \
  -H "Authorization: Bearer <token>" -H 'content-type: application/json' \
  -d '{"client_message_id":"hello-1","text":"今天好累"}'
```

## 测试

```bash
pnpm typecheck
pnpm test                      # 记忆写入规则，连本机 PG
MODEL_PROVIDER=mock pnpm dev   # 另开一个终端：用假模型起服务
pnpm smoke                     # 逐条走验收：流式、续传、作废、停止、重试、记忆、删除、边界
```

`pnpm smoke` 每次新建一个临时账号，跑完删掉。假模型认几个测试标记：`[slow]` 放慢，`[fail]` 报错，`[fail1]` 只报错一次。

## 结构

| 目录 | 内容 |
|---|---|
| `src/api/` | 路由、SSE、token 校验 |
| `src/turns/` | 一轮回复：建轮次、生成、Redis 事件流、停止与作废、对话锁 |
| `src/runtime/` | 模型适配（DeepSeek / 假模型）、性格、上下文组装 |
| `src/worker/` | 记忆提取、边界整理、清理卡住的回复 |
| `src/db/` | 表定义；迁移 SQL 在 `drizzle/` |

改表：改 `src/db/schema.ts` → `pnpm db:generate --name 说明` → `pnpm db:migrate`。

## 看成本

```bash
docker compose exec postgres psql -U maomao -c \
  "select purpose, count(*), sum(input_tokens) input, sum(cache_read_tokens) cached, sum(output_tokens) output from model_calls group by 1"
```

## 2026-09-12 本轮优化

聊天已接 ToolLoopAgent，世界连接使用独立 SSE；新增每猫 Soul 与显式临时状态接口。后端与 iOS 协同变更、迁移顺序、验收结果和未完成能力见 [实施验收](../docs/specs/后端与Agent循环-实施验收-2026-09-12.md)。现有开发库升级前先停旧 API/worker，再执行 `pnpm db:migrate`；本轮迁移已在隔离库验证。

世界协议在前台小院和聊天都可运行，后台、引导和手动暂停不开放移动。get_weather 已接 Open-Meteo，必须明确城市、重名需消歧；当前天气为模型估算，附来源/时间/单位，总 3 秒超时，地理缓存 24 小时、天气缓存 10 分钟。公共端点仅用于本机非商业开发，商业服务需另配符合条款的方案。

本机 maomao 开发库已迁移至 0004；其它旧库需完整执行迁移，0004 修复旧删除阻断水位。Soul 当前接受明确调整，不自动从聊天推断人格；状态目前按显式有效期回到基线。运行 `pnpm dev` 启动本机服务，本轮隔离验证服务已停止。
