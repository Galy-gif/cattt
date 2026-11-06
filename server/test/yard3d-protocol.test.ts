import { expect, it } from 'vitest';
import { snapshotSchema } from '../src/world/protocol.ts';
import { yardBlock } from '../src/runtime/yard.ts';
import { readFileSync } from 'node:fs';

it('接受 iOS 正式活动池中的全部 3D 活动，拒绝未知活动', () => {
  const source = readFileSync(new URL('../../ios/Maomao/Model/YardIntent.swift', import.meta.url), 'utf8');
  const pool = source.slice(source.indexOf('private mutating func idleActivity'), source.indexOf('private mutating func dwell'));
  const activities = new Set([
    ...[...source.matchAll(/activity: "([a-z]+)"/g)].map(match => match[1]),
    ...[...pool.matchAll(/"([a-z]+)"/g)].map(match => match[1]),
  ]);
  expect(activities.size).toBeGreaterThan(4);
  const snapshot = { stateVersion: 1, sceneVersion: 4, destinationIds: ['house'],
    currentDestinationId: 'house', targetDestinationId: 'house', phase: 'idle', action: 'idle',
    paused: false, runnable: true };
  for (const activity of activities) {
    expect(snapshotSchema.safeParse({ ...snapshot, activity }).success, activity).toBe(true);
  }
  expect(snapshotSchema.safeParse({ ...snapshot, activity: 'unknown' }).success).toBe(false);
});

it('3D 基础动作和降级活动随真实世界观察进聊天', () => {
  const snapshot = snapshotSchema.parse({ stateVersion: 4, sceneVersion: 4,
    destinationIds: ['house', 'tree', 'bed', 'grass', 'pond', 'fence'], currentDestinationId: 'house', targetDestinationId: 'house',
    phase: 'idle', action: 'idle', paused: false, runnable: true, activity: 'drink', activityFallback: true,
    bowlFilledToday: true, lastDrinkAt: null });
  expect(snapshot.activityFallback).toBe(true);
  const block = yardBlock({ ...snapshot, available: true, error: null, sessionId: 'fixture', generation: 'fixture', observedAt: new Date() });
  expect(block).toContain('不能据此说已睡着、已理毛或已喝水');
  expect(block).toContain('你今天还没喝过水');
  expect(snapshotSchema.safeParse({ ...snapshot, phase: 'moving', action: 'walk' }).success).toBe(true);
});
