import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FramePacer, PerfRecorder } from '../src/app/performance.ts';

test('前台 2 秒卡顿不能被丢弃；首帧不计间隔', () => {
  const r = new PerfRecorder();
  r.frame(500, 1); r.frame(520, .95); r.frame(2520, .9);
  const p = r.report();
  assert.equal(p.frames, 2); assert.equal(p.seconds, 2.02);
  assert.equal(p.longestFrameMs, 2000); assert.equal(p.low1Fps, .5);
  assert.equal(p.minScale, .9);
});
test('后台时间隔离、恢复第一帧不计卡顿、重复暂停幂等', () => {
  const r = new PerfRecorder();
  r.frame(0, 1); r.frame(20, 1); r.pause(25, 'native'); r.pause(26, 'visibility');
  r.frame(30025, 1); r.frame(30045, 1);
  const p = r.report();
  assert.equal(p.frames, 2); assert.equal(p.seconds, .04); assert.equal(p.hitches, 0);
  assert.equal(p.segments.length, 2); assert.equal(p.pauses.length, 1); assert.equal(p.pauses[0].endMs, 30025);
});
test('30fps 在 60、90、120Hz 回调下相同，长停顿不追赶爆帧', () => {
  for (const hz of [60, 90, 120]) {
    const p = new FramePacer(30); let rendered = 0;
    for (let i = 0; i < hz * 10; i++) if (p.due(i * 1000 / hz)) rendered++;
    assert.equal(rendered, 300, `${hz} Hz`);
    assert.equal(p.due(20000), true); assert.equal(p.due(20001), false);
    p.reset(); assert.equal(p.due(20002), true);
  }
});
test('无数据和触摸缺测不能伪造合格值；报告是独立快照', () => {
  const r = new PerfRecorder(); assert.equal(r.report().minScale, null);
  assert.equal(r.report().touch.maxFrameDelay, null);
  r.touch(1, 18); r.touch(2, 40); const p = r.report();
  assert.equal(p.touch.maxFrameDelay, 2); assert.equal(p.touch.samples, 2);
  r.frame(1, 1); assert.equal(p.segments.length, 0);
});
