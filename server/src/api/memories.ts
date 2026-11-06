import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './auth.ts';
import { bad, notFound } from './responses.ts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { memories, messages, conversations } from '../db/schema.ts';
import { bumpMemory, changeSettings, editMemory, lockMemory, latestSeq, memorySources, MemoryControlError, removeAspect, settings, sourceImpact, withdrawSources } from '../memory/control.ts';

export const memoriesRoutes = new Hono<Env>();
memoriesRoutes.onError((error, c) => {
  if (error instanceof MemoryControlError) return c.json({ error: { code: error.status === 409 ? 'memory_changed' : 'not_found', message: error.message } }, error.status);
  throw error;
});
memoriesRoutes.get('/memory-settings', async c => c.json(await settings(c.get('owner').catId)));
memoriesRoutes.patch('/memory-settings', async c => {
  const body = z.object({ learn: z.boolean().optional(), use: z.boolean().optional(), revision: z.number().int().min(0) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(bad('设置格式不正确'), 400);
  return c.json(await changeSettings(c.get('owner').catId, body.data));
});
memoriesRoutes.get('/memories', async c => {
  const catId = c.get('owner').catId;
  const rows = await db.select({ m: memories, source: messages }).from(memories)
    .leftJoin(messages, eq(messages.id, memories.sourceMessageId))
    .leftJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(memories.catId, catId), inArray(memories.status, ['active', 'conflicted'])))
    .orderBy(desc(memories.lastConfirmedAt));
  return c.json({ memories: rows.map(({ m, source }) => ({
    id: m.id, subject: m.subject, predicate: m.predicate, value: m.value, status: m.status,
    explicit: m.explicit, sensitivity: m.sensitivity, source_message_id: m.sourceMessageId,
    source_text: source?.conversationId === c.get('owner').conversationId ? source.text : null, source_allowed: source?.conversationId === c.get('owner').conversationId && source.role === 'user' && source.contextAllowed,
    created_at: m.createdAt, last_confirmed_at: m.lastConfirmedAt, revision: m.revision,
    edited: m.extractorVersion === 'user-edit-v1',
  })) });
});
memoriesRoutes.patch('/memories/:id', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  const body = z.object({ value: z.string().trim().min(1).max(2000), revision: z.number().int().min(0) }).safeParse(await c.req.json().catch(() => null));
  if (!id.success) return c.json(notFound, 404);
  if (!body.success) return c.json(bad('请填写 1 到 2000 字的记忆'), 400);
  await editMemory(c.get('owner').catId, id.data, body.data.value, body.data.revision);
  return c.json({ ok: true });
});
const preview = (impact: Awaited<ReturnType<typeof sourceImpact>>, revision: number, watermark: number) => ({
  revision, watermark, messages: impact.messages.map(m => ({ id: m.id, text: m.text, role: m.role, allowed: m.contextAllowed, legacy: impact.legacyIds.includes(m.id) })),
  memories: impact.memories.filter(m => m.status !== 'superseded').map(m => ({ id: m.id, value: m.value })),
});
memoriesRoutes.get('/memories/:id/impact', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const catId = c.get('owner').catId;
  const result = await db.transaction(async tx => {
    const cat = await lockMemory(tx, catId);
    const [m] = await tx.select().from(memories).where(and(eq(memories.catId, catId), eq(memories.id, id.data)));
    if (!m) throw new MemoryControlError(404, '记忆已不存在');
    return preview(await sourceImpact(tx, catId, await memorySources(tx, catId, m.fingerprint)), cat.memoryRevision, await latestSeq(tx, catId));
  });
  return c.json(result);
});
memoriesRoutes.delete('/memories/:id', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const catId = c.get('owner').catId;
  const withdraw = c.req.query('withdraw_sources') === 'true';
  const expected = z.coerce.number().int().min(0).safeParse(c.req.query('revision'));
  const watermark = z.coerce.number().int().min(0).safeParse(c.req.query('watermark'));
  if (!expected.success || (withdraw && !watermark.success)) return c.json(bad('请先查看影响范围'), 400);
  await db.transaction(async tx => {
    await lockMemory(tx, catId);
    const [m] = await tx.select().from(memories).where(and(eq(memories.catId, catId), eq(memories.id, id.data)));
    if (!m) return; // 幂等重试，不泄漏别人的记录是否存在。
    await lockMemory(tx, catId, expected.data);
    if (withdraw) {
      if (await latestSeq(tx, catId) !== watermark.data) throw new MemoryControlError(409, '聊天刚有变化，请重新核对影响范围');
      await withdrawSources(tx, catId, await memorySources(tx, catId, m.fingerprint));
      await removeAspect(tx, catId, m.fingerprint);
    } else {
      await removeAspect(tx, catId, m.fingerprint);
      await bumpMemory(tx, catId);
    }
  });
  return c.json({ ok: true });
});
memoriesRoutes.get('/messages/:id/usage', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  return c.json(await db.transaction(async tx => {
    const cat = await lockMemory(tx, c.get('owner').catId);
    return preview(await sourceImpact(tx, cat.id, [id.data]), cat.memoryRevision, await latestSeq(tx, cat.id));
  }));
});
memoriesRoutes.post('/messages/:id/withdraw', async c => {
  const id = z.uuid().safeParse(c.req.param('id'));
  const body = z.object({ revision: z.number().int().min(0), watermark: z.number().int().min(0) }).safeParse(await c.req.json().catch(() => null));
  if (!id.success) return c.json(notFound, 404);
  if (!body.success) return c.json(bad('请先查看影响范围'), 400);
  await db.transaction(async tx => {
    const cat = await lockMemory(tx, c.get('owner').catId);
    const impact = await sourceImpact(tx, cat.id, [id.data]);
    if (impact.messages.every(m => !m.contextAllowed)) return;
    await lockMemory(tx, cat.id, body.data.revision);
    if (await latestSeq(tx, cat.id) !== body.data.watermark) throw new MemoryControlError(409, '聊天刚有变化，请重新核对影响范围');
    await withdrawSources(tx, cat.id, [id.data]);
  });
  return c.json({ ok: true });
});
