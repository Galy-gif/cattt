# 猫猫后端 · 开发者版

方案见 `docs/方案/后端-开发者版-方案-2026-09-11.md`。这一版只在本机跑，不部署。

## 第一次跑

需要 Node 22.12 以上、pnpm、Docker（本机用 colima：`colima start`）。

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

聊天已接 ToolLoopAgent，世界连接使用独立 SSE；新增每猫 Soul 与显式临时状态接口。后端与 iOS 协同变更、迁移顺序、验收结果和未完成能力见 [实施验收](../docs/方案/后端与Agent循环-实施与验收-2026-09-12.md)。现有开发库升级前先停旧 API/worker，再执行 `pnpm db:migrate`；本轮迁移已在隔离库验证。

世界协议在前台小院和聊天都可运行，后台、引导和手动暂停不开放移动。get_weather 已接 Open-Meteo，必须明确城市、重名需消歧；当前天气为模型估算，附来源/时间/单位，总 3 秒超时，地理缓存 24 小时、天气缓存 10 分钟。公共端点仅用于本机非商业开发，商业服务需另配符合条款的方案。

本机 maomao 开发库已迁移至 0004；其它旧库需完整执行迁移，0004 修复旧删除阻断水位。Soul 当前接受明确调整，不自动从聊天推断人格；状态目前按显式有效期回到基线。运行 `pnpm dev` 启动本机服务，本轮隔离验证服务已停止。

## 2026-10-19 日记同步与读取

`PUT /v1/diary` 以客户端ID与操作凭证幂等保存，版本冲突409返回当前记录；`GET /v1/diary?after_seq=0` 按账号分页读取。`cat_allowed`独立于存储，私密文字不创建模型读取待办。开放文字由常驻worker读取，结果提交前复核版本/许可；来源撤回统一停用派生上下文。聊天可传`diary_entry_id`，由服务端鉴权取原文。启动新代码前先运行`pnpm db:migrate`应用0006迁移。

本机后端受控验证118项测试通过；10-20真实模型本地凭证配置已修正，认证通过但余额不足，用户选择充值后继续；公网部署经用户确认另做。当前证据见[模型连接排查](../outputs/model-connection-review/验收报告.md)。详见[本轮报告](../outputs/diary-sync-review/验收报告.md)。

真实模型检查：`MODEL_PROVIDER=deepseek pnpm check:model`。只发送固定测试文字；认证、余额或生成失败均返回非零状态，不回退模拟模型。

## 2026-11-11 异步 Agent 第一段底座

后台投递改用 `pg-boss` 12.x（当前锁定 12.38.1）；Node 需 22.12+。`async_jobs` 仍是唯一权威待办：PG 认领、续租、控制最多三次尝试，永久失败直接结束。投递只有一次执行机会（`retryLimit: 0`），同一待办按 `ID.已尝试次数` 分开投递；同次未领取的投递合并，旧的失败或进行中投递不挡住下一次。投递失败不会删除 PG 待办，worker 每 15 秒恢复补投并独立清扫失去心跳的聊天。记忆/边界/日记读取/清扫的处理并发分别为 4/2/2/1。Redis 保留聊天事件流、续传及既有聊天控制协议，后台三类待办的投递与执行不再依赖 Redis。

`pg-boss.start()` 使用同一数据库中的独立 **`pgboss` schema**，由 pg-boss 自己建表、升级；连接用户需拥有创建该 schema/表的权限。本仓库的业务表位于 `public`，Drizzle 只从 `src/db/schema.ts` 及其显式导出生成迁移，迁移历史放在 `drizzle` schema；不要把 `pgboss` 表加入 Drizzle 定义，也不要用 push/introspect 接管它们。`pnpm db:migrate` 不迁移、不删除 pg-boss 的表。增量迁移 `0007_user_time_zone` 只为 `users` 加 `time_zone`（默认 `Asia/Shanghai`）；升级时先停旧 API/worker，迁移后再启动，首次启动自动准备投递 schema。回退时停新 API/worker 后恢复旧 BullMQ 代码；`async_jobs` 无变更，恢复扫描会补投，新增用户字段和 `pgboss` schema 可保留，不需要删数据。

鉴权后可 `PUT /v1/me/time-zone`，JSON 为 `{"time_zone":"Asia/Kuala_Lumpur"}`；用 `Intl.DateTimeFormat` 校验 IANA 时区，非法值返回 400。聊天“现在”、院子饮水时间、时间工具默认值与记忆提取日期均读该用户时区，未上报则沿用上海。iOS 的 local 模式每次启动按连接配置上报一次本机时区，失败静默，不影响连接与聊天。

实施与证据边界见[实施验收](../docs/方案/团子异步Agent与后端架构-实施与验收-2026-11-10.md)。

### 约好的事（第二段）

聊天工具 `schedule_followup` 只保存日期、钟点都明确的用户约定；`list_tickets` 后可用 `update_ticket` 直达已有约定或 `cancel_ticket` 撤回。“我的”列表也可改时间和取消。未实现托付执行、推送与每日猫日记后台。

