/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_pond.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compiled = path.join(root, 'web/node_modules/.cache/tuanzi-check/src/tuanzi');
for (const file of ['tuanzi', 'model', 'procedural', 'metrics']) {
  const filename = path.join(compiled, `${file}.js`);
  const source = await fs.readFile(filename, 'utf8');
  await fs.writeFile(filename, source.replace(/from '(\.\/[^']+?)(?<!\.js)'/g, "from '$1.js'"));
}
const THREE = await import(pathToFileURL(path.join(root, 'web/node_modules/three/build/three.module.js')));
const { loadTuanzi } = await import(pathToFileURL(path.join(compiled, 'tuanzi.js')));
const bytes = await fs.readFile(path.join(root, 'web/public/models/tuanzi.glb'));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
delete gltf.images;
delete gltf.textures;
delete gltf.samplers;
for (const material of gltf.materials) {
  delete material.pbrMetallicRoughness?.baseColorTexture;
  delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  delete material.normalTexture;
  delete material.occlusionTexture;
  delete material.emissiveTexture;
}
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
json.copy(padded);
const binaryChunk = bytes.subarray(20 + jsonLength);
const header = Buffer.alloc(20);
header.write('glTF');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + binaryChunk.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const buffer = Buffer.concat([header, padded, binaryChunk]);
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, ...args) => url === 'tuanzi-memory.glb' ? new Response(buffer) : fetchOriginal(url, ...args);

const DT = 1 / 60;
const PAWS = ['front_L_paw', 'front_R_paw', 'hind_L_paw', 'hind_R_paw'];
const fresh = async () => {
  const cat = await loadTuanzi('tuanzi-memory.glb');
  assert(cat);
  cat.proceduralEnabled = false;
  return cat;
};
const advance = (cat, seconds, sample = () => {}) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    cat.update(DT);
    cat.root.updateMatrixWorld(true);
    sample(i);
  }
};
const pos = (cat, name) => cat.model.bones.get(name).getWorldPosition(new THREE.Vector3());
const report = {};


const {inPond,PondEffects}=await import(pathToFileURL(path.join(compiled,'../yard/pond-effects.js')));
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const cat=await fresh(),walker=new Walker(cat),home=new HomeBehavior(walker,cat);
walker.restore('pond',true);cat.restorePose({x:2.55,y:0,z:2.75},0);home.restore({id:'pond',place:'pond',activity:'watch'},false);
const mesh=cat.model.body[0],a=mesh.geometry.attributes,footIndex=mesh.skeleton.bones.findIndex(b=>b.name==='front_R_paw');
const indices=[];for(let i=0;i<a.position.count;i++)for(let j=0;j<4;j++)if(a.skinIndex.getComponent(i,j)===footIndex && a.skinWeight.getComponent(i,j)>.6){indices.push(i);break;}
const frames=[];let contacts=0,waterFrames=0,minY=1;
for(let f=0;f<1200;f++){
 cat.update(DT);home.update();await Promise.resolve();cat.root.updateMatrixWorld(true);
 if(!cat.state.startsWith('pond_'))continue;
 const paws=PAWS.map(n=>pos(cat,n).toArray()),paw=cat.pondPaw;
 const inside=inPond(paw.x,paw.z);if(inside)waterFrames++;if(inside&&paw.y-.029<.016)contacts++;
 minY=Math.min(minY,paw.y);let skinMin=Infinity;for(const i of indices){const v=new THREE.Vector3().fromBufferAttribute(a.position,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);skinMin=Math.min(skinMin,v.y);}
 frames.push({f,state:cat.state,paws,inside,skinMin});
}
await fs.mkdir('/tmp/maomao-pond',{recursive:true});await fs.writeFile('/tmp/maomao-pond/frames.json',JSON.stringify(frames));
console.log(JSON.stringify({states:[...new Set(frames.map(f=>f.state))],waterFrames,contacts,minY,position:cat.position.toArray(),settled:home.settled},null,2));
assert(cat.clipNames.length>=48);assert(home.settled);assert(contacts>30);
assert(frames.some(f=>f.inside&&f.skinMin<=.012));
let supportTravel=0;
for(const frame of frames)for(const i of [0,2,3]){
 const p=frame.paws[i];assert(!inPond(p[0],p[2]),'承重爪进入水面');
 supportTravel=Math.max(supportTravel,Math.abs(p[1]-.03));
}
assert(supportTravel<.005,'承重爪浮动');
const effects=new PondEffects();let lastTouch=false,strokes=0;
for(const frame of frames){const p=new THREE.Vector3().fromArray(frame.paws[1]);const touching=['pond_probe','pond_pat'].includes(frame.state)&&frame.inside&&p.y-.029<.016;if(touching&&!lastTouch)strokes++;lastTouch=touching;effects.update(DT,p,frame.state);}
assert.equal(strokes,3);assert.equal(effects.root.children.length,22);
const recovered=[];
for(const seconds of [.4,2,4.8,6.8,8.5]){
 const a=await fresh();a.playPond();advance(a,seconds);const saved=JSON.parse(JSON.stringify(a.snapshotActivity()));
 const b=await fresh();b.restoreActivity(saved);assert.equal(b.state,a.state);advance(b,12);assert.equal(b.state,'idle');assert.equal(b.drinkCompletions,0);
 const c=await fresh();c.restoreActivity(saved);c.stand();advance(c,2);assert.equal(c.state,'idle');assert.equal(c.drinkCompletions,0);recovered.push(saved.state);
}
await fs.mkdir(path.join(root,'outputs/tuanzi-pond-review/metrics'),{recursive:true});
await fs.writeFile(path.join(root,'outputs/tuanzi-pond-review/metrics/runtime.json'),JSON.stringify({clips:48,states:[...new Set(frames.map(f=>f.state))],contacts,strokes,minimumPawSurface:Math.min(...frames.filter(f=>f.inside).map(f=>f.skinMin)),supportVerticalError:supportTravel,threeSupportPawsOnShore:true,recovered,fixedEffectObjects:effects.root.children.length},null,2));
