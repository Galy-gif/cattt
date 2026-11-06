import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { db, sql } from '../src/db/client.ts';
import { asyncJobs, cats, conversations, memories, messages, turns, users } from '../src/db/schema.ts';
import { commitOutcome, authorizeFirstToken, claimTurn } from '../src/turns/store.ts';
import { executeJob } from '../src/jobs/store.ts';
import { applyCandidate, deleteMemory } from '../src/worker/memory.ts';
const userIds: string[] = [];
let catId: string; let convId: string; let sourceId: string; let turnId: string;
const base = { subject: '用户', predicate: '饮料', value: '茶', confidence: .9, sensitivity: 'low' as const, explicit: true, correction: false, kind: 'preference' as const };
beforeEach(async () => {
  const [u] = await db.insert(users).values({name:'reliability-test'}).returning(); userIds.push(u!.id);
  const [c] = await db.insert(cats).values({userId:u!.id,name:'团子',appearance:'orange',temperament:'slow',traits:{energy:1,initiative:1,directness:1,closeness:1}}).returning(); catId=c!.id;
  const [v] = await db.insert(conversations).values({catId}).returning(); convId=v!.id;
  const [m] = await db.insert(messages).values({conversationId:convId,role:'user',text:'记住我喜欢茶'}).returning();sourceId=m!.id;
  const [t] = await db.insert(turns).values({conversationId:convId,userMessageId:sourceId,inputVersion:0}).returning();turnId=t!.id;
});
afterAll(async()=>{ for(const id of userIds) await db.delete(users).where(eq(users.id,id)); await sql.end(); });
it('完成、停止和清理竞争只保存一个终态与最多一条猫消息',async()=>{
 const results=await Promise.all([commitOutcome(turnId,{status:'completed',text:'喵'}),commitOutcome(turnId,{status:'stopped',text:'嗯'}),commitOutcome(turnId,{status:'failed',error:'stale'})]);
 expect(results.filter(r=>r.applied)).toHaveLength(1);
 const [t]=await db.select().from(turns).where(eq(turns.id,turnId));
 expect(await db.select().from(messages).where(eq(messages.turnId,turnId))).toHaveLength(t!.status==='failed'?0:1);
 expect((await commitOutcome(turnId,{status:'failed',error:'publication failure'})).applied).toBe(false);
});
it('首字共同锁拒绝旧版本，但已经开口的轮次继续',async()=>{
 await claimTurn(turnId); expect(await authorizeFirstToken(turnId)).toBe('allowed');
 await db.update(conversations).set({version:1}).where(eq(conversations.id,convId));
 expect(await authorizeFirstToken(turnId)).toBe('allowed');
 const [old]=await db.insert(turns).values({conversationId:convId,userMessageId:sourceId,inputVersion:0,status:'generating'}).returning();
 expect(await authorizeFirstToken(old!.id)).toBe('superseded');
});
it('持久待办不依赖入队成功，重复执行共享结果并投影后来重答',async()=>{
 await commitOutcome(turnId,{status:'completed',text:'喵'});
 const [job]=await db.select().from(asyncJobs).where(eq(asyncJobs.sourceId,sourceId));expect(job!.state).toBe('pending');
 // 本用例只测重复认领，不依赖虚拟机时钟恰好到达投递时间。
 await db.update(asyncJobs).set({nextAttemptAt:new Date(0)}).where(eq(asyncJobs.id,job!.id));
 let calls=0;await Promise.all([executeJob(job!.id,async()=>{calls++;return applyCandidate(catId,sourceId,base);}),executeJob(job!.id,async()=>{calls++;return applyCandidate(catId,sourceId,base);})]);expect(calls).toBe(1);
 const [retry]=await db.insert(turns).values({conversationId:convId,userMessageId:sourceId,inputVersion:0}).returning();
 await commitOutcome(retry!.id,{status:'stopped'});
 const rows=await db.select().from(turns).where(eq(turns.userMessageId,sourceId));expect(rows.every(t=>t.extractedAt&&t.remembered)).toBe(true);
});
it('持久重试耗尽后不再执行',async()=>{
 await commitOutcome(turnId,{status:'stopped'});const [job]=await db.select().from(asyncJobs).where(eq(asyncJobs.sourceId,sourceId));
 let calls=0;for(let i=0;i<4;i++){await db.update(asyncJobs).set({nextAttemptAt:new Date(0)}).where(eq(asyncJobs.id,job!.id));await executeJob(job!.id,async()=>{calls++;throw Error('injected');}).catch(()=>{});}
 expect(calls).toBe(3);const [done]=await db.select().from(asyncJobs).where(eq(asyncJobs.id,job!.id));expect(done!.state).toBe('failed');
});
it('旧来源晚到不能覆盖新偏好，删除与旧明确来源并发不能复活',async()=>{
 const [newer]=await db.insert(messages).values({conversationId:convId,role:'user',text:'现在喜欢咖啡'}).returning();
 await applyCandidate(catId,newer!.id,{...base,value:'咖啡'});await applyCandidate(catId,sourceId,base);
 const [memory]=await db.select().from(memories).where(and(eq(memories.catId,catId),eq(memories.status,'active')));expect(memory!.value).toBe('咖啡');
 await Promise.all([deleteMemory(catId,memory!.id),applyCandidate(catId,newer!.id,{...base,value:'咖啡'})]);
 expect(await db.select().from(memories).where(eq(memories.catId,catId))).toHaveLength(0);
 expect(await applyCandidate(catId,sourceId,base)).toBe(false);
});
