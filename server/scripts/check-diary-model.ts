/** 一条无个人数据的真实模型连通检查；不通过worker，避免mock代跑。 */
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { cats, diaryEntries } from '../src/db/schema.ts';
import { config } from '../src/config.ts';
import { createDevUser } from '../src/dev-user.ts';
import { readDiary } from '../src/worker/diary.ts';
if (!process.env.DATABASE_URL?.includes('maomao_diary_sync_review_') || config.MODEL_PROVIDER !== 'deepseek') throw new Error('仅限隔离库与真实模型');
const owner = await createDevUser('diary-real-model-check');
const [cat] = await db.select().from(cats).where(eq(cats.userId, owner.userId));
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const [entry] = await db.insert(diaryEntries).values({ catId: cat!.id, clientId: randomUUID(), kind: 'text', text: '合成连通检查：今天读了几页书。', recordedAt: new Date(), timeZone: 'Asia/Shanghai', day, time: '12:00', catAllowed: true, mutationId: randomUUID() }).returning();
let result: { connected: boolean; [key: string]: unknown };
try {
  await readDiary(entry!.id, '1', 'diary-real-check-' + randomUUID());
  const [saved] = await db.select().from(diaryEntries).where(eq(diaryEntries.id, entry!.id));
  if (!saved || ![1, 2].includes(saved.visit)) throw new Error('diary_result_not_saved');
  result = { provider: 'deepseek', model: config.CHAT_MODEL, connected: true, visit: saved!.visit, note: saved!.note, scope: '仅一条合成内容验证连接与结构化输出，不代表整体自然度验收' };
} catch (error) {
  result = { provider: 'deepseek', model: config.CHAT_MODEL, connected: false, code: error instanceof Error ? error.message : 'unknown', scope: '未回退mock，未标记已读或生成假留言' };
}
await writeFile(process.env.DIARY_MODEL_CHECK_OUTPUT ?? new URL('../../outputs/diary-sync-review/真实模型检查.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result)); await sql.end();
process.exitCode = result.connected ? 0 : 1;
