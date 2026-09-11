#!/usr/bin/env python3
"""提交前检查：让仓库只进该进的东西。规则见 docs/工作约定.md「提交」「落盘规矩」。

默认检查暂存区（git pre-commit 钩子调用）；--all 只报告当前跟踪文件里超标的，不拦。
拦下：单个超过 3MB 且不在 .repo-allow-large 里的文件；日志、录屏、构建产物；
新增的 docs/决策-*.md、docs/specs/*.md 没有登记到 docs/README.md。
绕过：git commit --no-verify，并在提交信息里写原因。
"""
import fnmatch, os, subprocess, sys

ROOT = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
LIMIT = 3 * 1024 * 1024
FORBIDDEN_SUFFIX = ('.log', '.mp4', '.mov', '.ipa', '.xcarchive')
FORBIDDEN_PARTS = ('/build/', '/DerivedData/', '.app/', '.dSYM/', '/node_modules/', '/__pycache__/', '/capture/')


def git(*a):
    return subprocess.check_output(['git', *a], text=True, cwd=ROOT, stderr=subprocess.DEVNULL)


def allowed_large():
    p = os.path.join(ROOT, '.repo-allow-large')
    if not os.path.exists(p): return []
    return [l.strip() for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')]


def size_in_index(path):
    try: return int(git('cat-file', '-s', f':{path}').strip())
    except subprocess.CalledProcessError: return 0


def main():
    patterns = allowed_large()
    if '--all' in sys.argv:
        over = [p for p in git('ls-files', '-z').split('\0') if p and os.path.exists(os.path.join(ROOT, p))
                and os.path.getsize(os.path.join(ROOT, p)) > LIMIT and not any(fnmatch.fnmatch(p, g) for g in patterns)]
        print(f'跟踪中超过 3MB 且不在白名单的文件：{len(over)} 个')
        for p in over[:50]: print('  ', p)
        return 0
    changed = [p for p in git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0') if p]
    added = set(p for p in git('diff', '--cached', '--name-only', '--diff-filter=A', '-z').split('\0') if p)
    errors = []
    for p in changed:
        low = '/' + p
        if p.endswith(FORBIDDEN_SUFFIX) or any(part in low for part in FORBIDDEN_PARTS):
            errors.append(f'不该提交的文件（日志 / 录屏 / 构建产物 / 逐帧截图）：{p}')
            continue
        n = size_in_index(p)
        if n > LIMIT and not any(fnmatch.fnmatch(p, g) for g in patterns):
            errors.append(f'文件 {n / 1e6:.1f}MB 超过 3MB：{p}（验收图请压缩到 1MB 内；确需原尺寸就登记到 .repo-allow-large）')
    docs = [p for p in added if (fnmatch.fnmatch(p, 'docs/决策-*.md') or fnmatch.fnmatch(p, 'docs/specs/*.md'))]
    if docs:
        try: index = git('show', ':docs/README.md')
        except subprocess.CalledProcessError: index = ''
        for p in docs:
            if os.path.basename(p) not in index:
                hint = '' if index else '（docs/README.md 的改动也要一起暂存）'
                errors.append(f'新文档没有登记到 docs/README.md：{p}{hint}')
    if errors:
        print('提交前检查没通过：', file=sys.stderr)
        for e in errors: print('  - ' + e, file=sys.stderr)
        print('规则见 docs/工作约定.md；确需绕过用 git commit --no-verify 并在提交信息里写原因。', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
