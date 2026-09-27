import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NODES, EDGES, STROLL, PLACE_ORDER, LAYOUT_VERSION, place, route } from '../src/yard/layout.ts';
import { groundHeight } from '../src/yard/terrain.ts';
import { minimumClearance } from '../src/yard/collision.ts';
import { layoutRestorePoint } from '../src/app/layout-snapshot.ts';
import { FollowCamera } from '../src/app/follow.ts';
import { projectBox, rectanglesOverlap } from '../src/app/composition.ts';

test('扩院散步经过新增草地和池边；路线连通、全部落在平缓活动面', () => {
  assert.ok(STROLL.includes('lawn-center') && STROLL.includes('m14') && STROLL.includes('bench-front'));
  for (const from of Object.keys(NODES)) {
    assert.ok(from === 'm0' || route('m0', from).length, `孤立节点 ${from}`);
  }
  let length = 0;
  for (const edge of EDGES) {
    const a = NODES[edge.a], b = NODES[edge.b];
    length += Math.hypot(a.x-b.x,a.z-b.z);
    for (let i=0;i<=20;i++) {
      const p = { x:a.x+(b.x-a.x)*i/20,z:a.z+(b.z-a.z)*i/20 };
      assert.equal(groundHeight(p.x,p.z),0);
      assert.ok(minimumClearance(p).clearance >= 0, `${edge.a}→${edge.b}`);
    }
  }
  assert.ok(length > 20, `路线总长 ${length}`);
});
test('旧布局恢复按同名地点安全迁移；同版本不改坐标', () => {
  for (const goal of PLACE_ORDER) {
    assert.equal(layoutRestorePoint(LAYOUT_VERSION,goal),null);
    for (const version of [undefined,'legacy-v1']) {
      const p=layoutRestorePoint(version,goal);
      assert.deepEqual(p,{...place(goal).point,y:0});
      assert.ok(minimumClearance(p).clearance>=0);
    }
  }
});
test('分物件总览避开真实控件，同时允许院内草地从地点轨后延伸', () => {
  const f=new FollowCamera(true);
  const ground=new THREE.Box3(new THREE.Vector3(-4,0,-3),new THREE.Vector3(4,0,3));
  const parts=[new THREE.Box3(new THREE.Vector3(-2.8,0,-2.8),new THREE.Vector3(-1.6,1.2,-1.6)),
    new THREE.Box3(new THREE.Vector3(-1.6,0,-.9),new THREE.Vector3(.3,2.5,.9)),
    new THREE.Box3(new THREE.Vector3(1.2,0,-.8),new THREE.Vector3(3.1,.2,1))];
  const whole=ground.clone();parts.forEach(b=>whole.union(b));
  f.setBounds(whole,[],parts);f.resize(440,956,{left:62,right:16,top:111,bottom:182});
  const controls=[{x:7,y:191,width:44,height:284},{x:16,y:780,width:408,height:56}];
  f.setControls(controls);f.overview(true);f.update({x:0,y:0,z:0},.016);
  for(const part of parts){
    const r=projectBox(part,f.camera,440,956);
    assert.ok(r.inFront && r.x>=12 && r.x+r.width<=416);
    assert.ok(controls.every(c=>!rectanglesOverlap(r,c,6.9)));
  }
  const before=f.camera.clone();f.compareAt([0,1,0],[0,10,20]);f.update({x:2,y:0,z:2},1);
  assert.deepEqual(f.camera.position.toArray(),[0,10,20]);
  f.findCat();f.update({x:2,y:0,z:2},1);
  assert.notDeepEqual(f.camera.position.toArray(),[0,10,20]);
});

test('静态物件合批保留世界边界、三角面数及材质，实际减少绘制对象', async () => {
  const {batchStaticProps}=await import('../src/yard/static-props.ts');
  const root=new THREE.Group();root.position.set(3,0,-2);root.rotation.y=.3;
  const material=new THREE.MeshStandardMaterial();
  for(let i=0;i<12;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.1,.3),material);
    mesh.position.set(i*.15,.3,i*.07);mesh.rotation.y=i*.12;
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  const before=new THREE.Box3().setFromObject(root,true);let triangles=0;
  root.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});
  batchStaticProps(root);const after=new THREE.Box3().setFromObject(root,true);
  assert.ok(before.min.distanceTo(after.min)<1e-6 && before.max.distanceTo(after.max)<1e-6);
  const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.equal(meshes.length,1);assert.equal(meshes[0].geometry.index.count/3,triangles);
  assert.equal(meshes[0].material,material);assert.ok(meshes[0].castShadow&&meshes[0].receiveShadow);
});

test('散步在支路终点结束一段再返程，重叠路径不会锁住；新操作取消余下行程', async () => {
  const {Walker}=await import('../src/yard/cat.ts');
  const root=new THREE.Group();let finish;const legs=[];
  const cat={root,position:root.position,facing:0,stand(){},sit(){},lookAt(){},update(){},
    walkAlong(points){legs.push(points);return new Promise(resolve=>{finish=()=>{root.position.copy(points.at(-1));resolve({interrupted:false});};});},
    walkTo(){return Promise.resolve({interrupted:false});}};
  const walker=new Walker(cat);walker.stroll();
  for(let i=0;i<STROLL.length-1;i++){
    assert.equal(legs.length,i+1);assert.deepEqual(legs[i].at(-1),{...NODES[STROLL[i+1]],y:0});
    finish();await Promise.resolve();
  }
  assert.equal(walker.arrived,true);
  walker.stroll();const count=legs.length;walker.teleport('pond');finish();await Promise.resolve();
  assert.equal(legs.length,count);assert.equal(walker.goal,'pond');assert.equal(walker.arrived,true);
});
