import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FollowCamera } from '../src/app/follow.ts';
import { CameraGestures } from '../src/app/gestures.ts';
import { boxCorners, COMPOSITION, projectBox } from '../src/app/composition.ts';
import { place, PLACE_ORDER } from '../src/yard/layout.ts';
const bounds = new THREE.Box3(new THREE.Vector3(-3.2, 0, -1.8), new THREE.Vector3(3.3, 2.8, 2));
const cat = { x: 0, y: 0, z: 0 };
function make(w = 440, h = 956) {
  const f = new FollowCamera(true);
  f.setBounds(bounds); f.resize(w, h, { top: 112, bottom: 180, left: 62, right: 16 }); f.update(cat, 1 / 60);
  return f;
}
function settle(f, target = cat) { for (let i = 0; i < 240; i++) f.update(target, 1 / 60); }

test('全景真实物件边界在两种竖屏可用区内，尺寸变化后仍完整', () => {
  for (const [w, h] of [[440, 956], [402, 874]]) {
    const f = make(w, h); f.overview(); settle(f);
    const r = projectBox(bounds, f.camera, w, h);
    assert.ok(r.inFront && r.x >= 62 && r.x + r.width <= w - 16 && r.y >= 112 && r.y + r.height <= h - 180, JSON.stringify(r));
    f.resize(390, 844, { top: 110, bottom: 190, left: 62, right: 16 }); settle(f);
    const small = projectBox(bounds, f.camera, 390, 844);
    assert.ok(small.x >= 62 && small.x + small.width <= 374);
  }
});
test('双指缩放夹住远近边界，固定FOV；结束后不随猫回弹', () => {
  const f = make(); f.zoomBy(100, 240, 430); f.endBrowse(true); settle(f);
  assert.equal(f.snapshot().distance, f.limits.min);
  f.zoomBy(0.001, 240, 430); f.endBrowse(true); settle(f);
  assert.equal(f.snapshot().distance, f.limits.max);
  assert.equal(f.camera.fov, 48);
  const state = f.snapshot(); settle(f, { x: 2, y: 0, z: 1 });
  assert.ok(Math.abs(f.snapshot().focus[0] - state.focus[0]) < 1e-5);
});
test('非边界缩放以手势中心的地面点为锚', () => {
  const f = make(); const before = f.groundAt(240, 450);
  f.zoomBy(1.1, 240, 450); const after = f.groundAt(240, 450);
  assert.ok(before.distanceTo(after) < 1e-6, String(before.distanceTo(after)));
});
test('双指转单指以残留指坐标继续，取消/第三指不污染下一次手势', () => {
  const f = make(); const gesture = new CameraGestures(f, () => 440);
  gesture.down(1, 170, 460, 0); gesture.down(2, 270, 460, 1); gesture.down(3, 800, 100, 2);
  gesture.move(2, 290, 460, 10); gesture.up(2, 11);
  const before = f.snapshot().centerX;
  gesture.move(1, 171, 460, 12); f.update(cat, 1 / 60);
  assert.ok(Math.abs(f.snapshot().centerX - before) < 0.02);
  gesture.cancel(); gesture.move(3, 10, 10, 20);
  assert.equal(f.dragging, false);
  gesture.down(5, 100, 460, 30); gesture.move(5, 120, 460, 40); gesture.up(5, 41); settle(f);
  assert.equal(f.snapshot().velocity, 0);
});
test('轻点不退出跟随；全景/取景/找团子只改变相机', () => {
  const f = make(); const gesture = new CameraGestures(f, () => 440);
  gesture.down(1, 100, 400, 0); gesture.up(1, 10); assert.equal(f.mode, 'following');
  const original = structuredClone(cat);
  for (const id of PLACE_ORDER) {
    f.lookAtPlace(id); settle(f);
    assert.equal(f.snapshot().place, id); assert.ok(Math.abs(f.snapshot().focus[0] - place(id).point.x) < .01);
  }
  f.overview(); settle(f); f.findCat(); settle(f);
  assert.equal(f.mode, 'following'); assert.equal(f.snapshot().distance, COMPOSITION.dailyDistance);
  assert.deepEqual(cat, original);
});
test('缩放与全景快照恢复；旧快照落到日常倍率；非法缩放拒绝', () => {
  const f = make(); f.overview(); settle(f);
  const restored = make(); restored.restore(f.snapshot()); settle(restored);
  assert.ok(restored.camera.position.distanceTo(f.camera.position) < .001);
  const old = { mode: 'browsing', focus: [0, .62, 0], position: [0, 1.35, 3.4] };
  restored.restore(old); assert.equal(restored.snapshot().distance, COMPOSITION.dailyDistance);
  assert.throws(() => restored.restore({ ...old, distance: NaN }));
});
test('减少动态效果取消过渡与惯性，近裁面不进入实体', () => {
  const f = make(); f.reduceMotion = true; f.overview(); f.update(cat, 1 / 60);
  assert.equal(f.snapshot().shownDistance, f.limits.max);
  f.findCat(); f.update(cat, 1 / 60); assert.equal(f.snapshot().shownDistance, COMPOSITION.dailyDistance);
  f.beginBrowse(); f.dragBy(.5, .1); f.endBrowse(); assert.equal(f.snapshot().velocity, 0);
  const obstacle = new THREE.Box3(new THREE.Vector3(-1, 0, 1.8), new THREE.Vector3(1, 3, 3.5));
  f.setBounds(bounds, [obstacle]); f.findCat(); f.update(cat, 1 / 60);
  assert.equal(obstacle.clone().expandByScalar(.14).containsPoint(f.camera.position), false);
});