worker 每30秒把到期约定写成 `clock:<ticket_id>:<due_at>` 事件和 PG 待办，经 pg-boss 投递。默认用户本地22:00–09:00安静，UTC时间不随用户换时区移动；发送时按当前时区复核。超过24小时只留信。事项、来源原话及“不要再提”在模型前和发布事务中都检查；Router失效时固定模板兜底。explicit 约定没有三次尝试后永久放弃的限制，临时故障和安静时段保留在 PG 重试。

新增 `ROUTER_MODEL=deepseek-flash` / `ROUTER_THINKING=disabled`，成本用途 `route`。本段只有 `followup_due` 生效；其余主动规则仅预置版本与档位。模型只提供合并措辞，不能撤销用户亲口约定的发送授权。输入按中文每字约1 token、其他每4字符约1 token估算至多3000 token，保留最近6条聊天并逐条压短；使用SDK结构化输出。复核按ID覆盖、120字内单条文字、禁词与快照外时间/姓名的轻量启发式，不要求逐字复述主题。

`GET /v1/tickets?status=open`、`PATCH /v1/tickets/:id`（`{when: ISO}`）、`POST /v1/tickets/:id/cancel`、`GET /v1/mailbox?after=seq`、`POST /v1/mailbox/:id/read` 均从鉴权账号取得归属。聊天历史新增 `ticket_id`；`GET /v1/messages?after=seq&limit=100` 由旧到新补拉，可连续翻页。世界流 `inbox` 只提示收据序号，聊天与信的内容仍从 PG 拉取。

主动消息持有既有 Redis 对话锁，发布时锁猫与会话行，`turn_id` 空、`ticket_id` 非空；不递增只代表用户输入的 `conversation.version`。iOS 生成回复时暂缓拉取，完成后合并新消息，不改待恢复轮次。发信及 outbox 收据在同一事务提交，每件每用途唯一；本段提示由持久化收据轮询重放，无外部推送副作用。

pg-boss 连接的 `statement_timeout` 从2秒放宽到60秒，让大表维护查询有合理时间完成。`dispatchJob` 请求侧仍最多等待2.5秒；失败不撤销已写的 PG 待办，恢复扫描继续补投。


## 2026-11-11 第三段：托团子的事

`WORKER_MODEL / WORKER_THINKING` 默认 `deepseek-flash / enabled`，`workerSlot()` 与独立mock执行者，模型账本用途 `errand`。升级先停旧API/worker，`pnpm db:migrate` 应用 `0010_errands`（`runs/run_steps`）及 `0011_errand_step_clock`（步骤开始时间，用于中断后的十分钟预算），再启动。只增加表/列，不改变旧表含义。

聊天工具 `start_errand {goal}` 保存60字内托付，成功返回 `ticket_id` 和 `queued`。每猫最多2件在办（等待回答也占一个），每个用户本地自然日至多5件进入在办；超出先以 `queued` 保存，30秒扫描按空位与本地新一天继续。日预算使用事项的 `local_day` 记实际准入日，取消/结束不返还当天名额。`list_tickets/cancel_ticket/update_ticket` 同时覆盖托付；补充用 `{ticket_id,text}`，直接保存 `ticket_inputs`，等待回答的同一run由此继续。HTTP `PATCH /v1/tickets/:id {text}` 同义；`GET /v1/tickets?status=all` 供iOS同一列表显示历史托付阶段，默认仍只查open。

后台沿用 `async_jobs` 与pg-boss，处理并发2；业务run的45秒租约每10秒续租，以attempt隔离过期执行者。每次让ToolLoopAgent完成一步，完整模型消息/工具观察、用量和已消费补充同事务检查点；恢复从最后完整步继续，带“先核对已有观察，不重复外部动作”。仅有 `get_time/get_weather/recall_memories/read_permitted_diary/report`；记忆复用聊天的来源/轮次抑制及边界许可，日记只读cat_allowed。不会提供联网检索、执行代码、写记忆、移动或发消息工具。

最多20步、累计8000输出token（含供应商计入output的思考token）、累计10分钟活动执行时间；等待回答和安静时段延期不占活动时间。崩溃后未完成步骤至恢复认领的时间保守计入预算，避免重启清零。408/429/5xx与明确网络错误在同一步递增退避重试3次，其余报failed；每次尝试入成本账本。report先按call_id存凭证再返回；progress不发布，ready写信+一句短通知，waiting只问一句，blocked/failed如实说明，dropped安静结束。等待问题按各次report凭证去重，同一最终用途只有一份收据。

出口在同一事务里复核归属、授权、消息/日记来源、边界、记忆开关与修订、新鲜度、安静时段和去重，持有既有Redis对话锁。会话version变化先重新判断；撤回来源后不继续把旧检查点观察交给模型。22:00–09:00的结果推迟到09:00；waiting产生24小时后无回答只安静等，不再追问。详情、自动化证据与未验边界见[实施记录](../docs/方案/团子异步Agent与后端架构-实施与验收-2026-11-10.md)。
