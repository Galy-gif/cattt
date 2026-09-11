import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db, sql } from '../db/client.ts';
import { boundaries, cats, memories, memoryBlocks, messages, turns } from '../db/schema.ts';
import { enqueueBoundarySummarize } from '../queue.ts';
import { redis } from '../redis.ts';
import { APPEARANCES, TEMPERAMENTS } from '../runtime/persona.ts';
import { recordVisibleLength, requestCancel } from '../turns/events.ts';
import { createReplyTurn, createSendTurn } from '../turns/create.ts';
import { auth, type Env } from './auth.ts';
import { streamTurn } from './sse.ts';

export const app = new Hono();

app.get('/healthz', async (c) => {
  const [dbOk, redisOk] = await Promise.all([
    sql`select 1`.then(() => true).catch(() => false),
    redis.ping().then((r) => r === 'PONG').catch(() => false),
  ]);
  return c.json({ ok: dbOk && redisOk, db: dbOk, redis: redisOk }, dbOk && redisOk ? 200 : 503);
});

const v1 = new Hono<Env>();
v1.use('*', auth);

const bad = (message: string) => ({ error: { code: 'bad_request', message } });
const notFound = { error: { code: 'not_found', message: '没有这个' } };

// ---- 猫 ----

const catBody = z.object({
  name: z.string().trim().min(1).max(20),
  appearance: z.enum(Object.keys(APPEARANCES) as [string, ...string[]]),
  temperament: z.enum(Object.keys(TEMPERAMENTS) as [string, ...string[]]),
  traits: z.object({
    energy: z.number().int().min(0).max(2),
    initiative: z.number().int().min(0).max(2),
    directness: z.number().int().min(0).max(2),
    closeness: z.number().int().min(0).max(2),
  }),
});

const catJson = (cat: typeof cats.$inferSelect) => ({
  id: cat.id,
  name: cat.name,
  appearance: cat.appearance,
  temperament: cat.temperament,
  traits: cat.traits,
  persona_version: cat.personaVersion,
});

v1.get('/cat', async (c) => {
  const [cat] = await db.select().from(cats).where(eq(cats.id, c.get('owner').catId));
  return c.json(catJson(cat!));
});

v1.put('/cat', async (c) => {
  const body = catBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(bad(z.prettifyError(body.error)), 400);
  const [current] = await db.select().from(cats).where(eq(cats.id, c.get('owner').catId));
  // 改了性格相关的字段才升版本；只改名字不算
  const personaChanged =
    current!.temperament !== body.data.temperament || JSON.stringify(current!.traits) !== JSON.stringify(body.data.traits);
  const [cat] = await db
    .update(cats)
    .set({
      ...body.data,
      personaVersion: personaChanged ? current!.personaVersion + 1 : current!.personaVersion,
      updatedAt: new Date(),
    })
    .where(eq(cats.id, current!.id))
    .returning();
  return c.json(catJson(cat!));
});

// ---- 聊天 ----

const sendBody = z.object({
  client_message_id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(4000),
});

/** 发一条消息，响应就是这一轮回复的 SSE 流 */
v1.post('/messages', async (c) => {
  const body = sendBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(bad(z.prettifyError(body.error)), 400);
  const { turnId } = await createSendTurn(c.get('owner'), body.data.client_message_id, body.data.text);
  return streamTurn(c, turnId, '0');
});

/** 对已有的用户消息重新回复（超时后「再试一次」） */
v1.post('/messages/:id/reply', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const created = await createReplyTurn(c.get('owner'), id.data);
  if (!created) return c.json(notFound, 404);
  return streamTurn(c, created.turnId, '0');
});

/** 历史消息，按时间正序。before 传上一页最早那条的 seq。
 *  猫的消息带两个标记，气泡下的注文要用：remembered（这一轮记下了用户明确要记的）、boundary（被标了不要再提） */
