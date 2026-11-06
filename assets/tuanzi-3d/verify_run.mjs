/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_run.mjs
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


const {place}=await import(pathToFileURL(path.join(compiled,'../yard/layout.js')));
const {runHeading}=await import(pathToFileURL(path.join(compiled,'run-path.js')));
const {minimumClearance}=await import(pathToFileURL(path.join(compiled,'../yard/collision.js')));
const ENTRY={...place('grass').point,y:0},yaw=runHeading(ENTRY);assert.notEqual(yaw,null);
const cat=await fresh();cat.restorePose(ENTRY,yaw);cat.playRun();
let floor=1,clearance=10,travel=0,peakSpeed=0,plantedTravel=0,bodyLow=1,bodyHigh=-1;const stages=new Set();let previous=null;
for(let i=0;i<360;i++){
 cat.update(DT);cat.root.updateMatrixWorld(true);stages.add(cat.state);
 const mesh=cat.model.body[0];mesh.skeleton.update();
 for(let k=0;k<mesh.geometry.attributes.position.count;k++){const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,k);mesh.applyBoneTransform(k,v);v.applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,v.y);}
 if(cat.state==='run_stride'){bodyLow=Math.min(bodyLow,cat.position.y);bodyHigh=Math.max(bodyHigh,cat.position.y);}
 const snap=cat.snapshotActivity().run,paws=PAWS.map(n=>pos(cat,n));
 clearance=Math.min(clearance,minimumClearance(cat.position).clearance);
 travel=Math.max(travel,Math.hypot(cat.position.x-ENTRY.x,cat.position.z-ENTRY.z));
 if(previous){peakSpeed=Math.max(peakSpeed,Math.hypot(cat.position.x-previous.x,cat.position.z-previous.z)/DT);
  if(cat.state==='run_stride'&&previous.stage==='run_stride'&&snap.step===previous.step)for(let j=0;j<4;j++)if([0,1,1,0][j]!==snap.step%2)plantedTravel=Math.max(plantedTravel,paws[j].distanceTo(previous.paws[j]));
 }
 previous={stage:cat.state,step:snap?.step,paws,x:cat.position.x,z:cat.position.z};
}
const result={floor,clearance,travel,peakSpeed,plantedTravel,bodyBounce:bodyHigh-bodyLow,stages:[...stages]};console.log(result);
assert(result.bodyBounce>.01&&result.bodyBounce<.014);assert(floor>-.002);assert(clearance>.12);assert(travel>.77&&travel<.79);assert(peakSpeed>.35&&peakSpeed<.4);assert(plantedTravel<.001);assert(!cat.running&&cat.state==='idle');
const recovered=[];
for(const seconds of [.2,.8,1.8,3.2]){
 const a=await fresh();a.restorePose(ENTRY,yaw);a.playRun();advance(a,seconds);
 const snapshot=JSON.parse(JSON.stringify(a.snapshotActivity()));const b=await fresh();b.restorePose(a.position,a.facing);b.restoreActivity(snapshot);advance(b,DT);
 assert(a.position.distanceTo(b.position)<.015);b.stand();advance(b,1.2);assert(!b.running&&b.state==='idle');assert.equal(b.drinkCompletions,0);recovered.push(snapshot.state);
}
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const d=await fresh(),w=new Walker(d),h=new HomeBehavior(w,d);d.restorePose(ENTRY,0);w.restore('grass',true);h.restore({id:'run',place:'grass',activity:'run'},false);
for(let i=0;i<700;i++){d.update(DT);h.update();await Promise.resolve();}assert(h.settled&&!d.running&&!h.fallback);
// 再次请求会先沿路返回草地，再检查跑向；换地点时等待当前落脚和收势。
d.restorePose(ENTRY,yaw);w.restore('grass',true);d.playRun();advance(d,1);h.accept({id:'leave',place:'house',activity:'watch'});
const savedCat=JSON.parse(JSON.stringify(d.snapshotActivity())),savedHome=h.snapshot;
const e=await fresh(),w2=new Walker(e),h2=new HomeBehavior(w2,e);e.restorePose(d.position,d.facing);w2.restore('grass',true);e.restoreActivity(savedCat);h2.restore(savedHome.intent,savedHome.settled,savedHome.drinkDone,savedHome.execution);
for(let i=0;i<4200;i++){e.update(DT);h2.update();await Promise.resolve();}
assert(h2.settled&&!e.running);assert.equal(e.drinkCompletions,0);
await fs.mkdir(path.join(root,'outputs/tuanzi-run-review/metrics'),{recursive:true});await fs.writeFile(path.join(root,'outputs/tuanzi-run-review/metrics/runtime.json'),JSON.stringify({...result,recovered,exitToHouseRecovery:true},null,2)+'\n');
