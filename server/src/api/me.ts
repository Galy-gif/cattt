import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { timeZoneSchema } from '../runtime/time.ts';
import type { Env } from './auth.ts';
import { bad } from './responses.ts';

export const meRoutes = new Hono<Env>();
meRoutes.put('/me/time-zone', async c => {
  const body = z.object({ time_zone: timeZoneSchema }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json(bad(z.prettifyError(body.error)), 400);
  await db.update(users).set({ timeZone: body.data.time_zone }).where(eq(users.id, c.get('owner').userId));
  return c.json({ time_zone: body.data.time_zone });
});
