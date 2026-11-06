/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_chase.mjs
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


const {CHASE_ENTRY}=await import(pathToFileURL(path.join(compiled,'chase-motion.js')));
const {minimumClearance}=await import(pathToFileURL(path.join(compiled,'../yard/collision.js')));
const cat=await fresh();cat.restorePose(CHASE_ENTRY,0);cat.playChase();
let floor=1,clearance=1,headTailDistance=Infinity;const frames=[];
for(let i=0;i<540;i++){
 cat.update(DT);cat.root.updateMatrixWorld(true);const mesh=cat.model.body[0];mesh.skeleton.update();
 const paws=PAWS.map(n=>pos(cat,n).toArray());
 if(cat.state==='chase_turn')headTailDistance=Math.min(headTailDistance,pos(cat,'head').distanceTo(pos(cat,'tail_10')));
 for(let k=0;k<mesh.geometry.attributes.position.count;k++){
 const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,k);mesh.applyBoneTransform(k,v);v.applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,v.y);
 }
 clearance=Math.min(clearance,minimumClearance(cat.position).clearance);
 frames.push({i,state:cat.state,yaw:cat.facing,paws,turnTime:cat.snapshotActivity().chase?.turnTime});
}
let plantedFrameTravel=0;
const stepAt=time=>{let remaining=time;for(let i=0;i<24;i++){const d=i<2||i>21?.2:.1;if(remaining<d)return i;remaining-=d;}return 23;};
for(let i=1;i<frames.length;i++){
 const a=frames[i-1],b=frames[i];if(a.state!=='chase_turn'||b.state!=='chase_turn'||stepAt(a.turnTime)!==stepAt(b.turnTime))continue;
 // 只量当前承重的对角爪，抬爪起落的薄接触区不当作静止支撑。
 for(let j=0;j<4;j++)if([0,1,1,0][j]!==stepAt(a.turnTime)%2)plantedFrameTravel=Math.max(plantedFrameTravel,Math.hypot(a.paws[j][0]-b.paws[j][0],a.paws[j][2]-b.paws[j][2]));
}
const result={clips:cat.clipNames.length,floor,clearance,plantedFrameTravel,headTailDistance,finalYaw:cat.facing};console.log(result);
await fs.mkdir('/tmp/maomao-chase',{recursive:true});await fs.writeFile('/tmp/maomao-chase/frames.json',JSON.stringify(frames));
assert(headTailDistance>.25);assert(plantedFrameTravel<.001);assert(floor>-.002);assert(clearance>0);assert(!cat.playingChase&&cat.state==='idle');
const recovered=[];
for(const seconds of [.3,1.2,2.4,3.7]){
 const a=await fresh();a.restorePose(CHASE_ENTRY,0);a.playChase();advance(a,seconds);
 const saved=JSON.parse(JSON.stringify(a.snapshotActivity()));const b=await fresh();b.restorePose(a.position,a.facing);b.restoreActivity(saved);advance(b,DT);assert(Math.abs(THREE.MathUtils.euclideanModulo(b.facing-a.facing+Math.PI,2*Math.PI)-Math.PI)<.22);
 b.stand();advance(b,2);assert(!b.playingChase&&b.state==='idle');assert.equal(b.drinkCompletions,0);recovered.push(saved.state);
}
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const d=await fresh(),w=new Walker(d),h=new HomeBehavior(w,d);d.restorePose(CHASE_ENTRY,0);w.restore('grass',true);h.restore({id:'chase',place:'grass',activity:'chase'},false);
for(let i=0;i<700;i++){d.update(DT);h.update();await Promise.resolve();}assert(h.settled&&!d.playingChase&&!h.fallback);
h.accept({id:'again',place:'grass',activity:'chase'});
for(let i=0;i<600;i++){d.update(DT);h.update();await Promise.resolve();if(d.state==='chase_turn')break;}
assert.equal(d.state,'chase_turn');h.accept({id:'leave',place:'house',activity:'watch'});
const savedCat=JSON.parse(JSON.stringify(d.snapshotActivity())),savedHome=h.snapshot;
const e=await fresh(),w2=new Walker(e),h2=new HomeBehavior(w2,e);e.restorePose(d.position,d.facing);w2.restore('grass',true);e.restoreActivity(savedCat);h2.restore(savedHome.intent,savedHome.settled,savedHome.drinkDone,savedHome.execution);
for(let i=0;i<4200;i++){e.update(DT);h2.update();await Promise.resolve();}
assert(h2.settled&&!e.playingChase);assert.equal(e.drinkCompletions,0);
await fs.mkdir(path.join(root,'outputs/tuanzi-chase-review/metrics'),{recursive:true});await fs.writeFile(path.join(root,'outputs/tuanzi-chase-review/metrics/runtime.json'),JSON.stringify({...result,recovered,exitToHouseRecovery:true},null,2)+'\n');
