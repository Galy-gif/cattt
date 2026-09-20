import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const path = resolve(dir, item.name);
    // 生成目录里的 app.html 引用上轮 JS，不能混入本轮源码摘要。
    if (path === resolve(root, 'ios/Maomao/Resources/YardWeb')) return [];
    return item.isDirectory() ? sourceFiles(path) : /\.(swift|ts|html)$/.test(item.name) ? [path] : [];
  });
}


/**
 * 给 iOS App 打的包：只有 app.html 这一页（画布 + 两个 glb），不带首页和字体。
 * 输出到 App 的资源目录，Xcode 工程把它当整个文件夹引用（见 ios/generate_project.py）。
 * 产物不进仓库（.gitignore），构建 App 前先 `pnpm --dir web build:ios`。
 */
export default defineConfig({
  plugins: [{
    name: 'yard-probe-provenance',
    generateBundle() {
      const files = [...sourceFiles(resolve(root, 'web/src')), ...sourceFiles(resolve(root, 'ios/Maomao')),
        resolve(root, 'web/app.html'), resolve(root, 'web/vite.ios.config.ts')].sort();
      this.emitFile({ type: 'asset', fileName: 'probe-build.json', source: JSON.stringify({
        schemaVersion: 2,
        builtAt: new Date().toISOString(),
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
        sourceHash: sha(files.map(path => relative(root, path) + ':' + sha(readFileSync(path))).join('\n')),
        sourceHashScope: 'web/src + ios/Maomao 源文件 + app.html + vite.ios.config.ts；排除生成的 YardWeb',
        modelHashes: Object.fromEntries(['yard', 'tuanzi'].map(name => [name, sha(readFileSync(resolve(root, `web/public/models/${name}.glb`)))])),
      }, null, 2) });
    },
  }],
  build: {
    target: 'es2023',
    outDir: '../ios/Maomao/Resources/YardWeb',
    emptyOutDir: true,
    rolldownOptions: {
      input: { app: 'app.html' },
    },
  },
});
