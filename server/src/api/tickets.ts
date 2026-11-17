import { dispatchTicketCommand } from '../agent/engine.ts';
import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { Env } from './auth.ts';
import { db } from '../db/client.ts';
import { mailboxLetters } from '../db/schema.ts';
import { listTickets, TicketError, ticketView } from '../agent/tickets.ts';
export const ticketRoutes = new Hono<Env>();
ticketRoutes.onError((e, c) => {
  if (e instanceof TicketError)
    return c.json({ error: { code: e.status === 404 ? 'not_found' : e.status === 409 ? 'conflict' : 'bad_request', message: e.message } }, e.status);
  throw e;
});
ticketRoutes.get('/tickets', async (c) => {
  const status = z.enum(['open', 'ended', 'all']).safeParse(c.req.query('status') ?? 'open');
  if (!status.success) return c.json({ error: { code: 'bad_request' } }, 400);
  return c.json({ tickets: (await listTickets(c.get('owner').catId, status.data)).map(ticketView) });
});
ticketRoutes.patch('/tickets/:id', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: { code: 'not_found' } }, 404);
  const body = z.union([z.object({when:z.string()}).strict(), z.object({text:z.string().trim().min(1).max(2000)}).strict()]).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: { code: 'bad_request' } }, 400);
  return c.json(await dispatchTicketCommand({ catId: c.get('owner').catId,
    origin: { source: 'app', requestId: c.req.header('Idempotency-Key') } },
    'text' in body.data ? { kind: 'append', ticketId: id.data, text: body.data.text }
      : { kind: 'reschedule', ticketId: id.data, when: body.data.when }));
});
ticketRoutes.post('/tickets/:id/cancel', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: { code: 'not_found' } }, 404);
  return c.json(await dispatchTicketCommand({ catId: c.get('owner').catId,
    origin: { source: 'app', requestId: c.req.header('Idempotency-Key') } }, { kind: 'cancel', ticketId: id.data }));
});
ticketRoutes.get('/mailbox', async (c) => {
  const after = z.coerce
    .number()
    .int()
    .min(0)
    .safeParse(c.req.query('after') ?? 0);
  if (!after.success) return c.json({ error: { code: 'bad_request' } }, 400);
  const rows = await db
    .select()
    .from(mailboxLetters)
    .where(and(eq(mailboxLetters.catId, c.get('owner').catId), gt(mailboxLetters.seq, after.data)))
    .orderBy(asc(mailboxLetters.seq))
    .limit(100);
  return c.json({
    letters: rows.map((l) => ({
      id: l.id,
      seq: l.seq,
      ticket_id: l.ticketId,
      text: l.text,
      created_at: l.createdAt,
      read_at: l.readAt,
    })),
    has_more: rows.length === 100,
  });
});
ticketRoutes.post('/mailbox/:id/read', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: { code: 'not_found' } }, 404);
  const [letter] = await db
    .update(mailboxLetters)
    .set({ readAt: sql`coalesce(${mailboxLetters.readAt},now())` })
    .where(and(eq(mailboxLetters.id, id.data), eq(mailboxLetters.catId, c.get('owner').catId)))
    .returning();
  return letter ? c.json({ ok: true }) : c.json({ error: { code: 'not_found' } }, 404);
});
