/** 第二批独立账号；只有合成数据，凭证只保存在本机/tmp。 */
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, memories, messages } from '../src/db/schema.ts';
import { createDevUser } from '../src/dev-user.ts';
import { memoryFingerprint } from '../src/runtime/fingerprint.ts';
if (!process.env.DATABASE_URL?.includes('maomao_memory_review_')) throw new Error('只允许独立验收库');
export async function seedRecallReview() {
  const account = await createDevUser('第二批记忆合成验收');
  const [cat] = await db.select().from(cats).where(eq(cats.userId, account.userId));
  const [conv] = await db.select().from(conversations).where(eq(conversations.catId, cat!.id));
  const samples = [['忌口', '不吃香菜'], ['口味', '偏爱清淡少油'], ['阅读偏好', '喜欢硬科幻小说'], ['饮品选择', '只喝无咖啡因咖啡']];
  const saved: Record<string, { id: string; sourceId: string }> = {};
  for (const [predicate, value] of samples) {
    const [m] = await db.insert(messages).values({ conversationId: conv!.id, role: 'user', text: `我${value}`, createdAt: new Date('2026-01-01') }).returning();
    const [memory] = await db.insert(memories).values({ catId: cat!.id, subject: '用户', predicate: predicate!, value: value!, confidence: .95,
      sensitivity: 'low', explicit: false, fingerprint: memoryFingerprint('用户', predicate!), sourceMessageId: m!.id,
      extractorVersion: 'review-fixture', lastConfirmedAt: new Date('2026-01-01') }).returning();
    saved[predicate!] = { id: memory!.id, sourceId: m!.id };
  }
  const noise = await db.insert(messages).values(Array.from({ length: 90 }, (_, i) => ({ conversationId: conv!.id, role: 'user' as const, text: `合成收藏编号${i}：蓝色石头` }))).returning();
  await db.insert(memories).values(noise.map((m, i) => ({ catId: cat!.id, subject: '用户', predicate: `合成收藏${i}`, value: m.text, explicit: i % 2 === 0,
    confidence: .95, sensitivity: 'low' as const, sourceMessageId: m.id, fingerprint: `noise-${i}`, extractorVersion: 'review-fixture' })));
  // 合成旧历史已有结束回复，worker只整理之后的新输入，不重放准备的数据。
  await db.insert(messages).values({ conversationId: conv!.id, role: 'cat', text: '以上为合成历史记录。' });
  return { ...account, catId: cat!.id, conversationId: conv!.id, saved };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const account = await seedRecallReview();
  await writeFile('/tmp/maomao-memory-recall-account.json', JSON.stringify(account), { mode: 0o600 });
  console.log('已准备第二批合成账号：4条旧偏好与90条近期无关记忆；凭证仅存本机临时文件');
  await sql.end();
}
