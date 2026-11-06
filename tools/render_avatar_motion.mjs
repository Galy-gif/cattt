/** 同一正式模型离线渲染透明头像动作；不重渲已确认的静态配套图。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const files = [];
try {
 const page = await browser.newPage({ viewport: { width: 600, height: 1305 }, deviceScaleFactor: 1 });
 page.on('pageerror', e => console.error(e.message));
 await page.goto('http://127.0.0.1:5173/ui-assets.html');
 await page.waitForFunction(() => !!window.uiAssets, { timeout: 90000 });
 for (const [kind, count] of [['blink', 10], ['look', 73]]) {
  for (let i = 0; i < count; i++) {
   const name = `avatar-motion-${kind}-${String(i).padStart(2,'0')}`;
   const data = await page.evaluate(([k,t]) => window.uiAssets.motion(k,t), [kind,i/30]);
   const bytes = Buffer.from(data.split(',')[1], 'base64');
   const dir=path.join(root, 'ios/Maomao/Assets.xcassets',name+'.imageset');
   await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,name+'.png'),bytes);
   await fs.writeFile(path.join(dir,'Contents.json'),JSON.stringify({images:[{filename:name+'.png',idiom:'universal'}],info:{author:'xcode',version:1}},null,2)+'\n');
   files.push({name,kind,frame:i,time:i/30,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
 }
 const out=path.join(root,'outputs/avatar-motion-review');await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'assets.json'),JSON.stringify({fps:30,size:256,modelSHA256:crypto.createHash('sha256').update(await fs.readFile(path.join(root,'web/public/models/tuanzi.glb'))).digest('hex'),files},null,2)+'\n');
 console.log(`Rendered ${files.length} frames; ${files.reduce((n,f)=>n+f.bytes,0)} bytes`);
} finally {await browser.close();}
