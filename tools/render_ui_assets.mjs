/** Vite 启动后运行。PLAYWRIGHT_MODULE 指向本机 playwright 的入口。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'ios/Maomao/Assets.xcassets');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 600, height: 1305 }, deviceScaleFactor: 1 });
 page.on('pageerror', e => console.error(e.message));
 await page.goto('http://127.0.0.1:5173/ui-assets.html');
 await page.waitForFunction(() => !!window.uiAssets, { timeout: 90000 });
 const files = [];
 async function save(name, data) {
  const ext = data.startsWith('data:image/png') ? 'png' : 'jpg';
  const bytes = Buffer.from(data.split(',')[1], 'base64');
  const folder = path.join(destination, name + '.imageset');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, name + '.' + ext), bytes);
  await fs.writeFile(path.join(folder, 'Contents.json'), JSON.stringify({ images: [{ filename: name + '.' + ext, idiom: 'universal' }], info: { author: 'xcode', version: 1 } }, null, 2) + '\n');
  files.push({ name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
 }
 for(const slot of ['dawn','day','dusk','evening','night']) for(const weather of ['clear','rain']) for(const place of ['house','bed','tree','grass','pond','fence']) {
  await save(`chat-3d-${slot}-${weather}-${place}`, await page.evaluate(([s,w,p]) => window.uiAssets.background(s,w,p),[slot,weather,place]));
 }
 for(const [name,clip,full] of [['tuanzi-ui-portrait','fence_grip',false],['tuanzi-ui-quiet','doze_idle',false],['tuanzi-ui-full','sit_idle',true]]) {
  await save(name, await page.evaluate(([c,f]) => window.uiAssets.portrait(c,f),[clip,full]));
 }
 await save('meeting-3d', await page.evaluate(() => window.uiAssets.meeting()));
 const models = {};
 for(const name of ['tuanzi','yard']) models[name] = crypto.createHash('sha256').update(await fs.readFile(path.join(root,`web/public/models/${name}.glb`))).digest('hex');
 const out=path.join(root,'outputs/native-ui-review/metrics');await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'assets.json'), JSON.stringify({ source:'web/ui-assets.html', models, files },null,2)+'\n');
 console.log(`Rendered ${files.length} assets, ${files.reduce((n,f)=>n+f.bytes,0)} bytes`);
} finally { await browser.close(); }