v1.get('/messages', async (c) => {
  const before = Number(c.req.query('before') ?? '0');
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? '50')));
  const conditions = [eq(messages.conversationId, c.get('owner').conversationId)];
  if (before > 0) conditions.push(lt(messages.seq, before));
  const rows = await db
    .select({ m: messages, remembered: turns.remembered, boundaryId: boundaries.id })
    .from(messages)
    .leftJoin(turns, eq(turns.id, messages.turnId))
    .leftJoin(boundaries, eq(boundaries.sourceMessageId, messages.id))
    .where(and(...conditions))
    .orderBy(desc(messages.seq))
    .limit(limit);
  return c.json({
    messages: rows.reverse().map(({ m, remembered, boundaryId }) => ({
      id: m.id,
      seq: m.seq,
      role: m.role,
      text: m.text,
      status: m.status,
      client_message_id: m.clientMessageId,
      turn_id: m.turnId,
      remembered: remembered ?? false,
      boundary: boundaryId !== null,
      created_at: m.createdAt,
    })),
  });
});

async function ownTurn(turnId: string, conversationId: string) {
  if (!z.uuid().safeParse(turnId).success) return null;
  const [turn] = await db
    .select()
    .from(turns)
    .where(and(eq(turns.id, turnId), eq(turns.conversationId, conversationId)));
  return turn ?? null;
}

/** 断线续传：带 Last-Event-ID 从断点接着读 */
v1.get('/turns/:id/stream', async (c) => {
  const turn = await ownTurn(c.req.param('id'), c.get('owner').conversationId);
  if (!turn) return c.json(notFound, 404);
  const after = c.req.header('last-event-id') ?? c.req.query('last_event_id') ?? '0';
  // 只接受 Redis Stream 的 id 格式；db-* 是从库里补发的，续传就从头读
  return streamTurn(c, turn.id, /^\d+-\d+$/.test(after) ? after : '0');
});

const cancelBody = z.object({ visible_length: z.number().int().min(0).optional() });

/** 停止。可以带上屏幕上已经显示的长度（UTF-16），服务端只存这么多 */
v1.post('/turns/:id/cancel', async (c) => {
  const turn = await ownTurn(c.req.param('id'), c.get('owner').conversationId);
  if (!turn) return c.json(notFound, 404);
  const body = cancelBody.safeParse(await c.req.json().catch(() => ({})));
  if (turn.status === 'queued' || turn.status === 'generating') {
    if (body.success && body.data.visible_length !== undefined) {
      await recordVisibleLength(turn.id, body.data.visible_length);
    }
    await requestCancel(turn.id, 'stop');
  }
  return c.json({ ok: true });
});

/** 这一轮的状态。iOS 在 done 之后轮询 remembered，用来显示「记下了」 */
v1.get('/turns/:id', async (c) => {
  const turn = await ownTurn(c.req.param('id'), c.get('owner').conversationId);
  if (!turn) return c.json(notFound, 404);
  return c.json({
    id: turn.id,
    status: turn.status,
    user_message_id: turn.userMessageId,
    cat_message_id: turn.catMessageId,
    /** 这一轮回复用到了哪些记忆 */
    memory_ids: turn.memoryIds,
    extracted: turn.extractedAt !== null,
    remembered: turn.remembered,
  });
});

v1.get('/boundaries', async (c) => {
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
v1.post('/messages/:id/boundary', async (c) => {
  const owner = c.get('owner');
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const [msg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.id, id.data), eq(messages.conversationId, owner.conversationId)));
  if (!msg) return c.json(notFound, 404);
  const [row] = await db
    .insert(boundaries)
    .values({ catId: owner.catId, sourceMessageId: msg.id })
    .onConflictDoNothing()
    .returning({ id: boundaries.id });
  if (row) await enqueueBoundarySummarize(row.id);
  return c.json({ ok: true });
});

// ---- 记忆 ----

v1.get('/memories', async (c) => {
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
v1.delete('/memories/:id', async (c) => {
  const catId = c.get('owner').catId;
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json(notFound, 404);
  const deleted = await db.transaction(async (tx) => {
    const [m] = await tx
      .select({ fingerprint: memories.fingerprint })
      .from(memories)
      .where(and(eq(memories.id, id.data), eq(memories.catId, catId)));
    if (!m) return false;
    await tx.delete(memories).where(and(eq(memories.catId, catId), eq(memories.fingerprint, m.fingerprint)));
    await tx.insert(memoryBlocks).values({ catId, fingerprint: m.fingerprint }).onConflictDoNothing();
    return true;
  });
  if (!deleted) return c.json(notFound, 404);
  return c.json({ ok: true });
});

app.route('/v1', v1);

app.onError((err, c) => {
  console.error('[api]', err);
  return c.json({ error: { code: 'internal_error', message: '服务端出错了' } }, 500);
});
