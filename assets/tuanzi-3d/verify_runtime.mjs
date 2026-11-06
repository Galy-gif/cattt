/** 导出 glb + 真实 Tuanzi 运行时的动作回归；仅去掉贴图，Node 不做 GPU 验收。
 * pnpm --dir web exec tsc --noEmit false --rewriteRelativeImportExtensions --outDir node_modules/.cache/tuanzi-check
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

const seated = await fresh();
seated.sit();
advance(seated, 3);
assert.equal(seated.state, 'sit_idle');
const reference = await fresh();
reference.freeze('sit_idle', 0);
const target = reference.model.bones.get('tail_10').quaternion.clone();
let tailError = 0;
advance(seated, 5, () => { tailError = Math.max(tailError, target.angleTo(seated.model.bones.get('tail_10').quaternion)); });
report.sittingTailRotationErrorRadians = tailError;
assert(tailError < 0.002, `静止坐姿尾巴被改写：${tailError}`);

const paws = PAWS.map(n => pos(seated, n));
seated.earFlick();
let earPawDelta = 0;
advance(seated, 1, () => PAWS.forEach((n, i) => { earPawDelta = Math.max(earPawDelta, pos(seated, n).distanceTo(paws[i])); }));
report.seatedEarFlickPawDrift = earPawDelta;
assert(earPawDelta < 0.008, `抖耳朵带动支撑爪：${earPawDelta}`);
seated.stand();
advance(seated, 2);
assert.equal(seated.state, 'idle');

report.routes = {};
for (const [name, points] of Object.entries({
  straight: [{x:0,y:0,z:0.8}],
  turn180: [{x:0,y:0,z:-0.6}],
  corner90: [{x:0,y:0,z:0.5},{x:0.5,y:0,z:0.5}],
  curve: [{x:0.1,y:0,z:0.25},{x:0.25,y:0,z:0.5},{x:0.3,y:0,z:0.8}],
})) {
  const cat = await fresh();
  advance(cat, 0.5);
  const heights = PAWS.map(n => pos(cat,n).y);
  const contacts = PAWS.map(() => null);
  let maxWalk = 0, maxTurn = 0, maxTransition = 0;
  let previousPelvis = null;
  const done = cat.walkAlong(points);
  advance(cat, 14, () => {
    PAWS.forEach((n, i) => {
      const p = pos(cat,n);
      const active = cat.state === 'walk' || cat.state === 'turn';
      const planted = active && p.y < heights[i] + 0.002;
      if (!planted) { contacts[i] = null; return; }
      if (!contacts[i]) contacts[i] = p.clone();
      const drift = Math.hypot(p.x - contacts[i].x, p.z - contacts[i].z) / 0.38;
      if (cat.state === 'turn') maxTurn = Math.max(maxTurn, drift);
      else maxWalk = Math.max(maxWalk, drift);
    });
    const pelvis = cat.root.worldToLocal(pos(cat,'spine_01'));
    if (previousPelvis && cat.mixer.time - cat.lastTransitionAt < 0.5) maxTransition = Math.max(maxTransition, pelvis.distanceTo(previousPelvis) / DT / 0.25);
    previousPelvis = pelvis;
  });
  assert.equal(cat.state, 'idle', `${name} 未完成`);
  assert.deepEqual(await done, { interrupted: false });
  report.routes[name] = {maxWalkSlipFraction:maxWalk, maxTurnSlipFraction:maxTurn, maxTransitionSpeedRatio:maxTransition};
  assert(maxWalk <= 0.02, `${name} 行走滑步 ${maxWalk}`);
  assert(maxTurn <= 0.02, `${name} 转身滑步 ${maxTurn}`);
  assert(maxTransition <= 1.5, `${name} 切换跳动 ${maxTransition}`);
}

const interrupted = await fresh();
const arrival = interrupted.walkTo({x:0,y:0,z:1});
advance(interrupted,0.5);
interrupted.sit();
assert.deepEqual(await arrival,{interrupted:true});
advance(interrupted,0.5);
interrupted.stand();
advance(interrupted,2);
assert.equal(interrupted.state,'idle');
report.interruptedWalkAndSit = 'passed';
report.triangles = seated.model.triangles;
report.glbBytes = bytes.length;
assert(report.triangles <= 20000);
assert(bytes.length <= 3 * 1024 * 1024);
assert.equal(seated.clipNames.length, 69);
report.life = {};
for (const activity of ['sleep', 'doze', 'drink']) {
  const cat = await fresh(); advance(cat, .5); cat[activity]();
  advance(cat, 12);
  assert.equal(cat.state, { sleep: 'sleep_idle', doze: 'doze_idle', drink: 'idle' }[activity]);
  assert.equal(cat.drinkCompletions, activity === 'drink' ? 1 : 0);
  cat.stand(); advance(cat, 3); assert.equal(cat.state, 'idle');
  report.life[activity] = 'passed';
}
for (const seconds of [.05, .5, 2, 5, 8.9]) {
  const cat = await fresh(); cat.drink(); advance(cat, seconds); cat.stand(); advance(cat, 3);
  assert.equal(cat.drinkCompletions, 0, `中断 ${seconds}s 不能记录饮水`);
}
report.life.interruptedDrink = 'passed';
const { HomeBehavior } = await import(pathToFileURL(path.join(compiled, '../app/home-behavior.js')));
const { Walker } = await import(pathToFileURL(path.join(compiled, '../yard/cat.js')));
const dozeCat = await fresh(), dozeWalker = new Walker(dozeCat), dozing = new HomeBehavior(dozeWalker, dozeCat);
dozeCat.restorePose({x:-2.35,y:0,z:-.55},2.1);
dozing.accept({id:'front-doze',place:'house',activity:'rest'});
for(let f=0;f<1200;f++){dozeCat.update(DT);dozing.update();await Promise.resolve();}
assert.equal(dozeCat.state,'doze_idle');assert(dozing.settled);assert(Math.abs(dozeCat.facing)<.005);
report.doze={state:dozeCat.state,facing:dozeCat.facing,position:dozeCat.position.toArray()};
const turnCat=await fresh(),turnWalker=new Walker(turnCat),turnHome=new HomeBehavior(turnWalker,turnCat);
turnCat.restorePose({x:-2.6,y:.072,z:1.35},2.5);
turnHome.restore({id:'restore-bed-turn',place:'bed',activity:'rest'},false,false,{stage:'bed-rest-face',onBed:true,applied:false,degraded:false,drinkStart:0});
for(let f=0;f<360;f++){turnCat.update(DT);turnHome.update();await Promise.resolve();}
assert.equal(turnCat.state,'sleep_idle');assert(Math.abs(turnCat.facing-Math.PI/3)<.005);
report.life.bedTurnRecovery='转身中恢复仍横躺，未提前入睡';
turnCat.restorePose(turnCat.position,turnCat.facing);turnWalker.teleport('house');
turnHome.restore({id:'review-house',place:'house',activity:'rest'},false);
for(let f=0;f<360;f++){turnCat.update(DT);turnHome.update();await Promise.resolve();}
assert.equal(turnCat.state,'doze_idle');assert.equal(turnHome.supportCollider,undefined);
assert.equal(turnCat.position.y,0);assert(Math.abs(turnCat.position.z+.55)<.001);
report.life.reviewTeleport='验收跳转清除旧起落/窝内状态，不绕回猫窝';
const bedCat = await fresh(); bedCat.restorePose({x:-2.6,y:0,z:2.18}, Math.PI);
const bedWalker = new Walker(bedCat); bedCat.restorePose({x:-2.6,y:0,z:2.18}, Math.PI); const home = new HomeBehavior(bedWalker, bedCat);
home.accept({id:'bed-life',place:'bed',activity:'rest'});
const v = new THREE.Vector3(); let rimPenetration=0, cushionPenetration=0, worstFrame={}, perState={}, pawGaps={};
for(let f=0;f<660;f++) {
  bedCat.update(DT); home.update(); await Promise.resolve(); bedCat.root.updateMatrixWorld(true);
  for(const mesh of bedCat.model.body) {
    mesh.skeleton.update();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
      mesh.getVertexPosition(i,v);mesh.localToWorld(v);
      const x=v.x+2.6,z=v.z-1.35,rho=Math.hypot(x,z/.86);
      if(Math.abs(rho-.26)<=.068) {
        const top=.055+.068*Math.sqrt(Math.max(0,1-((rho-.26)/.068)**2));
        const pen=Math.max(0,top-v.y); perState[bedCat.state]=Math.max(perState[bedCat.state]||0,pen);
        if(pen>rimPenetration){rimPenetration=pen;worstFrame={f,state:bedCat.state,vertex:i,point:v.toArray(),rest:new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).toArray(),joints:[0,1,2,3].map(k=>mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i,k)].name)};}
      }
      const r2=(x/.25)**2+(z/.21)**2;
      if(r2<1){
        const gap=v.y-(.03+.05*Math.sqrt(1-r2));
        cushionPenetration=Math.max(cushionPenetration,-gap);
        if(f===620){const n=mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getX(i)].name;if(n.endsWith('_paw'))pawGaps[n]=Math.min(pawGaps[n]??Infinity,gap);}
      }
    }
  }
}
report.bed={pawGaps,perState,rimPenetration,cushionPenetration,worstFrame,state:bedCat.state,position:bedCat.position.toArray(),settled:home.settled};
assert.equal(bedCat.state,'sleep_idle');assert(home.settled);
assert(rimPenetration < .001, JSON.stringify(report.bed)); assert(cushionPenetration < .006, JSON.stringify(report.bed)); assert(Object.values(pawGaps).every(g => g >= -.006 && g <= .003), JSON.stringify(report.bed));
home.accept({id:'bed-exit',place:'bed',activity:'watch'});
let exitPenetration = 0;
for(let f=0;f<360;f++) {
  bedCat.update(DT);home.update();await Promise.resolve();bedCat.root.updateMatrixWorld(true);
  for(const mesh of bedCat.model.body){mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){
    mesh.getVertexPosition(i,v);mesh.localToWorld(v);const rho=Math.hypot(v.x+2.6,(v.z-1.35)/.86);
    if(Math.abs(rho-.26)<.068)exitPenetration=Math.max(exitPenetration,.055+.068*Math.sqrt(1-((rho-.26)/.068)**2)-v.y);
  }}
}
report.bed.exitRimPenetration=exitPenetration;assert(exitPenetration<.001);
assert.equal(bedCat.position.y,0);assert(home.settled);
const drinkCat=await fresh(), drinkWalker=new Walker(drinkCat), drinking=new HomeBehavior(drinkWalker,drinkCat);
drinking.setWater(true);drinking.accept({id:'full-drink',place:'house',activity:'drink'});
let touches=0, lowest=Infinity, minRadius=Infinity, lastState='', states=[];
for(let f=0;f<2400;f++) {
  drinkCat.update(DT);drinking.update();await Promise.resolve();drinkCat.root.updateMatrixWorld(true);
  if(drinkCat.state!==lastState){states.push({frame:f,state:drinkCat.state});lastState=drinkCat.state;}
  if(drinkCat.tongue.visible) {
    const box=new THREE.Box3().setFromObject(drinkCat.tongue), center=box.getCenter(new THREE.Vector3());
    lowest=Math.min(lowest,box.min.y);minRadius=Math.min(minRadius,Math.hypot(center.x+1.45,center.z+1.25));
    if(box.min.y<=.047 && box.max.y>=.047 && Math.hypot(center.x+1.45,center.z+1.25)<.084)touches++;
  }
}
report.drinking={touches,lowest,minRadius,states,position:drinkCat.position.toArray(),facing:drinkCat.facing,done:drinking.drinkDone,count:drinkCat.drinkCompletions};
assert(touches > 120, JSON.stringify(report.drinking)); assert(lowest >= .043 && lowest <= .047, JSON.stringify(report.drinking)); assert(minRadius < .084);
assert(drinking.drinkDone);assert.equal(drinkCat.drinkCompletions,1);
for(const seconds of [.4, 3, 9.2]) {
  const before=await fresh();before.drink();advance(before,seconds);
  const after=await fresh();after.restoreActivity(before.snapshotActivity());advance(after,12);
  assert.equal(after.drinkCompletions,1);assert.equal(after.state,'idle');
}
const hopBefore=await fresh();void hopBefore.hopTo({x:0,y:.072,z:-.83});advance(hopBefore,.6);
const hopAfter=await fresh();hopAfter.restorePose(hopBefore.position,hopBefore.facing);hopAfter.restoreActivity(hopBefore.snapshotActivity());advance(hopAfter,2);
assert.equal(hopAfter.position.y,.072);assert.equal(hopAfter.position.z,-.83);assert(!hopAfter.hopping);
report.life.recovery='饮水三阶段与半空起落恢复通过';
report.expressions = {};
for (const kind of ['tilt','groom','happy','sulk','sad']) {
  const cat=await fresh();cat.express(kind);advance(cat,2);
  assert.equal(cat.state,`${kind}_idle`);
  let minGround=Infinity, maxHead=-Infinity, minHead=Infinity;
  advance(cat,4.8,()=>{
    const head=pos(cat,'head');minHead=Math.min(minHead,head.y);maxHead=Math.max(maxHead,head.y);
    cat.model.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
      const a=mesh.geometry.attributes.position;
      for(let i=0;i<a.count;i++) {
        const v=new THREE.Vector3().fromBufferAttribute(a,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);minGround=Math.min(minGround,v.y);
      }
    });
  });
  const face = cat.appearance.face.emotion.value.clone();
  if (kind === 'sulk' || kind === 'sad') assert(face.length() > .99, `${kind}: missing face emotion`);
  else assert.equal(face.length(), 0, `${kind}: unexpected face override`);
  const saved=cat.snapshotActivity();const resumed=await fresh();resumed.restoreActivity(saved);
  assert(resumed.appearance.face.emotion.value.distanceTo(face) < 1e-8, `${kind}: face restore mismatch`);
  advance(resumed,.2);
  assert.equal(resumed.state,`${kind}_idle`);
  cat.stand();advance(cat,2);assert.equal(cat.state,'idle');assert.equal(cat.drinkCompletions,0);
  assert.equal(cat.appearance.face.emotion.value.length(), 0, `${kind}: face not cleared after exit`);
  for(const seconds of [.3,1.1,2.5]) {
    const interrupted=await fresh();interrupted.express(kind);advance(interrupted,seconds);
    const restoreDown=await fresh();restoreDown.restoreActivity(interrupted.snapshotActivity());advance(restoreDown,2);assert.equal(restoreDown.state,`${kind}_idle`);
    interrupted.stand();advance(interrupted,.15);
    const restoreUp=await fresh();restoreUp.restoreActivity(interrupted.snapshotActivity());advance(restoreUp,2);assert.equal(restoreUp.state,'idle');
    advance(interrupted,2);assert.equal(interrupted.state,'idle');
  }
  report.expressions[kind]={minGround,headTravel:maxHead-minHead,recovery:true,interruption:true,faceRecovery:true};
  assert(minGround>-.008,`${kind}: ground ${minGround}`);
}
const groom=await fresh();groom.express('groom');advance(groom,2);
let mouthPawMin=Infinity,mouthPawMax=0,lickFrames=0;
advance(groom,4.8,()=>{
  groom.root.updateMatrixWorld(true);
  const mouth=groom.tongue.getWorldPosition(new THREE.Vector3());let near=Infinity,contact=false;
  groom.model.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;
    const a=mesh.geometry.attributes.position,si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
    for(let i=0;i<a.count;i++) {
      let weight=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[si.getComponent(i,k)].name==='front_R_paw')weight+=sw.getComponent(i,k);
      if(weight<.5)continue;
      const v=new THREE.Vector3().fromBufferAttribute(a,i);mesh.applyBoneTransform(i,v);v.applyMatrix4(mesh.matrixWorld);
      near=Math.min(near,v.distanceTo(mouth));
      if(groom.tongue.visible && groom.tongue.worldToLocal(v.clone()).length()<=1)contact=true;
    }
  });mouthPawMin=Math.min(mouthPawMin,near);mouthPawMax=Math.max(mouthPawMax,near);if(contact)lickFrames++;
});
report.expressions.groom.contact={mouthPawMin,mouthPawMax,lickFrames};
assert(mouthPawMax<.012);assert(lickFrames>20,`舔爪有效接触不足: ${lickFrames}`);
await fs.writeFile(path.join(root,'outputs/tuanzi-life-review/metrics/runtime.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report, null, 2));
