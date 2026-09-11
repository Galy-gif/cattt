import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { hashToken } from './auth-token.ts';
import { db } from './db/client.ts';
import { cats, conversations, users } from './db/schema.ts';
import { DEFAULT_TRAITS } from './runtime/persona.ts';

/** 建一个开发者账号，连同一只默认的猫（团子）和它的对话。token 只在这里出现一次，库里只存哈希 */
export async function createDevUser(name: string) {
  const token = `mm_dev_${randomBytes(24).toString('hex')}`;
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ name, devTokenHash: hashToken(token) }).returning({ id: users.id });
    const [cat] = await tx
      .insert(cats)
      .values({ userId: user!.id, name: '团子', appearance: 'orange', temperament: 'slow', traits: DEFAULT_TRAITS })
      .returning({ id: cats.id });
    await tx.insert(conversations).values({ catId: cat!.id });
    return user!.id;
  });
  return { userId, token };
}

/** 连同猫、对话、消息、记忆一起删（外键级联） */
export async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}
