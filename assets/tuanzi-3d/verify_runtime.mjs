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
assert.equal(seated.clipNames.length, 7);
console.log(JSON.stringify(report, null, 2));
