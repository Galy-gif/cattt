/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_runtime.mjs
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

const cat=await fresh();cat.restorePose({x:.213,y:0,z:-.95},Math.PI);cat.enterNest(false);
const samples=[], frames=[];
for(let f=0;f<1140;f++) {
  if(f===540){cat.setNestRest(true);}
  if(f===780){cat.stand();}
  cat.update(DT);cat.root.updateMatrixWorld(true);
  if(f%6)continue;
  const points=[];
  for(const mesh of cat.model.body) {
    const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);points.push(v.x,-v.z,v.y);}
  }
  samples.push(new Float32Array(points));frames.push({frame:f,state:cat.state,pose:cat.position.toArray(),paws:PAWS.map(n=>pos(cat,n).toArray())});
}
await fs.mkdir('/tmp/maomao-nest',{recursive:true});await fs.writeFile('/tmp/maomao-nest/surface.bin',Buffer.concat(samples.map(a=>Buffer.from(a.buffer))));await fs.writeFile('/tmp/maomao-nest/frames.json',JSON.stringify({vertices:samples[0].length/3,frames}));
assert(!cat.nesting);assert.equal(cat.position.y,0);
// 各阶段打断与重建，均先完成落地，再允许普通行走。
const stages={};
for(const seconds of [.4,1.1,1.8,3.2,5.2,8]) {
 const before=await fresh();before.restorePose({x:.213,y:0,z:-.95},Math.PI);before.enterNest(true);advance(before,seconds);const saved=JSON.parse(JSON.stringify(before.snapshotActivity()));
 const after=await fresh();after.restorePose(before.position,before.facing);after.restoreActivity(saved);assert.equal(after.state,before.state);
 after.stand();advance(after,12);assert(!after.nesting);assert.equal(after.position.y,0);assert.equal(after.drinkCompletions,0);stages[saved.state]='中断与恢复后安全落地';
}
console.log(JSON.stringify({states:[...new Set(frames.map(f=>f.state))],recovery:stages,frames:frames.length},null,2));

// 支撑节点旋转后，猫相对吊窝的坐标必须保持；不得叠加累计漂移。
const supported=await fresh();supported.restorePose({x:.213,y:0,z:-.95},Math.PI);supported.enterNest(false);advance(supported,5);
const nominal=supported.position.clone();const support=new THREE.Matrix4().makeRotationZ(.045);support.setPosition(.01,0,-.012);
for(let i=0;i<120;i++){supported.applyNestSupport(support);assert(supported.position.distanceTo(nominal.clone().applyMatrix4(support))<1e-7);}
// 退出的每个阶段重建后，仍完成落地，不滞留空中。
for(const seconds of [.5,1.5,2.9,3.5]){
 const before=await fresh();before.restorePose({x:.213,y:0,z:-.95},Math.PI);before.enterNest(false);advance(before,5);before.stand();advance(before,seconds);
 const after=await fresh();after.restorePose(before.position,before.facing);after.restoreActivity(JSON.parse(JSON.stringify(before.snapshotActivity())));advance(after,7);assert(!after.nesting);assert.equal(after.position.y,0);
}
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const routedCat=await fresh();routedCat.restorePose({x:.75,y:0,z:-.95},0);const walker=new Walker(routedCat);walker.restore('tree',true);const home=new HomeBehavior(walker,routedCat);home.restore({id:'nest',place:'tree',activity:'watch'},false);let states=[];
for(let f=0;f<1800;f++){routedCat.update(DT);home.update();await Promise.resolve();if(!states.includes(routedCat.state))states.push(routedCat.state);}
console.log(states,routedCat.position.toArray(),routedCat.state,home.settled);assert.equal(routedCat.state,'nest_watch');assert(home.settled);
home.accept({id:'sleep',place:'tree',activity:'rest'});for(let f=0;f<150;f++){routedCat.update(DT);home.update();await Promise.resolve();}assert.equal(routedCat.state,'nest_sleep');
home.accept({id:'leave',place:'house',activity:'watch'});states=[];for(let f=0;f<3000;f++){routedCat.update(DT);home.update();await Promise.resolve();if(!states.includes(routedCat.state))states.push(routedCat.state);}console.log('exit',states,routedCat.position.toArray(),home.settled);assert(!routedCat.nesting);assert.equal(routedCat.position.y,0);

await fs.mkdir(path.join(root,'outputs/tuanzi-nest-review/metrics'),{recursive:true});
await fs.writeFile(path.join(root,'outputs/tuanzi-nest-review/metrics/runtime.json'),JSON.stringify({clips:cat.clipNames.length,states:[...new Set(frames.map(f=>f.state))],recovery:stages,exitRecovery:true,supportNoDrift:true,watchSleepSwitch:true,exitBeforeRoute:true,frames:frames.length},null,2));
