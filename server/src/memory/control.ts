import { and, eq, inArray, max, sql } from 'drizzle-orm';
import { db, dbNow, type Tx } from '../db/client.ts';
import { asyncJobs, cats, conversations, memories, memoryBlocks, memoryReceipts, messages, turns } from '../db/schema.ts';
import { invalidateSoulSources } from '../soul/service.ts';

export class MemoryControlError extends Error {
  constructor(public status: 404 | 409, message: string) { super(message); }
}
export async function lockMemory(tx: Tx, catId: string, expected?: number) {
  const [cat] = await tx.select().from(cats).where(eq(cats.id, catId)).for('update');
  if (!cat) throw new MemoryControlError(404, '没有这只猫');
  if (expected !== undefined && cat.memoryRevision !== expected) throw new MemoryControlError(409, '内容已经变化，请刷新后再操作');
  return cat;
}
export async function bumpMemory(tx: Tx, catId: string) {
  await tx.update(cats).set({ memoryRevision: sql`${cats.memoryRevision} + 1` }).where(eq(cats.id, catId));
}
export async function latestSeq(tx: Tx, catId: string) {
  const [row] = await tx.select({ seq: max(messages.seq) }).from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId)).where(eq(conversations.catId, catId));
  return row?.seq ?? 0;
}
export async function memorySources(tx: Tx, catId: string, fingerprint: string) {
  const rows = await tx.select({ id: memories.sourceMessageId }).from(memories)
    .where(and(eq(memories.catId, catId), eq(memories.fingerprint, fingerprint)));
  const receipts = await tx.select({ id: memoryReceipts.sourceMessageId }).from(memoryReceipts)
    .where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, fingerprint), eq(memoryReceipts.accepted, true)));
  const ids = [...new Set([...rows, ...receipts].map(r => r.id))];
  if (!ids.length) return [];
  return (await tx.select({ id: messages.id }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(conversations.catId, catId), inArray(messages.id, ids)))).map(m => m.id);
}
export async function removeAspect(tx: Tx, catId: string, fingerprint: string) {
  const sources = await memorySources(tx, catId, fingerprint);
  await invalidateSoulSources(tx, catId, sources);
  if (sources.length) {
    await tx.update(turns).set({ remembered: false }).where(inArray(turns.userMessageId, sources));
    await tx.update(asyncJobs).set({ remembered: false }).where(and(eq(asyncJobs.kind, 'memory'), inArray(asyncJobs.sourceId, sources)));
  }
  const seq = await latestSeq(tx, catId);
  await tx.insert(memoryBlocks).values({ catId, fingerprint, sourceSeq: seq })
    .onConflictDoUpdate({ target: [memoryBlocks.catId, memoryBlocks.fingerprint], set: { sourceSeq: seq, createdAt: dbNow() } });
  await tx.delete(memories).where(and(eq(memories.catId, catId), eq(memories.fingerprint, fingerprint)));
  await tx.update(memoryReceipts).set({ accepted: false }).where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, fingerprint)));
}

