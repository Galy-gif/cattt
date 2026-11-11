import { ticketRoutes } from './tickets.ts';
import { Hono } from 'hono';
import { sql } from '../db/client.ts';
import { redis } from '../redis.ts';
import { auth, type Env } from './auth.ts';
import { catRoutes } from './cat.ts';
import { chatRoutes } from './chat.ts';
import { memoriesRoutes } from './memories.ts';
import { boundariesRoutes } from './boundaries.ts';
import { soulRoutes } from './soul.ts';
import { worldRoutes } from '../world/routes.ts';
import { diaryRoutes } from './diary.ts';
import { meRoutes } from './me.ts';

export const app = new Hono();
app.get('/healthz', async (c) => {
  const [dbOk, redisOk] = await Promise.all([
    sql`select 1`.then(() => true).catch(() => false),
    redis.ping().then(r => r === 'PONG').catch(() => false),
  ]);
  return c.json({ ok: dbOk && redisOk, db: dbOk, redis: redisOk }, dbOk && redisOk ? 200 : 503);
});
const v1 = new Hono<Env>();
v1.use('*', auth);
v1.route('/', catRoutes);
v1.route('/', meRoutes);
v1.route('/', ticketRoutes);
v1.route('/', diaryRoutes);
v1.route('/', chatRoutes);
v1.route('/', memoriesRoutes);
v1.route('/', boundariesRoutes);
v1.route('/cat', soulRoutes);
v1.route('/world', worldRoutes);
app.route('/v1', v1);
app.onError((error, c) => {
  console.error('[api]', error);
  return c.json({ error: { code: 'internal_error', message: '服务端出错了' } }, 500);
});
