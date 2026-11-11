import { recordDiaryObservation } from '../agent/daily-diary.ts';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { cats, conversations, turns } from '../db/schema.ts';
import { worldActions, worldSessions } from '../db/schema-world.ts';
import { canTransition, executionError, WorldError, type ActionStatus, type WorldSnapshot } from './protocol.ts';

async function lockCat(tx: Tx, catId: string) {
  const [cat] = await tx.select({ id: cats.id }).from(cats).where(eq(cats.id, catId)).for('update');
  if (!cat) throw new WorldError('not_found');
}
async function now(tx: Tx): Promise<Date> {
  const result = await tx.execute<{ instant: Date | string }>(sql`select now() as instant`);
  return new Date(result[0]!.instant);
}
async function expire(tx: Tx, catId: string, instant: Date) {
  await tx.update(worldActions).set({ status: 'expired', reason: 'accept_timeout', updatedAt: instant })
    .where(and(eq(worldActions.catId, catId), eq(worldActions.status, 'requested'), lte(worldActions.acceptBefore, instant)));
  await tx.update(worldActions).set({ status: 'expired', reason: 'execution_timeout', updatedAt: instant })
    .where(and(eq(worldActions.catId, catId), inArray(worldActions.status, ['accepted', 'running']), lte(worldActions.finishBefore, instant)));
}
export async function registerSession(catId: string) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const instant = await now(tx);
    await tx.update(worldActions).set({ status: 'interrupted', reason: 'session_replaced', updatedAt: instant })
      .where(and(eq(worldActions.catId, catId), inArray(worldActions.status, ['requested', 'accepted', 'running'])));
    const [session] = await tx.insert(worldSessions).values({ catId })
      .onConflictDoUpdate({ target: worldSessions.catId, set: { id: randomUUID(), generation: randomUUID(), stateVersion: -1, snapshot: null, observedAt: null, onlineUntil: null } }).returning();
    return { sessionId: session!.id, generation: session!.generation, serverTime: instant };
  });
}
async function ownedSession(tx: Tx, catId: string, sessionId: string, generation: string) {
  const [session] = await tx.select().from(worldSessions).where(and(eq(worldSessions.catId, catId), eq(worldSessions.id, sessionId), eq(worldSessions.generation, generation)));
  if (!session) throw new WorldError('session_replaced');
  return session;
}
export async function putState(catId: string, sessionId: string, generation: string, snapshot: WorldSnapshot) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const session = await ownedSession(tx, catId, sessionId, generation);
    const instant = await now(tx);
    if (snapshot.stateVersion < session.stateVersion) throw new WorldError('stale_state');
    // Same version may renew freshness, but must describe precisely the same observation.
    if (snapshot.stateVersion === session.stateVersion && !isDeepStrictEqual(snapshot, session.snapshot)) throw new WorldError('state_version_conflict');
    await tx.update(worldSessions).set({ stateVersion: snapshot.stateVersion, snapshot, observedAt: instant }).where(eq(worldSessions.id, sessionId));
    if (snapshot.paused || !snapshot.runnable) {
      await tx.update(worldActions).set({ status: 'interrupted', reason: 'world_paused', updatedAt: instant })
        .where(and(eq(worldActions.catId, catId), inArray(worldActions.status, ['requested', 'accepted', 'running'])));
    }
    await recordDiaryObservation(tx, catId, snapshot, instant);
    await expire(tx, catId, instant);
    return { ok: true, serverTime: instant };
  });
}
export async function pollCommands(catId: string, sessionId: string, generation: string) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const session = await ownedSession(tx, catId, sessionId, generation);
    const instant = await now(tx);
    await tx.update(worldSessions).set({ onlineUntil: new Date(instant.getTime() + 3_000) }).where(eq(worldSessions.id, sessionId));
    await expire(tx, catId, instant);
    if (executionError(session.snapshot, session.observedAt, new Date(instant.getTime() + 3_000), instant)) return [];
    return tx.select().from(worldActions).where(and(eq(worldActions.catId, catId), eq(worldActions.sessionId, sessionId), eq(worldActions.generation, generation), eq(worldActions.status, 'requested')));
  });
}
export async function getWorldState(catId: string) {
  const [session] = await db.select({ session: worldSessions, instant: sql<Date>`now()` }).from(worldSessions).where(eq(worldSessions.catId, catId));
  if (!session) return { available: false as const, error: 'world_unavailable' };
  const error = executionError(session.session.snapshot, session.session.observedAt, session.session.onlineUntil, new Date(session.instant));
  return { available: !error, error, sessionId: session.session.id, generation: session.session.generation,
    observedAt: session.session.observedAt, ...session.session.snapshot };
}
export type MoveInput = { catId: string; turnId: string; userMessageId: string; destinationId: string; stateVersion: number; sessionId: string; generation: string };
export async function moveCat(input: MoveInput) {
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ conversationId: conversations.id }).from(turns)
      .innerJoin(conversations, eq(conversations.id, turns.conversationId))
      .where(and(eq(turns.id, input.turnId), eq(turns.userMessageId, input.userMessageId), eq(conversations.catId, input.catId)));
    if (!owned) throw new WorldError('turn_not_running');
    // 与新消息/终态提交共用 conversation 锁，关闭资格检查和动作入账之间的窗口。
    await tx.select().from(conversations).where(eq(conversations.id, owned.conversationId)).for('update');
    await lockCat(tx, input.catId);
    const instant = await now(tx);
    await expire(tx, input.catId, instant);
    const [existing] = await tx.select().from(worldActions).where(and(eq(worldActions.catId, input.catId), eq(worldActions.userMessageId, input.userMessageId)));
    if (existing) {
      if (existing.destinationId !== input.destinationId) throw new WorldError('action_already_requested');
      return existing;
    }
    // Recheck persisted turn eligibility in the same critical section before creating a command.
    const [turn] = await tx.select().from(turns).where(and(eq(turns.id, input.turnId), eq(turns.userMessageId, input.userMessageId)));
    if (!turn || turn.status !== 'generating') throw new WorldError('turn_not_running');
    const session = await ownedSession(tx, input.catId, input.sessionId, input.generation);
    const error = executionError(session.snapshot, session.observedAt, session.onlineUntil, instant);
    if (error) throw new WorldError(error);
    if (session.stateVersion !== input.stateVersion) throw new WorldError('stale_state');
    if (!session.snapshot!.destinationIds.includes(input.destinationId as never)) throw new WorldError('unsupported_destination');
    const [busy] = await tx.select({ id: worldActions.id }).from(worldActions).where(and(eq(worldActions.catId, input.catId), inArray(worldActions.status, ['requested', 'accepted', 'running']))).limit(1);
    if (busy) throw new WorldError('world_busy');
    const [action] = await tx.insert(worldActions).values({ ...input, acceptBefore: new Date(instant.getTime() + 5_000), finishBefore: new Date(instant.getTime() + 60_000), requestedAt: instant, updatedAt: instant }).returning();
    return action!;
  });
}
export async function getActionStatus(catId: string, actionId: string) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    await expire(tx, catId, await now(tx));
    const [action] = await tx.select().from(worldActions).where(and(eq(worldActions.catId, catId), eq(worldActions.id, actionId)));
    if (!action) throw new WorldError('not_found');
    return action;
  });
}
export async function acknowledge(catId: string, actionId: string, sessionId: string, generation: string, status: ActionStatus, snapshot: WorldSnapshot, reason?: string, occurredAt?: Date) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const session = await ownedSession(tx, catId, sessionId, generation);
    const instant = await now(tx);
    await expire(tx, catId, instant);
    const [action] = await tx.select().from(worldActions).where(and(eq(worldActions.catId, catId), eq(worldActions.id, actionId), eq(worldActions.sessionId, sessionId), eq(worldActions.generation, generation)));
    if (!action) throw new WorldError('not_found');
    if (action.status === status) return action;
    // 设备是动作执行事实的权威；仅恢复执行超时，取消/抢占/换会话不能复活。
    const completedInTime = status === 'arrived' && occurredAt != null && Number.isFinite(occurredAt.getTime())
      && occurredAt >= action.requestedAt && occurredAt <= action.finishBefore && occurredAt <= instant;
    const recoverTimedOutArrival = action.status === 'expired' && action.reason === 'execution_timeout' && completedInTime;
    if (!canTransition(action.status, status) && !recoverTimedOutArrival) throw new WorldError('invalid_transition');
    if (status === 'arrived' && occurredAt && !completedInTime) throw new WorldError('invalid_event_time');
    if (status === 'accepted' && snapshot.stateVersion < session.stateVersion) throw new WorldError('stale_state');
    if (snapshot.stateVersion < action.stateVersion) throw new WorldError('stale_state');
    if (snapshot.stateVersion === session.stateVersion && !isDeepStrictEqual(snapshot, session.snapshot)) throw new WorldError('state_version_conflict');
    if (status === 'accepted' && (snapshot.paused || !snapshot.runnable || action.stateVersion !== snapshot.stateVersion)) throw new WorldError('world_changed');
    if (status === 'arrived' && (snapshot.currentDestinationId !== action.destinationId || snapshot.targetDestinationId !== action.destinationId || ['moving', 'approaching', 'exiting'].includes(snapshot.phase) || snapshot.paused)) throw new WorldError('arrival_not_observed');
    // 动作回执记录历史执行事实；比当前观察旧的回执不能倒退世界。
    if (snapshot.stateVersion > session.stateVersion) {
      await tx.update(worldSessions).set({ snapshot, stateVersion: snapshot.stateVersion, observedAt: occurredAt ?? instant }).where(eq(worldSessions.id, sessionId));
    }
    if (status === 'arrived') await recordDiaryObservation(tx, catId, snapshot, occurredAt ?? instant);
    const [updated] = await tx.update(worldActions).set({ status, reason: reason ?? null, updatedAt: instant }).where(eq(worldActions.id, actionId)).returning();
    return updated!;
  });
}
export async function cancelRequestedActions(turnId: string) {
  await db.update(worldActions).set({ status: 'interrupted', reason: 'turn_cancelled', updatedAt: sql`now()` }).where(and(eq(worldActions.turnId, turnId), eq(worldActions.status, 'requested')));
}
