import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, dbNow } from '../db/client.ts';
import { cats, conversations, messages, turns } from '../db/schema.ts';
import { ensureMemoryJob } from '../jobs/store.ts';

export async function claimTurn(id: string) {
  return (await db.update(turns).set({ status: 'generating', startedAt: dbNow(), heartbeatAt: dbNow() })
    .where(and(eq(turns.id, id), eq(turns.status, 'queued'))).returning()).length > 0;
}

export async function authorizeFirstToken(id: string): Promise<'allowed' | 'superseded' | 'terminal'> {
  return db.transaction(async (tx) => {
    const [initial] = await tx.select().from(turns).where(eq(turns.id, id));
    if (!initial) return 'terminal';
    const [conv] = await tx.select().from(conversations).where(eq(conversations.id, initial.conversationId)).for('update');
    const [turn] = await tx.select().from(turns).where(eq(turns.id, id)).for('update');
    if (!turn || turn.status !== 'generating') return 'terminal';
    if (!turn.firstTokenAt && conv!.version > turn.inputVersion) return 'superseded';
    await tx.update(turns).set({ firstTokenAt: turn.firstTokenAt ?? dbNow() }).where(eq(turns.id, id));
    return 'allowed';
  });
}

export type Outcome = { status: 'completed' | 'stopped' | 'failed' | 'superseded'; text?: string; error?: string; staleBeforeMs?: number };
export async function commitOutcome(id: string, outcome: Outcome) {
  return db.transaction(async (tx) => {
    const [initial] = await tx.select().from(turns).where(eq(turns.id, id));
    let memoryRevision: number | undefined;
    if (initial) {
      const [conv] = await tx.select().from(conversations).where(eq(conversations.id, initial.conversationId));
      if (conv) {
        const [cat] = await tx.select().from(cats).where(eq(cats.id, conv.catId)).for('update');
        memoryRevision = cat?.memoryRevision;
      }
      await tx.select().from(conversations).where(eq(conversations.id, initial.conversationId)).for('update');
    }
    const [turn] = await tx.select().from(turns).where(eq(turns.id, id)).for('update');
    if (!turn || !['queued', 'generating'].includes(turn.status)) return { applied: false, turn, catMessageId: turn?.catMessageId ?? null };
    if (outcome.staleBeforeMs !== undefined) {
      const [stale] = await tx.select({ id: turns.id }).from(turns).where(and(eq(turns.id, id),
        sql`coalesce(${turns.heartbeatAt}, ${turns.createdAt}) < now() - ${`${outcome.staleBeforeMs} milliseconds`}::interval`));
      if (!stale) return { applied: false, turn, catMessageId: turn.catMessageId };
    }
    if (turn.contextRevision !== null && turn.contextRevision !== memoryRevision && (outcome.status === 'completed' || outcome.status === 'stopped')) outcome = { status: 'failed', error: 'context_changed' };
    let catMessageId: string | null = null;
    if ((outcome.status === 'completed' || outcome.status === 'stopped') && outcome.text) {
      const [message] = await tx.insert(messages).values({ conversationId: turn.conversationId, role: 'cat', text: outcome.text,
        turnId: id, status: outcome.status === 'stopped' ? 'stopped' : 'done' }).returning();
      catMessageId = message!.id;
    }
    const [updated] = await tx.update(turns).set({ status: outcome.status, catMessageId,
      error: outcome.error?.slice(0, 2000) ?? null, finishedAt: dbNow() }).where(eq(turns.id, id)).returning();
    if (outcome.status === 'completed' || outcome.status === 'stopped') await ensureMemoryJob(tx, updated!);
    return { applied: true, turn: updated, catMessageId };
  });
}
