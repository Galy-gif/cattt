import { randomUUID } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { desc, eq } from 'drizzle-orm';
const hook = vi.hoisted(() => ({ afterBuild: undefined as undefined | (() => Promise<void>) }));
vi.mock('../src/runtime/context.ts', async importOriginal => {
  const original = await importOriginal<typeof import('../src/runtime/context.ts')>();
  return { ...original, buildTurnContext: async (...args: Parameters<typeof original.buildTurnContext>) => {
    const context = await original.buildTurnContext(...args);
    await hook.afterBuild?.();
    return context;
  } };
});
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, messages, turns, users } from '../src/db/schema.ts';
import { createSendTurn, loadOwner } from '../src/turns/create.ts';
import { drainTurns } from '../src/turns/run.ts';
import { applyCandidate } from '../src/worker/memory.ts';
import { lockMemory, withdrawSources } from '../src/memory/control.ts';
import { closeQueues } from '../src/queue.ts';
import { redis } from '../src/redis.ts';
import { config } from '../src/config.ts';
config.MODEL_PROVIDER = 'mock'; config.MOCK_DELAY_MS = 1;
const ids: string[] = [];
async function fixture() {
  const [user] = await db.insert(users).values({name:'上下文并发回归'}).returning(); ids.push(user!.id);
  const [cat] = await db.insert(cats).values({userId:user!.id,name:'团子',appearance:'orange',temperament:'slow',traits:{energy:1,initiative:1,directness:1,closeness:1}}).returning();
  const [conversation] = await db.insert(conversations).values({catId:cat!.id}).returning();
  const [older] = await db.insert(messages).values({conversationId:conversation!.id,role:'user',text:'我喜欢清淡的饭菜。'}).returning();
  return {owner:(await loadOwner(user!.id))!,older:older!};
}
afterAll(async()=>{hook.afterBuild=undefined;await drainTurns(5000);for(const id of ids)await db.delete(users).where(eq(users.id,id));await closeQueues();await redis.quit();await sql.end();});
it('后台旧记忆在上下文读完后提交，当前回复在首字前刷新上下文并完成',async()=>{
  const {owner,older}=await fixture(); let writes=0;
  hook.afterBuild=async()=>{
    hook.afterBuild=undefined;
    await applyCandidate(owner.catId,older.id,{subject:'用户',predicate:'口味',value:'喜欢清淡饭菜',kind:'preference',confidence:1,sensitivity:'low',explicit:false,correction:false});writes++;
  };
  const sent=await createSendTurn(owner,randomUUID(),'我们就安静待一会儿，回一句短的就好。');
  await drainTurns(10000);
  const [turn]=await db.select().from(turns).where(eq(turns.id,sent.turnId));
  expect(writes).toBe(1);
  expect(turn!.status).toBe('completed');
  expect(turn!.error).toBeNull();
  expect(await db.select().from(messages).where(eq(messages.turnId,sent.turnId))).toHaveLength(1);
});
it('首字前当前原话被撤回，即使上下文需要刷新也不能继续回复',async()=>{
  const {owner}=await fixture();
  hook.afterBuild=async()=>{
    hook.afterBuild=undefined;
    const [current]=await db.select().from(messages).where(eq(messages.conversationId,owner.conversationId)).orderBy(desc(messages.seq)).limit(1);
    await db.transaction(async tx=>{await lockMemory(tx,owner.catId);await withdrawSources(tx,owner.catId,[current!.id]);});
  };
  const sent=await createSendTurn(owner,randomUUID(),'这条话请不要再作为输入。');
  await drainTurns(10000);
  const [turn]=await db.select().from(turns).where(eq(turns.id,sent.turnId));
  expect(turn!.status).toBe('failed');
  expect(turn!.catMessageId).toBeNull();
});
