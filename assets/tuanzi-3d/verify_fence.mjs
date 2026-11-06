/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_fence.mjs
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


const {FENCE_ENTRY}=await import(pathToFileURL(path.join(compiled,'fence-motion.js')));
const cat=await fresh();cat.restorePose(FENCE_ENTRY,Math.PI);cat.enterFence();
const frames=[];const mesh=cat.model.body[0];
function contact(){
 let min=Infinity,penetration=0,worst=null;
 for(let j=0;j<mesh.geometry.attributes.position.count;j++){
  const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,j);mesh.applyBoneTransform(j,v);v.applyMatrix4(mesh.matrixWorld);
  const q=[Math.abs(v.x-3.15)-(.45-.018),Math.abs(v.y-.475)-(.025-.018),Math.abs(v.z+3.10)-(.14-.018)];
  const sdf=Math.hypot(...q.map(x=>Math.max(0,x)))+Math.min(Math.max(...q),0)-.018;
  if(sdf<0&&-sdf>penetration){penetration=-sdf;worst={point:v.toArray(),vertex:j};}
  min=Math.min(min,v.y);
 }
 return {min,penetration,worst};
}
for(let i=0;i<660;i++){
 cat.update(DT);cat.root.updateMatrixWorld(true);
 const {min,penetration,worst}=contact();
 frames.push({i,state:cat.state,phase:cat.snapshotActivity().fence?.time,facing:cat.facing,root:cat.position.toArray(),paws:PAWS.map(n=>pos(cat,n).toArray()),min,penetration,worst});
}
await fs.mkdir('/tmp/maomao-fence',{recursive:true});await fs.writeFile('/tmp/maomao-fence/frames.json',JSON.stringify(frames));
console.log(JSON.stringify({states:[...new Set(frames.map(f=>f.state))],rest:frames.at(-1),maxPenetration:Math.max(...frames.map(f=>f.penetration))},null,2));
assert(cat.clipNames.length>=60);
assert(cat.fenceSettled);
assert(Math.max(...frames.map(f=>f.penetration))<.001,'横木穿入超过1mm');
const rest=frames.filter(f=>f.state==='fence_rest');
assert(rest.every(f=>f.paws.every(p=>Math.abs(p[1]-.529)<.004&&p[0]>2.70&&p[0]<3.60&&p[2]>-3.24&&p[2]<-2.96)),'趴卧爪子未落在横木');
const turn=frames.filter(f=>f.state==='fence_turn');
let plantedSlip=0,maximumStepLift=0;
for(let i=1;i<turn.length;i++){
 const a=turn[i-1],b=turn[i];
 const stance=(frame,leg)=>{
  const t=frame.phase/2,q=Math.max(0,Math.min(1,(t-.1)/.8))*4,step=Math.min(3,Math.floor(q)),phase=Math.min(1,q-step);
  const first=[0,3].includes(leg),lo=first?.02:.54,hi=first?.46:.98;
  return {step,planted:phase<lo||phase>hi};
 };
 for(let leg=0;leg<4;leg++){
  const p=stance(a,leg),q=stance(b,leg);
  if(p.step===q.step&&p.planted&&q.planted)plantedSlip=Math.max(plantedSlip,Math.hypot(a.paws[leg][0]-b.paws[leg][0],a.paws[leg][2]-b.paws[leg][2]));
  maximumStepLift=Math.max(maximumStepLift,b.paws[leg][1]-.531);
 }
}
assert(plantedSlip<.003,'转身承重爪滑动');assert(maximumStepLift>.018,'转身未抬爪');
const recovered=[];
for(const seconds of [.3,.97,1.3,2,3.5,5,6]){
 const a=await fresh();a.restorePose(FENCE_ENTRY,Math.PI);a.enterFence();advance(a,seconds);
 const saved=JSON.parse(JSON.stringify(a.snapshotActivity()));
 const b=await fresh();b.restorePose(a.position,a.facing);b.restoreActivity(saved);advance(b,DT);
 assert(b.position.distanceTo(a.position)<.025,'恢复后瞬移');
 b.stand();advance(b,16);assert(!b.fencing);assert.equal(b.state,'idle');assert(b.position.distanceTo(new THREE.Vector3().copy(FENCE_ENTRY))<1e-6);assert.equal(b.drinkCompletions,0);
 recovered.push(saved.state);
}
cat.stand();const exit=[];
for(let i=0;i<600;i++){cat.update(DT);cat.root.updateMatrixWorld(true);exit.push({state:cat.state,y:cat.position.y,...contact()});}
assert(!cat.fencing);assert.equal(cat.state,'idle');
assert(Math.max(...exit.map(f=>f.penetration))<.001,'离栏横木穿入超过1mm');
assert(exit.some(f=>f.state==='fence_out')&&exit.some(f=>f.state==='fence_land'));
// 沿首页意图进入、趴稳后切换地点；爬出中恢复也保留离开请求。
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const c=await fresh(),walker=new Walker(c),home=new HomeBehavior(walker,c);
c.restorePose({x:2.8,y:0,z:-2.2},0);walker.restore('fence',true);home.restore({id:'fence-review',place:'fence',activity:'watch'},false);
for(let i=0;i<1800;i++){c.update(DT);home.update();await Promise.resolve();}
assert(home.settled&&c.fenceSettled);
home.accept({id:'leave-review',place:'house',activity:'watch'});
for(let i=0;i<90;i++){c.update(DT);home.update();await Promise.resolve();}
const snapshot=JSON.parse(JSON.stringify(c.snapshotActivity())),execution=home.snapshot;
assert(snapshot.fence?.exit);assert.equal(execution.execution.stage,'fence-exit');
const d=await fresh(),w2=new Walker(d),h2=new HomeBehavior(w2,d);
d.restorePose(c.position,c.facing);w2.restore('fence',true);d.restoreActivity(snapshot);h2.restore(execution.intent,execution.settled,execution.drinkDone,execution.execution);
for(let i=0;i<4200;i++){d.update(DT);h2.update();await Promise.resolve();}
assert(!d.fencing&&h2.settled,'离栏恢复后未到达新地点');
const result={clips:60,plantedSlip,maximumStepLift,preservedClips:48,maxPerchPenetration:Math.max(...[...frames,...exit].map(f=>f.penetration)),restMinSurface:Math.min(...rest.map(f=>f.min)),recovered,homeRouteAndExitRecovery:true,states:[...new Set([...frames,...exit].map(f=>f.state))]};
await fs.mkdir(path.join(root,'outputs/tuanzi-fence-review/metrics'),{recursive:true});await fs.writeFile(path.join(root,'outputs/tuanzi-fence-review/metrics/runtime.json'),JSON.stringify(result,null,2)+'\n');
