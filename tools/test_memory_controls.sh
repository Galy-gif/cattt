#!/bin/sh
# 独立数据库和 Redis，只用合成数据与 mock 模型；保留验收库供追查。
set -eu
cd "$(dirname "$0")/.."
review_db="maomao_memory_review_$(date +%Y%m%d%H%M%S)_$$"
review_redis="maomao-memory-review-redis-$$"
docker exec maomao-postgres-1 createdb -U maomao "$review_db"
docker run --rm -d --name "$review_redis" -p 127.0.0.1:16390:6379 redis:7.4-alpine >/dev/null
trap 'docker stop "$review_redis" >/dev/null 2>&1 || true' EXIT INT TERM
export DATABASE_URL="postgres://maomao:maomao@127.0.0.1:5432/$review_db"
export REDIS_URL=redis://127.0.0.1:16390
export MODEL_PROVIDER=mock
export MOCK_DELAY_MS=1
printf '验收数据库：%s\n' "$review_db"
cd server
pnpm db:migrate
pnpm typecheck
# 每个隔离测试文件会建连接池；限制并发，避免挤满本机PG连接与CPU。
pnpm test --maxWorkers=1 --testTimeout=15000 --hookTimeout=30000
