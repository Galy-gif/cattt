/** 正式GLB同角色图标；图层渲染由Three.js负责，不重绘角色。 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(import.meta.dirname,'..');
const dir=path.join(root,'ios/Maomao/Assets.xcassets/AppIcon.appiconset');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5173/ui-assets.html');
 await page.waitForFunction(()=>!!window.uiAssets,{timeout:90000});
 const images=[];
 for (const appearance of ['default','dark','tinted']) {
  const data=await page.evaluate(a=>window.uiAssets.appIcon(a),appearance);
  const filename=`AppIcon-${appearance}.png`;
  await fs.writeFile(path.join(dir,filename),Buffer.from(data.split(',')[1],'base64'));
  images.push({idiom:'universal',platform:'ios',size:'1024x1024',filename,...(appearance==='default'?{}:{appearances:[{appearance:'luminosity',value:appearance}]})});
 }
 await fs.writeFile(path.join(dir,'Contents.json'),JSON.stringify({images,info:{author:'xcode',version:1}},null,2)+'\n');
 const out=path.join(root,'outputs/app-icon-review');await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'source.json'),JSON.stringify({modelSHA256:crypto.createHash('sha256').update(await fs.readFile(path.join(root,'web/public/models/tuanzi.glb'))).digest('hex'),renderer:'web/src/tools/ui-assets.ts#appIcon',size:1024},null,2)+'\n');
} finally {await browser.close();}
