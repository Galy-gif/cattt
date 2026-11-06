/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_flower.mjs
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


const {FLOWER_ENTRY}=await import(pathToFileURL(path.join(compiled,'flower-motion.js')));
const {FlowerResponse}=await import(pathToFileURL(path.join(compiled,'../yard/flower-response.js')));
const cat=await fresh(),flower=new FlowerResponse();cat.restorePose(FLOWER_ENTRY,Math.PI);cat.playFlower();
const frames=[];let closest=1,ground=1,skinGround=1,stemPenetration=0,worstStem=null;
const mesh=cat.model.body[0];
for(let i=0;i<480;i++){
 cat.update(DT);cat.root.updateMatrixWorld(true);const paw=cat.flowerPaw;
 if(cat.state==='flower_touch')closest=Math.min(closest,paw.distanceTo(flower.head));
 flower.update(DT,paw,cat.state);
 const inverse=flower.root.matrixWorld.clone().invert();
 for(let j=0;j<mesh.geometry.attributes.position.count;j++){
  const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,j);mesh.applyBoneTransform(j,v);v.applyMatrix4(mesh.matrixWorld);skinGround=Math.min(skinGround,v.y);
  v.applyMatrix4(inverse);if(v.y>0&&v.y<.16&&.008-Math.hypot(v.x,v.z)>stemPenetration){stemPenetration=.008-Math.hypot(v.x,v.z);worstStem={i,state:cat.state,point:v.toArray(),vertex:j,bones:[0,1,2,3].map(k=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(j,k)].name)};}
 }
 const paws=PAWS.map(n=>pos(cat,n).toArray());ground=Math.min(ground,...paws.map(p=>p[1]-.03));
 frames.push({i,state:cat.state,root:cat.position.toArray(),paws,angle:flower.root.rotation.x});
}
await fs.mkdir('/tmp/maomao-flower',{recursive:true});await fs.writeFile('/tmp/maomao-flower/frames.json',JSON.stringify(frames));
console.log(JSON.stringify({stemPenetration,worstStem,skinGround,clips:cat.clipNames.length,closest,ground,hits:flower.hits,states:[...new Set(frames.map(f=>f.state))]},null,2));
assert(skinGround>-.002);assert(stemPenetration<.001);
assert(cat.clipNames.length>=66);assert.equal(flower.hits,1);assert(closest<.045);assert(ground>-.001);
assert(!cat.playingFlower&&cat.state==='idle');assert(cat.position.distanceTo(new THREE.Vector3().copy(FLOWER_ENTRY))<1e-6);
const recovered=[];
for(const seconds of [.4,1.2,1.7,2.5,3.3,3.8]){
 const a=await fresh();a.restorePose(FLOWER_ENTRY,Math.PI);a.playFlower();advance(a,seconds);
 const saved=JSON.parse(JSON.stringify(a.snapshotActivity()));
 const b=await fresh();b.restorePose(a.position,a.facing);b.restoreActivity(saved);advance(b,DT);assert(b.position.distanceTo(a.position)<.025);
 b.stand();advance(b,6);assert(!b.playingFlower&&b.state==='idle');assert(b.position.distanceTo(new THREE.Vector3().copy(FLOWER_ENTRY))<1e-6);assert.equal(b.drinkCompletions,0);recovered.push(saved.state);
}
const response=new FlowerResponse();const c=await fresh();c.restorePose(FLOWER_ENTRY,Math.PI);c.playFlower();
for(let i=0;i<180;i++){c.update(DT);c.root.updateMatrixWorld(true);response.update(DT,c.flowerPaw,c.state);}
assert.equal(response.hits,1);
const restoredResponse=new FlowerResponse();restoredResponse.restore(JSON.parse(JSON.stringify(response.snapshot)));
const hitCount=restoredResponse.hits;restoredResponse.update(0,c.flowerPaw,c.state);assert.equal(restoredResponse.hits,hitCount);
assert(Math.abs(restoredResponse.root.rotation.x-response.root.rotation.x)<1e-9);
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const d=await fresh(),w=new Walker(d),h=new HomeBehavior(w,d);d.restorePose(FLOWER_ENTRY,0);w.restore('fence',true);h.restore({id:'flower',place:'fence',activity:'flower'},false);
for(let i=0;i<900;i++){d.update(DT);h.update();await Promise.resolve();}
assert(h.settled&&!d.playingFlower&&!h.fallback);
h.accept({id:'again',place:'fence',activity:'flower'});
for(let i=0;i<900;i++){d.update(DT);h.update();await Promise.resolve();if(d.state==='flower_pounce')break;}
assert.equal(d.state,'flower_pounce');h.accept({id:'leave',place:'house',activity:'watch'});
const savedCat=JSON.parse(JSON.stringify(d.snapshotActivity())),savedHome=h.snapshot;
const e=await fresh(),w2=new Walker(e),h2=new HomeBehavior(w2,e);e.restorePose(d.position,d.facing);w2.restore('fence',true);e.restoreActivity(savedCat);h2.restore(savedHome.intent,savedHome.settled,savedHome.drinkDone,savedHome.execution);
for(let i=0;i<4200;i++){e.update(DT);h2.update();await Promise.resolve();}
assert(h2.settled&&!e.playingFlower&&e.position.y===0);assert.equal(e.drinkCompletions,0);
await fs.mkdir(path.join(root,'outputs/tuanzi-flower-review/metrics'),{recursive:true});await fs.writeFile(path.join(root,'outputs/tuanzi-flower-review/metrics/runtime.json'),JSON.stringify({clips:cat.clipNames.length,preservedClips:60,closestPawTipToFlowerHead:closest,skinGround,stemPenetration,groundError:ground,flowerHits:flower.hits,recovered,midairExitRecovery:true,flowerResponseRecovery:true},null,2)+'\n');
