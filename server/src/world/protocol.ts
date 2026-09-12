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
  paused: z.boolean(),
  runnable: z.boolean(),
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
