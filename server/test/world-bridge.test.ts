import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, messages, turns, users } from '../src/db/schema.ts';
import { worldActions, worldSessions } from '../src/db/schema-world.ts';
import { acknowledge, cancelRequestedActions, getActionStatus, getWorldState, moveCat, pollCommands, putState, registerSession } from '../src/world/service.ts';
import { snapshotSchema, type WorldSnapshot } from '../src/world/protocol.ts';
import { DEFAULT_TRAITS } from '../src/runtime/persona.ts';
const ids: string[] = [];
async function fixture() {
  const [user] = await db.insert(users).values({ name: 'world-test' }).returning(); ids.push(user!.id);
  const [cat] = await db.insert(cats).values({ userId: user!.id, name: '团子', appearance: 'orange', temperament: 'slow', traits: DEFAULT_TRAITS }).returning();
  const [conv] = await db.insert(conversations).values({ catId: cat!.id }).returning();
  const [message] = await db.insert(messages).values({ conversationId: conv!.id, role: 'user', text: '去池塘', clientMessageId: randomUUID() }).returning();
  const [turn] = await db.insert(turns).values({ conversationId: conv!.id, userMessageId: message!.id, inputVersion: 0, status: 'generating' }).returning();
  const session = await registerSession(cat!.id);
  const snapshot: WorldSnapshot = { stateVersion: 1, sceneVersion: 4, destinationIds: ['tree', 'pond'], currentDestinationId: 'tree', targetDestinationId: 'tree', phase: 'idle', action: 'nestLook', paused: false, runnable: true };
  await putState(cat!.id, session.sessionId, session.generation, snapshot);
  await pollCommands(cat!.id, session.sessionId, session.generation);
  const input = { catId: cat!.id, turnId: turn!.id, userMessageId: message!.id, destinationId: 'pond', stateVersion: 1, sessionId: session.sessionId, generation: session.generation };
  return { input, snapshot };
}
afterAll(async () => { for (const id of ids) await db.delete(users).where(eq(users.id, id)); await sql.end(); });
describe('世界动作真实 PG 状态机', () => {
  it('协议地点与 App 实际加载的 scene.json 一致', () => {
    const scene = JSON.parse(readFileSync(new URL('../../ios/Maomao/Assets.xcassets/world-scene-v4.dataset/data.json', import.meta.url), 'utf8'));
    expect(snapshotSchema.safeParse({stateVersion: 0, sceneVersion: scene.version, destinationIds: scene.destinations.map((d: {id: string}) => d.id), currentDestinationId: 'house', targetDestinationId: 'house', phase: 'idle', action: 'idle', paused: false, runnable: true}).success).toBe(true);
  });
  it('发送重复与重新回复只有一个动作，到达之前不能算 arrived', async () => {
    const { input, snapshot } = await fixture();
    const [a,b] = await Promise.all([moveCat(input), moveCat(input)]); expect(a.id).toBe(b.id);
    await acknowledge(input.catId, a.id, input.sessionId, input.generation, 'accepted', snapshot);
    expect((await getActionStatus(input.catId, a.id)).status).toBe('accepted');
    await expect(acknowledge(input.catId, a.id, input.sessionId, input.generation, 'arrived', snapshot)).rejects.toMatchObject({ code: 'arrival_not_observed' });
    const arrived = { ...snapshot, stateVersion: 2, currentDestinationId: 'pond' as const, targetDestinationId: 'pond' as const };
    await acknowledge(input.catId, a.id, input.sessionId, input.generation, 'arrived', arrived);
    await expect(acknowledge(input.catId, a.id, input.sessionId, input.generation, 'running', arrived)).rejects.toMatchObject({ code: 'invalid_transition' });
    const [original] = await db.select().from(turns).where(eq(turns.id, input.turnId));
    const [retry] = await db.insert(turns).values({ conversationId: original!.conversationId, userMessageId: input.userMessageId, inputVersion: 0, status: 'generating' }).returning();
    expect((await moveCat({ ...input, turnId: retry!.id })).id).toBe(a.id);
    expect((await db.select().from(worldActions).where(eq(worldActions.catId, input.catId)))).toHaveLength(1);
  });
  it('断线后历史 running 和 arrived 回执保留事实，但不回退较新的世界观察', async () => {
    const { input, snapshot } = await fixture(); const action = await moveCat(input);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'accepted', snapshot);
    const running = { ...snapshot, stateVersion: 2, targetDestinationId: 'pond' as const, phase: 'moving' as const };
    const arrived = { ...snapshot, stateVersion: 3, currentDestinationId: 'pond' as const, targetDestinationId: 'pond' as const };
    const latest = { ...snapshot, stateVersion: 4 };
    await putState(input.catId, input.sessionId, input.generation, latest);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'running', running);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'arrived', arrived);
    expect((await getActionStatus(input.catId, action.id)).status).toBe('arrived');
    const [session] = await db.select().from(worldSessions).where(eq(worldSessions.catId, input.catId));
    expect(session!.snapshot).toEqual(latest);
  });
  it('accepted 响应丢失后原请求重试恢复已接收事实，世界变化后可以正确中断', async () => {
    const { input, snapshot } = await fixture(); const action = await moveCat(input);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'accepted', snapshot);
    const latest = { ...snapshot, stateVersion: 2, action: 'idle' };
    await putState(input.catId, input.sessionId, input.generation, latest);
    expect((await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'accepted', snapshot)).status).toBe('accepted');
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'interrupted', latest, 'world_changed');
    expect((await getActionStatus(input.catId, action.id)).status).toBe('interrupted');
  });
  it('执行超时后可补到期前到达证据，到期后的事件不能伪装及时到达', async () => {
    const { input, snapshot } = await fixture(); const action = await moveCat(input);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'accepted', snapshot);
    const occurredAt = new Date(action.requestedAt.getTime() + 1);
    await db.update(worldActions).set({ requestedAt: new Date(action.requestedAt.getTime() - 10_000), finishBefore: new Date(action.requestedAt.getTime() - 1) }).where(eq(worldActions.id, action.id));
    const arrived = { ...snapshot, stateVersion: 2, currentDestinationId: 'pond' as const, targetDestinationId: 'pond' as const };
    expect((await getActionStatus(input.catId, action.id)).status).toBe('expired');
    await expect(acknowledge(input.catId, action.id, input.sessionId, input.generation, 'arrived', arrived, undefined, occurredAt)).rejects.toMatchObject({ code: 'invalid_transition' });
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'arrived', arrived, undefined, new Date(action.requestedAt.getTime() - 2));
    expect((await getActionStatus(input.catId, action.id)).status).toBe('arrived');
  });
  it('暂停中断动作，新session不能让旧回执覆盖观察', async () => {
    const { input, snapshot } = await fixture(); const action = await moveCat(input);
    await acknowledge(input.catId, action.id, input.sessionId, input.generation, 'accepted', snapshot);
    await putState(input.catId, input.sessionId, input.generation, { ...snapshot, stateVersion: 2, paused: true, runnable: false });
    expect((await getActionStatus(input.catId, action.id)).status).toBe('interrupted');
    await registerSession(input.catId);
    await expect(putState(input.catId, input.sessionId, input.generation, snapshot)).rejects.toMatchObject({ code: 'session_replaced' });
  });
  it('取消未接收动作；已接收的动作不伪装回滚', async () => {
    const a = await fixture(); const pending = await moveCat(a.input); await cancelRequestedActions(a.input.turnId);
    expect((await getActionStatus(a.input.catId, pending.id)).status).toBe('interrupted');
    const b = await fixture(); const accepted = await moveCat(b.input);
    await acknowledge(b.input.catId, accepted.id, b.input.sessionId, b.input.generation, 'accepted', b.snapshot);
    await cancelRequestedActions(b.input.turnId);
    expect((await getActionStatus(b.input.catId, accepted.id)).status).toBe('accepted');
  });
  it('过期/旧观察/未知地点都不能发动作，缺失世界保持未知', async () => {
    const { input, snapshot } = await fixture();
    await expect(moveCat({ ...input, stateVersion: 0 })).rejects.toMatchObject({ code: 'stale_state' });
    await expect(moveCat({ ...input, destinationId: 'moon' })).rejects.toMatchObject({ code: 'unsupported_destination' });
    await db.update(worldSessions).set({ observedAt: new Date(0) }).where(eq(worldSessions.catId, input.catId));
    expect((await getWorldState(input.catId)).available).toBe(false);
    await expect(moveCat(input)).rejects.toMatchObject({ code: 'world_stale' });
    expect((await getWorldState(randomUUID())).available).toBe(false);
    expect(snapshotSchema.safeParse({ ...snapshot, sceneVersion: 3 }).success).toBe(false);
  });
});
