/** 正式 HTTP/SSE 与 PG；mock回复只显示实际到达的记忆，不能作为自然对话质量证据。 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { and, eq, inArray } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { memories, modelCalls, turns } from '../src/db/schema.ts';
import { seedRecallReview } from './memory-recall-seed.ts';
if (!process.env.DATABASE_URL?.includes('maomao_memory_review_') || process.env.MODEL_PROVIDER !== 'mock') throw new Error('只允许隔离库与mock');
const account = await seedRecallReview();
const checks: object[] = [];
const turnIds: string[] = [];
async function call(path: string, method = 'GET', body?: object, headers: Record<string, string> = {}) {
  const response = await fetch(`http://localhost:8789/v1/${path}`, { method, headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, 200, `${method} ${path}`); return response;
}
async function ask(text: string, expected: string[]) {
  const start = Date.now();
  let output = await (await call('messages', 'POST', { client_message_id: randomUUID(), text: `[recall] ${text}` })).text();
  let resumes = 0;
  const accepted = output.match(/event: accepted\ndata: ([^\n]+)/)?.[1];
  const acceptedId: string | undefined = accepted ? JSON.parse(accepted).turn_id : undefined;
  while (!output.includes('event: done') && !output.includes('event: error') && acceptedId && resumes < 3) {
    const lastId = [...output.matchAll(/^id: (\d+-\d+)$/gm)].at(-1)?.[1] ?? '0';
    output += await (await call(`turns/${acceptedId}/stream`, 'GET', undefined, { 'last-event-id': lastId, 'x-maomao-snapshot': '1' })).text();
    resumes++;
  }
  assert(output.includes('event: done'), output);
  const all = await db.select().from(turns).where(eq(turns.conversationId, account.conversationId));
  const current = all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]!;
  assert.deepEqual([...current.memoryIds].sort(), [...expected].sort(), text);
  turnIds.push(current.id);
  checks.push({ turnId: current.id, query: text, memoryIds: current.memoryIds, expected, elapsedMs: Date.now() - start, sourceCount: current.contextSourceIds?.length, resumes });
  return current;
}
const diet = account.saved['忌口']!; const taste = account.saved['口味']!; const book = account.saved['阅读偏好']!;
await ask('帮我想想晚饭吃什么', [diet.id, taste.id]);
await ask('找本烧脑的读物', [book.id]);
await ask('明天天气怎么样', []);
const row = (await db.select().from(memories).where(eq(memories.id, diet.id)))[0]!;
await call(`memories/${diet.id}`, 'PATCH', { value: '现在可以吃香菜，但不吃辣椒', revision: row.revision });
await ask('晚饭吃什么', [diet.id, taste.id]);
const preview = await (await call(`memories/${diet.id}/impact`)).json();
await call(`memories/${diet.id}?revision=${preview.revision}&watermark=${preview.watermark}`, 'DELETE');
await ask('晚饭吃什么', [taste.id]);
const usage = await (await call(`messages/${taste.sourceId}/usage`)).json();
await call(`messages/${taste.sourceId}/withdraw`, 'POST', { revision: usage.revision, watermark: usage.watermark });
await ask('晚饭吃什么', []);
const setting = await (await call('memory-settings')).json();
await call('memory-settings', 'PATCH', { use: false, revision: setting.revision });
await ask('找本烧脑的读物', []);
const cost = await db.select().from(modelCalls).where(and(eq(modelCalls.purpose, 'memory_recall'), inArray(modelCalls.turnId, turnIds)));
const directory = new URL('../../outputs/memory-recall-review/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('HTTP联调.json', directory), JSON.stringify({ evidence: '正式HTTP/SSE、真实PG、受控模型；非真实模型质量验收', passed: checks.length, checks,
  recallCalls: cost.map(c => ({ model: c.model, latencyMs: c.latencyMs, inputTokens: c.inputTokens, outputTokens: c.outputTokens })) }, null, 2));
console.log(JSON.stringify({ passed: checks.length, recallCalls: cost.length }));
await sql.end();
