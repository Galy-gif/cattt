import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { generateText, streamText } from 'ai';
import { db, sql } from '../src/db/client.ts';
import { users,modelReservations } from '../src/db/schema.ts';
import { withModelAccount, budgetModel } from '../src/runtime/budget.ts';
import { mockExtractModel, mockChatModel } from '../src/runtime/mock.ts';
import { config } from '../src/config.ts';
const ids:string[]=[];
afterAll(async()=>{for(const id of ids)await db.delete(users).where(eq(users.id,id));await sql.end();});
it('并发调用前确定性预留，额度不足不调用供应商，失败不退还，跨时区不能重新消费同日',async()=>{
 const[u]=await db.insert(users).values({timeZone:'UTC',name:randomUUID()}).returning();ids.push(u!.id);const old=config.MODEL_DAILY_CALL_LIMIT;config.MODEL_DAILY_CALL_LIMIT=2;
 try{
 const model=budgetModel(mockExtractModel(),'memory_extract');const run=()=>withModelAccount(u!.id,()=>generateText({model,prompt:'我喜欢茶',maxRetries:0}));const results=await Promise.allSettled([run(),run(),run()]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(2);
 expect(await db.select().from(modelReservations).where(eq(modelReservations.userId,u!.id))).toHaveLength(2);
 await expect(run()).rejects.toThrow();
 }finally{config.MODEL_DAILY_CALL_LIMIT=old;}
});
it('流式快聊与后台共享同一额度；每次SDK重试也需预留，未绑定身份的发布模型拒绝',async()=>{
 const[u]=await db.insert(users).values({timeZone:'UTC'}).returning();ids.push(u!.id);const old=config.MODEL_DAILY_CALL_LIMIT;config.MODEL_DAILY_CALL_LIMIT=1;
 try{await withModelAccount(u!.id,async()=>{const r=streamText({model:budgetModel(mockChatModel(),'chat'),prompt:'你好',maxRetries:0});await r.text;});await expect(withModelAccount(u!.id,()=>generateText({model:budgetModel(mockExtractModel(),'memory_extract'),prompt:'茶',maxRetries:0}))).rejects.toThrow();}
 finally{config.MODEL_DAILY_CALL_LIMIT=old;}
 const env=config.APP_ENV;try{config.APP_ENV='staging';await expect(generateText({model:budgetModel(mockExtractModel(),'memory_extract'),prompt:'茶',maxRetries:0})).rejects.toThrow();}finally{config.APP_ENV=env;}
});
it('供应商流错误仍收费，预留记录记failed；token额度独立于调用次数挡在请求前',async()=>{
 const[u]=await db.insert(users).values({timeZone:'UTC'}).returning();ids.push(u!.id);
 await withModelAccount(u!.id,async()=>{const r=streamText({model:budgetModel(mockChatModel(),'chat'),prompt:'[fail] 流错误',maxRetries:0,onError:()=>{}});for await(const _ of r.fullStream){};});
 const [row]=await db.select().from(modelReservations).where(eq(modelReservations.userId,u!.id));expect(row!.status).toBe('failed');
 const old=config.MODEL_DAILY_TOKEN_LIMIT;config.MODEL_DAILY_TOKEN_LIMIT=1;
 try{await expect(withModelAccount(u!.id,()=>generateText({model:budgetModel(mockExtractModel(),'memory_extract'),prompt:'茶',maxRetries:0}))).rejects.toThrow();expect(await db.select().from(modelReservations).where(eq(modelReservations.userId,u!.id))).toHaveLength(1);}finally{config.MODEL_DAILY_TOKEN_LIMIT=old;}
});
it('后台日额度不足保留PG待办到下一UTC日，不耗尽三次失败机会',async()=>{
 const {asyncJobs}=await import('../src/db/schema.ts');const{executeJob}=await import('../src/jobs/store.ts');const{ModelBudgetExceeded}=await import('../src/runtime/budget.ts');
 const [j]=await db.insert(asyncJobs).values({kind:'boundary',sourceId:randomUUID(),objectId:randomUUID(),version:'budget-test'}).returning();
 try{await executeJob(j!.id,async()=>{throw new ModelBudgetExceeded();}).catch(()=>{});const[row]=await db.select().from(asyncJobs).where(eq(asyncJobs.id,j!.id));expect(row!.state).toBe('pending');expect(row!.attempts).toBe(0);expect(+row!.nextAttemptAt-Date.now()).toBeGreaterThan(60000);}finally{await db.delete(asyncJobs).where(eq(asyncJobs.id,j!.id));}
});
