#!/bin/sh
# 前提：已启动 iPhone 模拟器并安装当前 Debug App；本机 maomao-postgres-1 正常运行。
# 使用独立验收数据库和临时 Redis，不访问开发者账号或真实模型。
set -eu
cd "$(dirname "$0")/.."
repo_dir=$(pwd)
e2e_db="maomao_continuity_e2e_$(date +%Y%m%d%H%M%S)_$$"
e2e_redis="maomao-chat-e2e-redis-$$"
xcrun simctl get_app_container booted com.maomao.app app >/dev/null
docker exec maomao-postgres-1 createdb -U maomao "$e2e_db"
# 保留独立数据库，方便失败后追查；不清理或迁移现有开发库。
printf '验收数据库：%s\n' "$e2e_db"
docker run --rm -d --name "$e2e_redis" -p 127.0.0.1:16389:6379 redis:7.4-alpine >/dev/null
trap 'docker stop "$e2e_redis" >/dev/null 2>&1 || true' EXIT INT TERM
export DATABASE_URL="postgres://maomao:maomao@127.0.0.1:5432/$e2e_db"
export REDIS_URL=redis://127.0.0.1:16389
export MODEL_PROVIDER=mock
cd "$repo_dir/server"
pnpm db:migrate
pnpm exec tsx scripts/test-chat-continuity.ts
