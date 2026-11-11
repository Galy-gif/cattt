import { and,asc,eq,inArray,isNull,sql } from 'drizzle-orm';
import { db,type Tx } from '../db/client.ts';
import { cats,conversations,messages,tickets,ticketInputs,triggers,decisions,runs,asyncJobs } from '../db/schema.ts';
import { TicketError,localISO } from './tickets.ts';
import { userTimeZone } from '../runtime/time.ts';
import { clockNow } from './followup.ts';
async function catLock(tx:Tx,catId:string) {
 const [cat]=await tx.select().from(cats).where(eq(cats.id,catId)).for('update');
 if(!cat)throw new TicketError(404,'没有这件事');return cat;
}
export async function wakeErrand(tx:Tx,runId:string) {
 await tx.insert(asyncJobs).values({kind:'errand',sourceId:runId,objectId:runId,version:'v1'}).onConflictDoNothing();
 await tx.update(asyncJobs).set({state:'pending',nextAttemptAt:sql`now()`,leaseUntil:null,error:null})
 .where(and(eq(asyncJobs.objectId,runId),eq(asyncJobs.kind,'errand'),inArray(asyncJobs.state,['done','failed','pending'])));
}
async function capacity(tx:Tx,catId:string,day:string) {
 const rows=await tx.select().from(tickets).where(and(eq(tickets.catId,catId),eq(tickets.kind,'errand')));
 return rows.filter(t=>t.status==='open'&&t.stage!=='queued').length<2 && rows.filter(t=>t.localDay===day).length<5;
}
export async function startErrand(catId:string,sourceId:string,goal:string,at?:Date) {
 goal=goal.trim();if(!goal||[...goal].length>60)throw new TicketError(400,'托付请用60字以内说清楚');
 const now=at??await clockNow(),zone=await userTimeZone(catId),day=localISO(now,zone).slice(0,10);
 return db.transaction(async tx=>{
 await catLock(tx,catId);
 const [source]=await tx.select({m:messages}).from(messages).innerJoin(conversations,eq(conversations.id,messages.conversationId)).where(and(eq(messages.id,sourceId),eq(conversations.catId,catId),eq(messages.contextAllowed,true),eq(messages.role,'user')));
 if(!source)throw new TicketError(404,'原话已不可使用');
 const key=`errand:${sourceId}:${goal}`;
 await tx.insert(triggers).values({catId,source:'chat',idempotencyKey:key,payload:{message_id:sourceId,about:goal}}).onConflictDoNothing();
 const [event]=await tx.select().from(triggers).where(and(eq(triggers.catId,catId),eq(triggers.source,'chat'),eq(triggers.idempotencyKey,key)));
 const [prior]=await tx.select({t:tickets}).from(decisions).innerJoin(tickets,eq(tickets.id,decisions.ticketId)).where(eq(decisions.triggerId,event!.id));
 if(prior)return {ticket_id:prior.t.id,queued:prior.t.stage==='queued'};
 const queued=!await capacity(tx,catId,day);
 const [t]=await tx.insert(tickets).values({catId,kind:'errand',goal,mandate:{kind:'explicit',source_message_id:sourceId},sourceMessageId:sourceId,stage:queued?'queued':'thinking',timeZone:zone,localDay:queued?null:day,createdAt:now,updatedAt:now}).returning();
 await tx.insert(decisions).values({triggerId:event!.id,outcome:'accept',ticketId:t!.id,reasons:['用户亲口托付',queued?'预算排队':'开始想']});
 const [r]=await tx.insert(runs).values({ticketId:t!.id}).returning();
 if(!queued)await wakeErrand(tx,r!.id);
 return {ticket_id:t!.id,queued};
 });
}
export async function appendTicketInput(catId:string,ticketId:string,text:string,sourceId?:string) {
 if(!text.trim()||[...text].length>2000)throw new TicketError(400,'补充的话请写在2000字以内');
 return db.transaction(async tx=>{
 await catLock(tx,catId);
 const [t]=await tx.select().from(tickets).where(and(eq(tickets.id,ticketId),eq(tickets.catId,catId),eq(tickets.status,'open'),eq(tickets.kind,'errand'))).for('update');
 if(!t)throw new TicketError(404,'没有这件托付');
 if(sourceId){
 const [m]=await tx.select({m:messages}).from(messages).innerJoin(conversations,eq(conversations.id,messages.conversationId)).where(and(eq(messages.id,sourceId),eq(conversations.catId,catId),eq(messages.contextAllowed,true),eq(messages.role,'user')));
 if(!m)throw new TicketError(404,'原话已不可使用');
 const [old]=await tx.select().from(ticketInputs).where(and(eq(ticketInputs.ticketId,ticketId),eq(ticketInputs.messageId,sourceId)));
 if(old)return {ticket_id:ticketId,saved:true};
 text=m.m.text;
 }
 await tx.insert(ticketInputs).values({ticketId,messageId:sourceId,text});
 // 新补充撤销旧候选；执行中的消费者在下一步读取，不争抢其租约。
 const [r]=await tx.select().from(runs).where(eq(runs.ticketId,ticketId)).for('update');
 if(r){
 const journal={...r.report,active:undefined,version:undefined,freshRetries:0};
 await tx.update(runs).set({report:journal,status:r.status==='running'?'running':'pending'}).where(eq(runs.id,r.id));
 if(t.stage!=='queued')await wakeErrand(tx,r.id);
 }
 if(t.stage!=='queued')await tx.update(tickets).set({stage:'thinking',updatedAt:sql`now()`}).where(eq(tickets.id,ticketId));
 return {ticket_id:ticketId,saved:true};
 });
}
export async function scanErrands(at?:Date,catId?:string) {
 const now=at??await clockNow();
 const all=await db.select().from(tickets).where(and(eq(tickets.kind,'errand'),eq(tickets.status,'open'),catId?eq(tickets.catId,catId):undefined)).orderBy(asc(tickets.createdAt),asc(tickets.id)).limit(500);
 for(const t of all){
 const zone=await userTimeZone(t.catId),day=localISO(now,zone).slice(0,10);
 await db.transaction(async tx=>{
 await catLock(tx,t.catId);
 const [current]=await tx.select().from(tickets).where(eq(tickets.id,t.id)).for('update');
 if(!current||current.status!=='open')return;
 const [r]=await tx.select().from(runs).where(eq(runs.ticketId,t.id)).for('update');if(!r)return;
 if(current.stage==='queued'){
 if(!await capacity(tx,t.catId,day))return;
 await tx.update(tickets).set({stage:'thinking',localDay:day,timeZone:zone,updatedAt:now}).where(eq(tickets.id,t.id));await wakeErrand(tx,r.id);
 }else if(current.stage==='waiting'&&r.report.active&&+now-Date.parse(r.report.active.createdAt)>=86400000){
 await tx.update(tickets).set({stage:'quiet_waiting',updatedAt:now}).where(eq(tickets.id,t.id));
 }else if(current.stage==='thinking'&&r.status==='pending'){
 const [job]=await tx.select().from(asyncJobs).where(and(eq(asyncJobs.objectId,r.id),eq(asyncJobs.kind,'errand')));
 if(!job||['done','failed'].includes(job.state))await wakeErrand(tx,r.id);
 }
 });
 }
}
