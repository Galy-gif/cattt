import { z } from 'zod';

export const destinationIds = ['house', 'tree', 'bed', 'grass', 'pond', 'fence'] as const;
export const snapshotSchema = z.object({
  stateVersion: z.number().int().nonnegative(),
  sceneVersion: z.literal(4),
  destinationIds: z.array(z.enum(destinationIds)).min(1).max(6).refine((ids) => new Set(ids).size === ids.length),
  currentDestinationId: z.enum(destinationIds),
  targetDestinationId: z.enum(destinationIds),
  phase: z.enum(['idle', 'moving', 'approaching', 'interacting', 'exiting']),
  action: z.string().min(1).max(80),
  activity: z.enum(['rest', 'watch', 'groom', 'drink', 'tilt', 'happy', 'sulk', 'sad', 'chase', 'stretch', 'run', 'scratch', 'flower']).optional(),
  activityFallback: z.boolean().optional(),
  paused: z.boolean(),
  runnable: z.boolean(),
  // 院子里的事实，聊天只读（性格系统优化方案第 2.3 节）。老版本 App 不带这些字段。
  mood: z.enum(['calm', 'happy', 'sulk', 'sad']).default('calm'),
  moodReason: z.string().max(60).default(''),
  dayPhase: z.enum(['dawn', 'day', 'dusk', 'evening', 'night']).default('day'),
  weather: z.enum(['clear', 'rain']).default('clear'),
  bowlFilledToday: z.boolean().default(false),
  lastDrinkAt: z.iso.datetime({ offset: true }).nullish(),
  placesToday: z.array(z.string().max(20)).max(40).default([]),
}).refine((s) => s.destinationIds.includes(s.currentDestinationId) && s.destinationIds.includes(s.targetDestinationId));
export type WorldSnapshot = z.infer<typeof snapshotSchema>;
export const actionStatuses = ['requested', 'accepted', 'running', 'arrived', 'rejected', 'interrupted', 'expired'] as const;
export type ActionStatus = typeof actionStatuses[number];
export const terminalStatuses: ActionStatus[] = ['arrived', 'rejected', 'interrupted', 'expired'];
export function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  if (from === to) return true;
  if (terminalStatuses.includes(from)) return false;
  if (to === 'interrupted' || to === 'expired') return true;
  if (from === 'requested') return to === 'accepted' || to === 'rejected';
  if (from === 'accepted') return to === 'running' || to === 'arrived';
  return from === 'running' && to === 'arrived';
}
export function executionError(snapshot: WorldSnapshot | null, observedAt: Date | null, onlineUntil: Date | null, now: Date): string | null {
  if (!onlineUntil || onlineUntil <= now) return 'world_offline';
  if (!snapshot || !observedAt || now.getTime() - observedAt.getTime() > 5_000) return 'world_stale';
  if (snapshot.paused || !snapshot.runnable) return 'world_paused';
  return null;
}
export class WorldError extends Error {
  constructor(public code: string) { super(code); }
}
