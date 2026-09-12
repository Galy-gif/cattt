import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './auth.ts';
import { bad, notFound } from './responses.ts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { memories } from '../db/schema.ts';
import { deleteMemory } from '../worker/memory.ts';

export const memoriesRoutes = new Hono<Env>();

// ---- 记忆 ----

memoriesRoutes.get('/memories', async (c) => {
  const rows = await db
    .select()
    .from(memories)
    .where(and(eq(memories.catId, c.get('owner').catId), inArray(memories.status, ['active', 'conflicted'])))
    .orderBy(desc(memories.lastConfirmedAt));
  return c.json({
    memories: rows.map((m) => ({
      id: m.id,
      subject: m.subject,
      predicate: m.predicate,
      value: m.value,
      status: m.status,
      explicit: m.explicit,
      sensitivity: m.sensitivity,
      source_message_id: m.sourceMessageId,
      created_at: m.createdAt,
      last_confirmed_at: m.lastConfirmedAt,
    })),
  });
});

/**
 * 删除：这一方面的所有版本（含历史版本）连正文一起删掉，留一条只有指纹的阻断记录，
 * 之后不会再被召回，也不会被重新提取（除非用户明确说「记住」）。
 */
memoriesRoutes.delete('/memories/:id', async (c) => {
  const catId = c.get('owner').catId;
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const deleted = await deleteMemory(catId, id.data);
  if (!deleted) return c.json(notFound, 404);
  return c.json({ ok: true });
});
