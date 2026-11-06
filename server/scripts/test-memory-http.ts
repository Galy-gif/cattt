/** 真实 HTTP/SSE → 回复执行器 → PG；仅隔离库和 mock。 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { turns } from '../src/db/schema.ts';
import { createDevUser } from '../src/dev-user.ts';
if (!process.env.DATABASE_URL?.includes('maomao_memory_review_') || process.env.MODEL_PROVIDER !== 'mock') throw new Error('只允许隔离库和 mock');
const { token } = await createDevUser('HTTP 合成验收');
async function call(path: string, method = 'GET', body?: object) {
  const response = await fetch(`http://localhost:8788/v1/${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, 200, `${method} ${path}`); return response;
}
const passed: string[] = [];
const sent = await (await call('messages', 'POST', { client_message_id: randomUUID(), text: '记住，我不喝咖啡。' })).text();
assert(sent.includes('event: done'));
let list = await (await call('memories')).json(); assert.equal(list.memories.length, 1);
passed.push('HTTP/SSE 明确记忆在回复前保存');
const memory = list.memories[0];
await call(`memories/${memory.id}`, 'PATCH', { value: '只喝无咖啡因咖啡', revision: memory.revision });
list = await (await call('memories')).json(); assert.equal(list.memories[0].value, '只喝无咖啡因咖啡');
passed.push('HTTP 更正、重新读取一致');
const impact = await (await call(`memories/${memory.id}/impact`)).json();
await call(`memories/${memory.id}?withdraw_sources=true&revision=${impact.revision}&watermark=${impact.watermark}`, 'DELETE');
assert.equal((await (await call('memories')).json()).memories.length, 0);
assert((await (await call('messages')).json()).messages.every((m: {context_allowed: boolean}) => !m.context_allowed));
passed.push('删除与整段停用原子完成，聊天仍保留');
const response = await call('messages', 'POST', { client_message_id: randomUUID(), text: '[slow] 用来验证中途停用的合成消息' });
const reading = response.text();
let current: typeof turns.$inferSelect | undefined;
for (let i = 0; i < 120; i++) {
  const history = await (await call('messages')).json();
  const last = history.messages.at(-1);
  [current] = await db.select().from(turns).where(eq(turns.userMessageId, last.id));
  if (current?.firstTokenAt) break;
  await new Promise(r => setTimeout(r, 50));
}
assert(current?.firstTokenAt);
const usage = await (await call(`messages/${current.userMessageId}/usage`)).json();
await call(`messages/${current.userMessageId}/withdraw`, 'POST', { revision: usage.revision, watermark: usage.watermark });
const output = await reading; assert(output.includes('event: error')); assert(!output.includes('event: done'));
passed.push('正在输出的 SSE 在停用后以错误终止，不发布成功');
let setting = await (await call('memory-settings')).json();
setting = await (await call('memory-settings', 'PATCH', { learn: false, revision: setting.revision })).json();
assert.equal(setting.use, true);
await (await call('messages', 'POST', { client_message_id: randomUUID(), text: '记住，我喜欢周末去图书馆。' })).text();
await call('memory-settings', 'PATCH', { learn: true, revision: setting.revision });
assert.equal((await (await call('memories')).json()).memories.length, 0);
passed.push('开关独立，关闭期间的新消息不保存');
console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
await writeFile('/tmp/maomao-memory-http-results.json', JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
await sql.end();