/** 沿实际输入记录找派生回复。迁移前未记录输入的回复采用保守规则：该原话之后的旧回复均停用。 */
export async function sourceImpact(tx: Tx, catId: string, sourceIds: string[]) {
  const all = await tx.select({ message: messages }).from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(eq(conversations.catId, catId)).orderBy(messages.seq);
  const owned = all.map(r => r.message);
  const seeds = owned.filter(m => sourceIds.includes(m.id));
  if (seeds.length !== sourceIds.length) throw new MemoryControlError(404, '找不到原话');
  const ids = new Set(sourceIds);
  const legacyIds = new Set<string>();
  // 更早版本没有 turn 的猫回复也可能复述原话，不能因缺来源记录而漏过。
  for (const m of owned) if (m.role === 'cat' && !m.turnId && m.seq > Math.min(...seeds.map(s => s.seq))) { ids.add(m.id); legacyIds.add(m.id); }
  const catTurns = await tx.select({ turn: turns }).from(turns).innerJoin(conversations, eq(conversations.id, turns.conversationId)).where(eq(conversations.catId, catId));
  const allMemories = await tx.select().from(memories).where(eq(memories.catId, catId));
  const receipts = await tx.select().from(memoryReceipts).where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.accepted, true)));
  let changed = true;
  while (changed) {
    changed = false;
    const aspects = new Set([...allMemories.filter(m => ids.has(m.sourceMessageId)).map(m => m.fingerprint), ...receipts.filter(r => ids.has(r.sourceMessageId)).map(r => r.fingerprint)]);
    const memoryIds = new Set(allMemories.filter(m => aspects.has(m.fingerprint)).map(m => m.id));
    for (const { turn: t } of catTurns) {
      const reply = owned.find(m => m.id === t.catMessageId);
      if (!reply || ids.has(reply.id)) continue;
      const depends = ids.has(t.userMessageId) || t.contextSourceIds?.some(id => ids.has(id)) || t.memoryIds.some(id => memoryIds.has(id));
      const legacy = t.contextSourceIds === null && reply.seq > Math.min(...seeds.map(m => m.seq));
      if (depends || legacy) { ids.add(reply.id); if (legacy && !depends) legacyIds.add(reply.id); changed = true; }
    }
  }
  const aspects = new Set([...allMemories.filter(m => ids.has(m.sourceMessageId)).map(m => m.fingerprint), ...receipts.filter(r => ids.has(r.sourceMessageId)).map(r => r.fingerprint)]);
  return { sourceIds: [...ids], legacyIds: [...legacyIds], messages: owned.filter(m => ids.has(m.id)), memories: allMemories.filter(m => aspects.has(m.fingerprint)), aspects: [...aspects] };
}
export async function withdrawSources(tx: Tx, catId: string, sourceIds: string[]) {
  const impact = await sourceImpact(tx, catId, sourceIds);
  if (impact.sourceIds.length) await tx.update(messages).set({ contextAllowed: false, memoryEligible: false }).where(inArray(messages.id, impact.sourceIds));
  for (const aspect of impact.aspects) await removeAspect(tx, catId, aspect);
  await invalidateSoulSources(tx, catId, impact.sourceIds);
  await bumpMemory(tx, catId);
  return impact;
}
export async function editMemory(catId: string, id: string, value: string, revision: number) {
  return db.transaction(async tx => {
    await lockMemory(tx, catId);
    const [m] = await tx.select().from(memories).where(and(eq(memories.catId, catId), eq(memories.id, id)));
    if (!m) throw new MemoryControlError(404, '这条记忆已不存在');
    const [source] = await tx.select().from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(and(eq(messages.id, m.sourceMessageId), eq(conversations.catId, catId), eq(messages.contextAllowed, true), eq(messages.role, 'user')));
    if (!source) throw new MemoryControlError(409, '原话已停用或来源无法核对，请在聊天中重新说明');
    // 回执丢失后的同值重试安全返回；旧版本不能覆盖后来编辑。
    if (m.revision !== revision) {
      if (m.value === value && m.status === 'active') return;
      throw new MemoryControlError(409, '记忆已经变化，请刷新后再改');
    }
    await invalidateSoulSources(tx, catId, await memorySources(tx, catId, m.fingerprint));
    await tx.update(memories).set({ status: 'superseded' }).where(and(eq(memories.catId, catId), eq(memories.fingerprint, m.fingerprint)));
    await tx.update(memories).set({ value, status: 'active', explicit: true, confidence: 1, extractorVersion: 'user-edit-v1',
      editedThroughSeq: await latestSeq(tx, catId), revision: m.revision + 1, lastConfirmedAt: dbNow() }).where(eq(memories.id, id));
    await bumpMemory(tx, catId);
  });
}
export async function settings(catId: string) {
  const [cat] = await db.select().from(cats).where(eq(cats.id, catId));
  return { learn: cat!.learnMemories, use: cat!.useMemories, revision: cat!.memoryRevision };
}
export async function changeSettings(catId: string, input: { learn?: boolean; use?: boolean; revision: number }) {
  await db.transaction(async tx => {
    const cat = await lockMemory(tx, catId, input.revision);
    const turningOff = input.learn === false && cat.learnMemories;
    await tx.update(cats).set({ learnMemories: input.learn ?? cat.learnMemories, useMemories: input.use ?? cat.useMemories,
      // 关闭时取消此前未完成提取；关闭期间发送的消息另有不可变许可快照。
      learnAfterSeq: turningOff ? await latestSeq(tx, catId) : cat.learnAfterSeq }).where(eq(cats.id, catId));
    await bumpMemory(tx, catId);
  });
  return settings(catId);
}
