import { eq } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { hashToken } from '../auth-token.ts';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { loadOwner, type Owner } from '../turns/create.ts';

export type Env = { Variables: { owner: Owner } };

/** 开发者版：每人一个 token，scripts/create-dev-user.ts 生成。库里只存哈希。 */
export const auth = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return c.json({ error: { code: 'unauthorized', message: '缺少 token' } }, 401);

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.devTokenHash, hashToken(token)));
  if (!user) return c.json({ error: { code: 'unauthorized', message: 'token 不对' } }, 401);

  const owner = await loadOwner(user.id);
  if (!owner) return c.json({ error: { code: 'no_cat', message: '这个账号还没有猫' } }, 409);

  c.set('owner', owner);
  await next();
});
