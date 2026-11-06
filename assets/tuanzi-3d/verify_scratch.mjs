/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions true --outDir node_modules/.cache/tuanzi-check
 * node assets/tuanzi-3d/verify_scratch.mjs
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


const {SCRATCH_ENTRY}=await import(pathToFileURL(path.join(compiled,'scratch-motion.js')));
const {GLTFLoader}=await import(pathToFileURL(path.join(root,'web/node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
const yardBytes=await fs.readFile(path.join(root,'web/public/models/yard.glb'));
const yl=yardBytes.readUInt32LE(12), yj=JSON.parse(yardBytes.subarray(20,20+yl));
delete yj.images;delete yj.textures;delete yj.samplers;
for(const m of yj.materials){delete m.pbrMetallicRoughness?.baseColorTexture;delete m.normalTexture;}
const j=Buffer.from(JSON.stringify(yj)),pad=Buffer.alloc(Math.ceil(j.length/4)*4,32);j.copy(pad);
const hd=Buffer.from(yardBytes.subarray(0,20));hd.writeUInt32LE(20+pad.length+yardBytes.length-20-yl,8);hd.writeUInt32LE(pad.length,12);
const ybuf=Buffer.concat([hd,pad,yardBytes.subarray(20+yl)]);
const yard=(await new GLTFLoader().parseAsync(ybuf.buffer.slice(ybuf.byteOffset,ybuf.byteOffset+ybuf.length),'')).scene;yard.updateMatrixWorld(true);
const trunk=yard.getObjectByName('tree_trunk');assert(trunk);trunk.material.side=THREE.DoubleSide;
const ray=new THREE.Raycaster();const surface=(x,y)=>{ray.set(new THREE.Vector3(x,y,0),new THREE.Vector3(0,0,-1));return ray.intersectObject(trunk,false)[0]?.point.z;};
const cat=await fresh();cat.restorePose(SCRATCH_ENTRY,Math.PI);cat.playScratch();
const mesh=cat.model.body[0],frames=[];let floor=1,penetration=0,worst=null,leftMin=1,rightMin=1;const hindRanges=[[],[]];
for(let i=0;i<450;i++){
 cat.update(DT);cat.root.updateMatrixWorld(true);mesh.skeleton.update();
 const paws=PAWS.map(n=>pos(cat,n).toArray());
 for(let k=0;k<mesh.geometry.attributes.position.count;k++){
  const v=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,k);mesh.applyBoneTransform(k,v);v.applyMatrix4(mesh.matrixWorld);floor=Math.min(floor,v.y);
  const z=surface(v.x,v.y);if(z!==undefined){const depth=z-v.z;if(depth>penetration){penetration=depth;worst={i,state:cat.state,vertex:k,point:v.toArray(),surface:z,bones:[0,1,2,3].map(n=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(k,n)].name)};}
   if(cat.state==='scratch_rake'){const bone=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(k)].name;if(bone==='front_L_paw')leftMin=Math.min(leftMin,Math.abs(depth));if(bone==='front_R_paw')rightMin=Math.min(rightMin,Math.abs(depth));}
  }
 }
 if(cat.state==='scratch_rake')for(let k=0;k<2;k++)hindRanges[k].push(paws[k+2]);
 frames.push({i,state:cat.state,root:cat.position.toArray(),paws});
}
await fs.mkdir('/tmp/maomao-scratch',{recursive:true});await fs.writeFile('/tmp/maomao-scratch/frames.json',JSON.stringify(frames));
const result={clips:cat.clipNames.length,floor,penetration,worst,leftMin,rightMin,hindGroundError:Math.max(...hindRanges.flat().map(p=>Math.abs(p[1]-.03))),hindTravel:hindRanges.map(ps=>Math.max(...ps.map(p=>Math.hypot(...p.map((n,k)=>n-ps[0][k])))))};
console.log(JSON.stringify(result,null,2));
assert(floor>-.002);assert(penetration<.002);assert(leftMin<.012&&rightMin<.012);assert(result.hindTravel.every(n=>n<.003));assert(result.hindGroundError<.001);
assert(!cat.playingScratch&&cat.state==='idle');
const recovered=[];
for(const seconds of [.5,1.4,2.5,5.2,6.2]){
 const a=await fresh();a.restorePose(SCRATCH_ENTRY,Math.PI);a.playScratch();advance(a,seconds);
 const saved=JSON.parse(JSON.stringify(a.snapshotActivity()));const b=await fresh();b.restorePose(a.position,a.facing);b.restoreActivity(saved);advance(b,DT);assert(b.position.distanceTo(a.position)<.01);
 b.stand();advance(b,8);assert(!b.playingScratch&&b.state==='idle');assert(b.position.distanceTo(new THREE.Vector3().copy(SCRATCH_ENTRY))<1e-6);assert.equal(b.drinkCompletions,0);recovered.push(saved.state);
}
const {HomeBehavior}=await import(pathToFileURL(path.join(compiled,'../app/home-behavior.js')));
const {Walker}=await import(pathToFileURL(path.join(compiled,'../yard/cat.js')));
const d=await fresh(),w=new Walker(d),h=new HomeBehavior(w,d);d.restorePose(SCRATCH_ENTRY,0);w.restore('tree',true);h.restore({id:'scratch',place:'tree',activity:'scratch'},false);
for(let i=0;i<900;i++){d.update(DT);h.update();await Promise.resolve();}
assert(h.settled&&!d.playingScratch&&!h.fallback);
h.accept({id:'again',place:'tree',activity:'scratch'});
for(let i=0;i<1200;i++){d.update(DT);h.update();await Promise.resolve();if(d.state==='scratch_rake')break;}
assert.equal(d.state,'scratch_rake');h.accept({id:'leave',place:'house',activity:'watch'});
const savedCat=JSON.parse(JSON.stringify(d.snapshotActivity())),savedHome=h.snapshot;
const e=await fresh(),w2=new Walker(e),h2=new HomeBehavior(w2,e);e.restorePose(d.position,d.facing);w2.restore('tree',true);e.restoreActivity(savedCat);h2.restore(savedHome.intent,savedHome.settled,savedHome.drinkDone,savedHome.execution);
for(let i=0;i<4200;i++){e.update(DT);h2.update();await Promise.resolve();}
assert(h2.settled&&!e.playingScratch&&e.position.y===0);assert.equal(e.drinkCompletions,0);
await fs.mkdir(path.join(root,'outputs/tuanzi-scratch-review/metrics'),{recursive:true});await fs.writeFile(path.join(root,'outputs/tuanzi-scratch-review/metrics/runtime.json'),JSON.stringify({...result,recovered,exitToHouseRecovery:true},null,2)+'\n');
