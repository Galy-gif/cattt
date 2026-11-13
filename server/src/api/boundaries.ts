import { bumpMemory } from '../memory/control.ts';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './auth.ts';
import { bad, notFound } from './responses.ts';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { boundaries, cats, messages, turns } from '../db/schema.ts';
import { ensureBoundaryJob } from '../jobs/store.ts';
import { invalidateSoulSources } from '../soul/service.ts';

export const boundariesRoutes = new Hono<Env>();

boundariesRoutes.get('/boundaries', async (c) => {
  const rows = await db
    .select({
      id: boundaries.id,
      description: boundaries.description,
      text: messages.text,
      sourceMessageId: boundaries.sourceMessageId,
      createdAt: boundaries.createdAt,
    })
    .from(boundaries)
    .innerJoin(messages, eq(messages.id, boundaries.sourceMessageId))
    .where(eq(boundaries.catId, c.get('owner').catId))
    .orderBy(desc(boundaries.createdAt));
  return c.json({
    boundaries: rows.map((b) => ({
      id: b.id,
      description: b.description,
      source_message_id: b.sourceMessageId,
      source_text: b.text,
      created_at: b.createdAt,
    })),
  });
});

/** 「不要再提」：标在猫说的那条消息上 */
boundariesRoutes.post('/messages/:id/boundary', async (c) => {
  const owner = c.get('owner');
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const [msg] = await db
    .select({ id: messages.id, turnId: messages.turnId })
    .from(messages)
    .where(and(eq(messages.id, id.data), eq(messages.conversationId, owner.conversationId), eq(messages.role, 'cat')));
  if (!msg) return c.json(notFound, 404);
  await db.transaction(async (tx) => {
    await tx.select().from(cats).where(eq(cats.id, owner.catId)).for('update');
    const [row] = await tx.insert(boundaries).values({ catId: owner.catId, sourceMessageId: msg.id })
      .onConflictDoNothing().returning({ id: boundaries.id });
    const [sourceTurn] = msg.turnId ? await tx.select({ source: turns.userMessageId }).from(turns).where(eq(turns.id, msg.turnId)) : [];
    await invalidateSoulSources(tx, owner.catId, [msg.id, ...(sourceTurn ? [sourceTurn.source] : [])]);
    if (row) { await ensureBoundaryJob(tx, row.id); await bumpMemory(tx, owner.catId); }
  });
  return c.json({ ok: true });
});

/** 撤销只移除边界，不恢复已删除的记忆或已停用的原话。 */
boundariesRoutes.delete('/boundaries/:id', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  await db.transaction(async tx => {
    const catId = c.get('owner').catId;
    await tx.select().from(cats).where(eq(cats.id, catId)).for('update');
    const removed = await tx.delete(boundaries).where(and(eq(boundaries.id, id.data), eq(boundaries.catId, catId))).returning();
    if (removed.length) await bumpMemory(tx, catId);
  });
  return c.json({ ok: true });
});
