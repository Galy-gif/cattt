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
