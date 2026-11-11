import { setProactivePermission,proactivePermissionJSON } from '../agent/proactive-permission.ts';
import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { cats,users } from '../db/schema.ts';
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

meRoutes.get('/me/proactive',async c=>{const[cat]=await db.select().from(cats).where(eq(cats.id,c.get('owner').catId));return c.json(proactivePermissionJSON(cat!));});
meRoutes.patch('/me/proactive',async c=>{const body=z.object({allow_proactive:z.boolean()}).strict().safeParse(await c.req.json().catch(()=>null));if(!body.success)return c.json(bad('设置格式不正确'),400);return c.json(await setProactivePermission(c.get('owner').catId,body.data.allow_proactive));});
