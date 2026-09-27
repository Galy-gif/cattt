import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveScaleGovernor } from '../src/render/adaptive-scale.ts';
import { FollowCamera } from '../src/app/follow.ts';
import { minimumClearance } from '../src/yard/collision.ts';
import { EDGES, NODES, PLACE_ORDER, distance, place } from '../src/yard/layout.ts';

test('倍率降档需要连续低帧窗口，决定不会在当前绘制中直接执行', () => {
  const governor = new AdaptiveScaleGovernor(.75, .05, 2, 3, 3);
  assert.equal(governor.sample(48, 60, 1), null);
  assert.deepEqual(governor.sample(49, 60, 1), { scale: .95, reason: 'slow' });
  for (let i = 0; i < 3; i++) assert.equal(governor.sample(40, 60, .95), null, `冷却窗口 ${i + 1}`);
  assert.equal(governor.sample(40, 60, .95), null);
  assert.deepEqual(governor.sample(40, 60, .95), { scale: .9, reason: 'slow' });
});

test('倍率升档需要三个稳定窗口，阈值抖动会清空累计', () => {
  const governor = new AdaptiveScaleGovernor(.75, .05, 2, 3, 0);
  assert.equal(governor.sample(59, 60, .9), null);
  assert.equal(governor.sample(58, 60, .9), null);
  assert.equal(governor.sample(59, 60, .9), null);
  assert.equal(governor.sample(59, 60, .9), null);
  assert.deepEqual(governor.sample(59, 60, .9), { scale: .95, reason: 'fast' });
});

test('30fps 使用自己的目标阈值，不会因主动限帧错误降清晰度', () => {
  const governor = new AdaptiveScaleGovernor(.75, .05, 2, 3, 0);
  for (let i = 0; i < 4; i++) assert.equal(governor.sample(30, 30, 1), null);
});

test('横拖进入浏览态，松手三秒后不会跟团子回弹', () => {
  const follow = new FollowCamera();
  follow.resize(440, 956);
  const cat = { x: 0, y: 0, z: 0 };
  follow.update(cat, 1 / 60);
  follow.beginBrowse();
  follow.dragBy(1, .1);
  follow.endBrowse(true);
  cat.x = -1;
  cat.z = 1.2;
  for (let i = 0; i < 180; i++) follow.update(cat, 1 / 60);
  const state = follow.snapshot();
  assert.equal(state.mode, 'browsing');
  assert.ok(Math.abs(state.focus[0] - 1) < .01, `浏览中心 ${state.focus[0]}`);
  assert.ok(Math.abs(state.focus[2]) < .01, `浏览时不应被团子的纵深位置拉走：${state.focus[2]}`);
});

test('找团子恢复平滑跟随；浏览模式和位置可从快照恢复', () => {
  const original = new FollowCamera();
  original.resize(440, 956);
  original.update({ x: 0, y: 0, z: 0 }, 1 / 60);
  original.beginBrowse(); original.dragBy(.8, .1); original.endBrowse(true);
  for (let i = 0; i < 60; i++) original.update({ x: -.8, y: 0, z: 0 }, 1 / 60);
  const restored = new FollowCamera();
  restored.resize(440, 956); restored.restore(original.snapshot());
  assert.equal(restored.snapshot().mode, 'browsing');
  assert.ok(Math.abs(restored.snapshot().centerX - .8) < .01);
  restored.findCat();
  for (let i = 0; i < 90; i++) restored.update({ x: -.8, y: 0, z: 0 }, 1 / 60);
  assert.equal(restored.snapshot().mode, 'following');
  assert.ok(Math.abs(restored.snapshot().focus[0] + .8) < .01);
});

test('浏览边界会计入当前竖屏可见宽度', () => {
  const follow = new FollowCamera();
  follow.resize(440, 956);
  follow.update({ x: 0, y: 0, z: 0 }, 1 / 60);
  follow.beginBrowse(); follow.dragBy(100, .1); follow.endBrowse(true);
  for (let i = 0; i < 60; i++) follow.update({ x: 0, y: 0, z: 0 }, 1 / 60);
  const state = follow.snapshot();
  assert.ok(state.focus[0] + follow.visibleWidth / 2 <= 3.0001);
});

test('六处目的地和全部 3D 路段保留非负实体净距', () => {
  for (const id of PLACE_ORDER) {
    const target = place(id).point;
    const result = minimumClearance(target);
    assert.ok(result.clearance >= 0, `${id} 与 ${result.id} 净距 ${result.clearance}`);
  }
  for (const edge of EDGES) {
    const a = NODES[edge.a];
    const b = NODES[edge.b];
    const samples = Math.max(1, Math.ceil(distance(a, b) / .025));
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const result = minimumClearance(point);
      assert.ok(result.clearance >= -1e-6, `${edge.a}→${edge.b} @${t.toFixed(2)} 与 ${result.id} 净距 ${result.clearance}`);
    }
  }
});
