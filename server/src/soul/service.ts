import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { boundaries, cats, conversations, messages, turns } from '../db/schema.ts';
import { catRuntimeStates, personalityVersions, runtimeEvents, soulVersions, soulBlockedSources, turnSoulSnapshots } from '../db/schema-soul.ts';
import { baseline, evolveEntries, recoverState, soulMarkdown, soulAdjustmentBody, runtimeInputSchema, type RuntimeState, type SoulEntry } from './rules.ts';

export class SoulInputError extends Error {}
async function clock(tx: Tx): Promise<Date> {
  const rows = await tx.execute(sql`select now() as now`);
  return new Date(rows[0]!.now as string);
}
async function lockCat(tx: Tx, catId: string) {
  const [cat] = await tx.select().from(cats).where(eq(cats.id, catId)).for('update');
  if (!cat) throw new SoulInputError('没有这只猫');
  return cat;
}
async function source(tx: Tx, catId: string, messageId: string) {
  const [msg] = await tx.select({ id: messages.id }).from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.catId, catId), eq(messages.id, messageId), eq(messages.role, 'user')));
  if (!msg) throw new SoulInputError('来源必须是这只猫对话中的用户消息');
  const [blocked] = await tx.select().from(boundaries).where(and(eq(boundaries.catId, catId), eq(boundaries.sourceMessageId, messageId)));
  if (blocked) throw new SoulInputError('来源已经被设为边界');
  const [withdrawn] = await tx.select().from(soulBlockedSources).where(and(eq(soulBlockedSources.catId, catId), eq(soulBlockedSources.sourceMessageId, messageId)));
  if (withdrawn) throw new SoulInputError('来源已撤回，需新的明确调整');
}
async function ensure(tx: Tx, cat: typeof cats.$inferSelect) {
  const profile = { name: cat.name, appearance: cat.appearance, temperament: cat.temperament, traits: cat.traits };
  await tx.insert(personalityVersions).values({ catId: cat.id, version: cat.personaVersion, profile }).onConflictDoNothing();
  let [soul] = await tx.select().from(soulVersions).where(eq(soulVersions.catId, cat.id)).orderBy(desc(soulVersions.version)).limit(1);
  if (!soul) [soul] = await tx.insert(soulVersions).values({ catId: cat.id, version: 1, personaVersion: cat.personaVersion, entries: [], markdown: soulMarkdown(cat.name, 1, cat.personaVersion, []), reason: '建立独立档案；尚无成长经历' }).returning();
  return soul!;
}
async function advance(tx: Tx, catId: string, now: Date) {
  let [runtime] = await tx.select().from(catRuntimeStates).where(eq(catRuntimeStates.catId, catId));
  if (!runtime) [runtime] = await tx.insert(catRuntimeStates).values({ catId, state: baseline(now) }).returning();
  const state = recoverState(runtime!.state, now);
  if (state !== runtime!.state) [runtime] = await tx.update(catRuntimeStates).set({ state, version: runtime!.version + 1 }).where(eq(catRuntimeStates.catId, catId)).returning();
  return runtime!;
}
export async function getSoul(catId: string) {
  return db.transaction(async tx => {
    const cat = await lockCat(tx, catId);
    const soul = await ensure(tx, cat);
    const runtime = await advance(tx, catId, await clock(tx));
    return { soul, runtime, personaVersion: cat.personaVersion, profile: cat };
  });
}
export async function adjustSoul(catId: string, input: unknown) {
  const parsed = soulAdjustmentBody.safeParse(input);
  if (!parsed.success) throw new SoulInputError('性格调整格式不正确');
  const body = parsed.data;
  return db.transaction(async tx => {
    const cat = await lockCat(tx, catId);
    await source(tx, catId, body.sourceMessageId);
    const previous = await ensure(tx, cat);
    const entries = evolveEntries(previous.entries, { ...body.adjustment, id: randomUUID(), sourceMessageId: body.sourceMessageId, status: 'active', createdAt: (await clock(tx)).toISOString(), reason: body.reason });
    if (entries === previous.entries) return previous;
    return writeVersion(tx, cat, previous.version, entries, body.reason);
  });
}
async function writeVersion(tx: Tx, cat: typeof cats.$inferSelect, parentVersion: number, entries: SoulEntry[], reason: string) {
  const version = parentVersion + 1;
  const [result] = await tx.insert(soulVersions).values({ catId: cat.id, version, parentVersion, personaVersion: cat.personaVersion, entries, reason, markdown: soulMarkdown(cat.name, version, cat.personaVersion, entries) }).returning();
  return result!;
}
export async function revokeSoul(catId: string, entryId: string) {
  return db.transaction(async tx => {
    const cat = await lockCat(tx, catId);
    const previous = await ensure(tx, cat);
    if (!previous.entries.some(e => e.id === entryId)) throw new SoulInputError('没有这个成长条目');
    const entries = previous.entries.map(e => e.id === entryId ? { ...e, status: 'withdrawn' as const } : e);
    return writeVersion(tx, cat, previous.version, entries, '用户撤回表达习惯');
  });
}
/** 在删除/边界事务内调用。历史正文一并重建，不能从旧档案复活失效来源。 */
export async function invalidateSoulSources(tx: Tx, catId: string, sourceMessageIds: string[]) {
  if (!sourceMessageIds.length) return;
  const cat = await lockCat(tx, catId);
  await tx.insert(soulBlockedSources).values(sourceMessageIds.map(sourceMessageId => ({ catId, sourceMessageId }))).onConflictDoNothing();
  const versions = await tx.select().from(soulVersions).where(eq(soulVersions.catId, catId)).orderBy(desc(soulVersions.version));
  for (const version of versions) {
    const entries = version.entries.filter(e => !sourceMessageIds.includes(e.sourceMessageId));
    if (entries.length !== version.entries.length) await tx.update(soulVersions).set({ entries, reason: '来源撤回，相关正文已移除', markdown: soulMarkdown(cat.name, version.version, version.personaVersion, entries) }).where(eq(soulVersions.id, version.id));
  }
  const [runtime] = await tx.select().from(catRuntimeStates).where(eq(catRuntimeStates.catId, catId));
  if (runtime?.state.sourceMessageId && sourceMessageIds.includes(runtime.state.sourceMessageId)) await tx.update(catRuntimeStates).set({ version: runtime.version + 1, state: baseline(await clock(tx)) }).where(eq(catRuntimeStates.catId, catId));
  await tx.delete(runtimeEvents).where(and(eq(runtimeEvents.catId, catId), inArray(runtimeEvents.sourceMessageId, sourceMessageIds)));
  // 快照不含成长正文；清除撤回事件的临时状态，避免重新导出失效数据。
  const snapshots = await tx.select().from(turnSoulSnapshots).where(eq(turnSoulSnapshots.catId, catId));
  for (const snapshot of snapshots) if (snapshot.state.sourceMessageId && sourceMessageIds.includes(snapshot.state.sourceMessageId)) await tx.update(turnSoulSnapshots).set({ state: baseline(await clock(tx)) }).where(eq(turnSoulSnapshots.turnId, snapshot.turnId));
}
export async function setRuntimeState(catId: string, input: unknown) {
  const parsed = runtimeInputSchema.safeParse(input);
  if (!parsed.success) throw new SoulInputError('临时状态格式不正确');
  const body = parsed.data;
  return db.transaction(async tx => {
    await lockCat(tx, catId);
    await source(tx, catId, body.sourceMessageId);
    const now = await clock(tx);
    const runtime = await advance(tx, catId, now);
    const [existing] = await tx.select().from(runtimeEvents).where(and(eq(runtimeEvents.catId, catId), eq(runtimeEvents.sourceMessageId, body.sourceMessageId)));
    if (existing) return runtime;
    const state: RuntimeState = { energy: body.energy, willingness: body.willingness, sourceMessageId: body.sourceMessageId, observedAt: now.toISOString(), expiresAt: new Date(now.getTime() + body.durationMinutes * 60000).toISOString() };
    await tx.insert(runtimeEvents).values({ catId, sourceMessageId: body.sourceMessageId, state });
    const [updated] = await tx.update(catRuntimeStates).set({ state, version: runtime.version + 1 }).where(eq(catRuntimeStates.catId, catId)).returning();
    return updated!;
  });
}
export async function snapshotSoul(catId: string, turnId?: string) {
  return db.transaction(async tx => {
    const cat = await lockCat(tx, catId);
    const soul = await ensure(tx, cat);
    const runtime = await advance(tx, catId, await clock(tx));
    const boundaryRows = await tx.select({ id: boundaries.id }).from(boundaries).where(eq(boundaries.catId, catId));
    if (turnId) {
      const [turn] = await tx.select({ id: turns.id }).from(turns).innerJoin(conversations, eq(turns.conversationId, conversations.id)).where(and(eq(turns.id, turnId), eq(conversations.catId, catId)));
      if (!turn) throw new SoulInputError('回复不属于这只猫');
      await tx.insert(turnSoulSnapshots).values({ turnId, catId, personaVersion: cat.personaVersion, soulVersion: soul.version, runtimeVersion: runtime.version, boundaryIds: boundaryRows.map(b => b.id), state: runtime.state }).onConflictDoNothing();
    }
    return { soul, runtime, cat, boundaryIds: boundaryRows.map(b => b.id) };
  });
}
