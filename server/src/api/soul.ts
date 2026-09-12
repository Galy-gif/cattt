import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './auth.ts';
import { adjustSoul, getSoul, revokeSoul, setRuntimeState, SoulInputError } from '../soul/service.ts';

export const soulRoutes = new Hono<Env>();
soulRoutes.onError((error, c) => {
  if (error instanceof SoulInputError) return c.json({ error: { code: 'bad_request', message: error.message } }, 400);
  throw error;
});
soulRoutes.get('/soul', async (c) => c.json(await getSoul(c.get('owner').catId)));
soulRoutes.post('/soul', async (c) => c.json(await adjustSoul(c.get('owner').catId, await c.req.json().catch(() => null))));
soulRoutes.delete('/soul/:id', async (c) => {
  const id = z.uuid().safeParse(c.req.param('id'));
  if (!id.success) return c.json({ error: { code: 'bad_request' } }, 400);
  return c.json(await revokeSoul(c.get('owner').catId, id.data));
});
soulRoutes.put('/state', async (c) => c.json(await setRuntimeState(c.get('owner').catId, await c.req.json().catch(() => null))));
