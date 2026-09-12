import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { Env } from '../api/auth.ts';
import { getSoul } from '../soul/service.ts';
import { snapshotSchema, WorldError } from './protocol.ts';
import { acknowledge, pollCommands, putState, registerSession } from './service.ts';

/** Mounted under the authenticated /v1 router. Cat/account never come from request JSON. */
export const worldRoutes = new Hono<Env>();
const identity = z.object({ sessionId: z.uuid(), generation: z.uuid() });
worldRoutes.onError((error, c) => {
  if (error instanceof WorldError) return c.json({ error: { code: error.code, message: '小院状态已变化' } }, 409);
  throw error;
});
worldRoutes.post('/sessions', async (c) => {
  const input = z.object({ protocolVersion: z.literal(1) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: { code: 'unsupported_protocol' } }, 400);
  return c.json(await registerSession(c.get('owner').catId));
});
worldRoutes.put('/state', async (c) => {
  const body = identity.extend({ snapshot: snapshotSchema }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: { code: 'bad_request' } }, 400);
  return c.json(await putState(c.get('owner').catId, body.data.sessionId, body.data.generation, body.data.snapshot));
});
worldRoutes.post('/actions/:id/ack', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  const body = identity.extend({ status: z.enum(['accepted', 'running', 'arrived', 'rejected', 'interrupted']), snapshot: snapshotSchema, reason: z.string().max(80).optional(), occurredAt: z.iso.datetime({ offset: true }).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: { code: 'bad_request' } }, 400);
  const b = body.data;
  return c.json(await acknowledge(c.get('owner').catId, id.data, b.sessionId, b.generation, b.status, b.snapshot, b.reason, b.occurredAt ? new Date(b.occurredAt) : undefined));
});
worldRoutes.get('/events', async (c) => {
  const input = identity.safeParse(c.req.query());
  if (!input.success) return c.json({ error: { code: 'bad_request' } }, 400);
  const catId = c.get('owner').catId;
  // Validate before opening SSE so expired/replaced sessions produce an ordinary 409.
  await pollCommands(catId, input.data.sessionId, input.data.generation);
  return streamSSE(c, async (stream) => {
    try {
      let statePolledAt = -Infinity;
      while (!stream.aborted) {
        const actions = await pollCommands(catId, input.data.sessionId, input.data.generation);
        for (const action of actions) await stream.writeSSE({ event: 'action', id: action.id, data: JSON.stringify(action) });
        if (performance.now() - statePolledAt >= 2_000) {
          const { runtime } = await getSoul(catId);
          await stream.writeSSE({ event: 'runtime_state', data: JSON.stringify({ version: runtime.version, state: runtime.state }) });
          statePolledAt = performance.now();
        }
        await stream.writeSSE({ event: 'heartbeat', data: '{}' });
        await stream.sleep(500);
      }
    } catch (error) {
      if (!stream.aborted) await stream.writeSSE({ event: 'world_error', data: JSON.stringify({ code: error instanceof WorldError ? error.code : 'world_unavailable' }) });
    }
  });
});
