import { diaryAllowed } from '../agent/gate.ts';
import { and, eq, sql } from 'drizzle-orm';
import { db, dbNow, type Tx } from '../db/client.ts';
import { asyncJobs, diaryEntries, messages, turns } from '../db/schema.ts';
import { bumpMemory, lockMemory, MemoryControlError, withdrawSources } from '../memory/control.ts';

export type DiaryInput = {
  client_id: string; kind: 'text' | 'cat'; text: string; recorded_at: string;
  time_zone: string; day: string; time: string; cat_allowed: boolean;
  revision: number; mutation_id: string;
};
export type DiaryRow = typeof diaryEntries.$inferSelect;
export const diaryJSON = (r: DiaryRow) => ({
  id: r.id, seq: r.seq, client_id: r.clientId, kind: r.kind, text: r.text,
  recorded_at: r.recordedAt.toISOString(), time_zone: r.timeZone, day: r.day, time: r.time,
  cat_allowed: r.catAllowed, revision: r.revision, mutation_id: r.mutationId, visit: r.visit, note: r.note,
});
export class DiaryConflict extends Error { constructor(public current: DiaryRow) { super('diary_changed'); } }

export async function readableDiary(catId: string, id: string, tx: Tx | typeof db = db) {
  const [entry] = await tx.select().from(diaryEntries).where(and(eq(diaryEntries.catId, catId), eq(diaryEntries.id, id)));
  return diaryAllowed(entry, catId) ? entry : undefined;
}

async function invalidateDiary(tx: Tx, catId: string, id: string) {
  const sources = await tx.select({ id: messages.id }).from(messages).where(eq(messages.diaryEntryId, id));
  const dependent = await tx.select().from(turns).where(sql`${turns.diarySourceIds} @> ARRAY[${id}]::uuid[]`);
  const seeds = [...new Set([...sources.map(s => s.id), ...dependent.flatMap(t => t.catMessageId ? [t.catMessageId] : [])])];
  if (seeds.length) await withdrawSources(tx, catId, seeds);
  else await bumpMemory(tx, catId);
}

/** CAT 锁串行化权限、来源失效和聊天输出提交；旧重试没有重新授权的能力。 */
export async function saveDiary(catId: string, input: DiaryInput) {
  return db.transaction(async tx => {
    await lockMemory(tx, catId);
    const [old] = await tx.select().from(diaryEntries).where(and(eq(diaryEntries.catId, catId), eq(diaryEntries.clientId, input.client_id)));
    if (old?.mutationId === input.mutation_id) return old;
    if (old && old.revision !== input.revision) throw new DiaryConflict(old);
    if (!old && input.revision !== 0) throw new MemoryControlError(404, '找不到这条日记');
    const catAllowed = input.kind === 'text' && input.cat_allowed;
    const contentChanged = !!old && (old.text !== input.text || old.catAllowed !== catAllowed);
    if (contentChanged) await invalidateDiary(tx, catId, old.id);
    const values = {
      catId, clientId: input.client_id, kind: input.kind, text: input.text,
      recordedAt: new Date(input.recorded_at), timeZone: input.time_zone, day: input.day, time: input.time,
      catAllowed, revision: (old?.revision ?? 0) + 1, mutationId: input.mutation_id,
      visit: contentChanged ? 0 : old?.visit ?? 0, note: contentChanged ? '' : old?.note ?? '', updatedAt: dbNow(),
    };
    // 来源身份/日期一经创建不可换壳，避免把旧来源变成另一条正文。
    if (old && (old.kind !== input.kind || old.day !== input.day || old.timeZone !== input.time_zone || old.recordedAt.getTime() !== new Date(input.recorded_at).getTime() || old.time !== input.time)) throw new DiaryConflict(old);
    const [row] = old
      ? await tx.update(diaryEntries).set(values).where(eq(diaryEntries.id, old.id)).returning()
      : await tx.insert(diaryEntries).values(values).returning();
    if (catAllowed && (!old || contentChanged)) {
      await bumpMemory(tx, catId);
      await tx.insert(asyncJobs).values({ kind: 'diary_read', sourceId: row!.id, objectId: row!.id, version: String(row!.revision) }).onConflictDoNothing();
    }
    return row!;
  });
}
