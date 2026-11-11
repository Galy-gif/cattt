#!/bin/sh
# 调用者传入目标镜像和同一compose文件/环境；只回退代码，不逆迁移或删卷。
set -eu
previous_image=${1:?usage: sh rollback.sh previous-image --env-file env -f compose.yml}
shift
docker compose "$@" stop api worker
CATTT_IMAGE="$previous_image" AGENT_ENABLED=false docker compose "$@" up -d --no-deps --wait api worker
