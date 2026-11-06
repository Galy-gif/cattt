import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, memories, messages, users } from '../src/db/schema.ts';
import { extractSource } from '../src/worker/memory.ts';
import { changeSettings, lockMemory, withdrawSources } from '../src/memory/control.ts';
import * as models from '../src/runtime/model.ts';
import { closeQueues } from '../src/queue.ts';
import { redis } from '../src/redis.ts';
const ids: string[] = [];
async function fixture() {
  const [u] = await db.insert(users).values({ name: 'extract-test' }).returning(); ids.push(u!.id);
  const [cat] = await db.insert(cats).values({ userId: u!.id, name: '团子', appearance: 'orange', temperament: 'slow', traits: { energy: 1, initiative: 1, directness: 1, closeness: 1 } }).returning();
  const [conv] = await db.insert(conversations).values({ catId: cat!.id }).returning();
  const add = async (text: string) => (await db.insert(messages).values({ conversationId: conv!.id, role: 'user', text }).returning())[0]!.id;
  return { catId: cat!.id, add };
}
function extractor(output: object, inspect?: (prompt: string) => void) {
  const model = new MockLanguageModelV4({ doGenerate: async options => {
    inspect?.(JSON.stringify(options.prompt));
    return { content: [{ type: 'text', text: JSON.stringify(output) }], finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } }, warnings: [] };
  } });
  vi.spyOn(models, 'extractSlot').mockReturnValue({ model, modelId: 'controlled-test', providerOptions: { deepseek: { thinking: { type: 'disabled' } } } });
}
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { for (const id of ids) await db.delete(users).where(eq(users.id, id)); await closeQueues(); await redis.quit(); await sql.end(); });
const base = { subject: '用户', predicate: '咖啡偏好', value: '不喝咖啡', kind: 'preference', confidence: .95, sensitivity: 'low', explicit: true, correction: false };
it('模型提取保存真实来源，更正沿用同方面并让旧值失效', async () => {
  const f = await fixture(); const a = await f.add('记住，我不喝咖啡');
  extractor({ memories: [base] });
  expect((await extractSource(f.catId, a, randomUUID())).remembered).toBe(true);
  vi.restoreAllMocks();
  const b = await f.add('更正，只喝无咖啡因咖啡');
  extractor({ memories: [{ ...base, value: '只喝无咖啡因咖啡', correction: true }] }, prompt => { expect(prompt).toContain('咖啡偏好'); });
  expect((await extractSource(f.catId, b, randomUUID())).note).toContain('成功保存');
  const stored = await db.select().from(memories).where(eq(memories.catId, f.catId));
  expect(stored.find(m => m.status === 'active')!.sourceMessageId).toBe(b);
  expect(stored.find(m => m.sourceMessageId === a)!.status).toBe('superseded');
});
it('含糊更正返回澄清，不虚构保存结果', async () => {
  const f = await fixture(); const a = await f.add('那个不是这样的');
  extractor({ memories: [], clarification: '你想改的是哪件事？' });
  const result = await extractSource(f.catId, a, randomUUID());
  expect(result).toEqual({ remembered: false, note: '你想改的是哪件事？' });
  expect(await db.select().from(memories).where(eq(memories.catId, f.catId))).toHaveLength(0);
});
it('关闭整理或停用原话后，连提取模型也不调用', async () => {
  const f = await fixture(); const a = await f.add('记住，我喜欢茶');
  extractor({ memories: [base] }); const spy = vi.mocked(models.extractSlot);
  await changeSettings(f.catId, { learn: false, revision: 0 });
  expect((await extractSource(f.catId, a, randomUUID())).remembered).toBe(false);
  const g = await fixture(); const b = await g.add('不再使用的原话');
  await db.transaction(async tx => { await lockMemory(tx, g.catId); await withdrawSources(tx, g.catId, [b]); });
  expect((await extractSource(g.catId, b, randomUUID())).remembered).toBe(false);
  expect(spy).not.toHaveBeenCalled();
});
it('提取期间撤回原话，迟到的模型结果不能写入', async () => {
  const f = await fixture(); const a = await f.add('记住，我不喝咖啡');
  const model = new MockLanguageModelV4({ doGenerate: async () => {
    await db.transaction(async tx => { await lockMemory(tx, f.catId); await withdrawSources(tx, f.catId, [a]); });
    return { content: [{ type: 'text', text: JSON.stringify({ memories: [base] }) }], finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] };
  } });
  vi.spyOn(models, 'extractSlot').mockReturnValue({ model, modelId: 'controlled-test', providerOptions: { deepseek: { thinking: { type: 'disabled' } } } });
  expect((await extractSource(f.catId, a, randomUUID())).remembered).toBe(false);
  expect(await db.select().from(memories).where(eq(memories.catId, f.catId))).toHaveLength(0);
});
