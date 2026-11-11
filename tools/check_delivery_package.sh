#!/bin/sh
set -eu
python3 - <<'PY'
from pathlib import Path
for name in ['server/Dockerfile','server/.dockerignore','server/deploy/compose.staging.yml','server/deploy/compose.local.yml','server/deploy/Caddyfile','server/deploy/Caddyfile.local']:
    assert Path(name).is_file(), name
s=Path('server/Dockerfile').read_text()
assert 'USER node' in s and 'pnpm@11.11.0' in s
s=Path('server/.dockerignore').read_text()
assert '.env' in s and 'node_modules' in s
s=Path('server/deploy/compose.staging.yml').read_text()
assert '${CATTT_IMAGE' in s and s.count('<<: *runtime') >= 2
assert 'DATABASE_URL' in s and 'REDIS_URL' in s
print('部署包：同镜像、配置隔离、密钥排除与HTTPS配置检查通过')
PY
