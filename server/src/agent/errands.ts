import { and,asc,desc,eq,inArray,sql } from 'drizzle-orm';
import { db,type Tx } from '../db/client.ts';
import { cats,conversations,tickets,ticketInputs,runs,asyncJobs,type RunJournal } from '../db/schema.ts';
import { TicketError,localISO } from './tickets.ts';
import { userTimeZone } from '../runtime/time.ts';
import { clockNow } from './followup.ts';
import { commandOrigin, receiveCommand } from './intake.ts';
import { errandDenial } from './publisher.ts';
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
 const admitted=await tx.select({id:runs.id}).from(runs).innerJoin(tickets,eq(tickets.id,runs.ticketId))
 .where(and(eq(tickets.catId,catId),eq(tickets.kind,'errand'),eq(runs.localDay,day))).limit(5);
 return rows.filter(t=>t.status==='open'&&t.stage!=='queued').length<2 && admitted.length<5;
}
export async function startErrand(catId: string, sourceId: string, goal: string, at?: Date) {
  goal = goal.trim();
  if (!goal || [...goal].length > 60) throw new TicketError(400, '托付请用60字以内说清楚');
  const now = at ?? await clockNow(), zone = await userTimeZone(catId), day = localISO(now, zone).slice(0, 10);
  return receiveCommand(catId, { source: 'chat', messageId: sourceId }, {
    kind: 'start', input: { goal }, legacyKey: `errand:${sourceId}:${goal}`, payload: { about: goal },
  }, async tx => {
    const queued = !await capacity(tx, catId, day);
    const [t] = await tx.insert(tickets).values({ catId, kind: 'errand', goal,
      mandate: { kind: 'explicit', source_message_id: sourceId }, sourceMessageId: sourceId,
      stage: queued ? 'queued' : 'thinking', timeZone: zone, localDay: queued ? null : day, createdAt: now, updatedAt: now }).returning();
    const [r] = await tx.insert(runs).values({ ticketId: t!.id, localDay: queued ? null : day }).returning();
    if (!queued) await wakeErrand(tx, r!.id);
    return { receipt: { ticket_id: t!.id, queued }, ticketId: t!.id, outcome: 'accept',
      reasons: ['用户亲口托付', queued ? '预算排队' : '开始想'] };
  }, prior => ({ ticket_id: prior.id, queued: prior.stage === 'queued' }));
}

export async function appendTicketInput(catId: string, ticketId: string, text: string, sourceId?: string, requestId?: string) {
  text = text.trim();
  if (!text || [...text].length > 2000) throw new TicketError(400, '补充的话请写在2000字以内');
  return receiveCommand(catId, commandOrigin(sourceId, requestId), {
    kind: 'append', input: { ticket_id: ticketId, text },
  }, async (tx, source) => {
    const [t] = await tx.select().from(tickets).where(and(eq(tickets.id, ticketId), eq(tickets.catId, catId), eq(tickets.kind, 'errand'))).for('update');
    const resuming = t?.status === 'ended' && ['failed', 'blocked'].includes(t.stage);
    if (!t || (t.status !== 'open' && !resuming)) throw new TicketError(404, '没有这件托付');
    const accepted = { receipt: { ticket_id: ticketId, saved: true }, ticketId,
      outcome: 'attach' as const, reasons: ['用户补充'] };
    if (source) {
      // 升级前已接收的原话也不重复唤醒；其后的重放走统一收据。
      const [old] = await tx.select().from(ticketInputs).where(and(eq(ticketInputs.ticketId, ticketId), eq(ticketInputs.messageId, source.id)));
      if (old) return accepted;
    }
    const [r] = await tx.select().from(runs).where(eq(runs.ticketId, ticketId)).orderBy(desc(runs.generation)).limit(1).for('update');
    if (resuming) {
      if (!r || r.status !== 'ended' || t.mandate.kind !== 'explicit') throw new TicketError(409, '这件托付暂时不能继续');
      const [cat] = await tx.select().from(cats).where(eq(cats.id, catId));
      const [conv] = await tx.select().from(conversations).where(eq(conversations.catId, catId));
      const inputs = await tx.select().from(ticketInputs).where(eq(ticketInputs.ticketId, ticketId));
      // 新执行只带原托付与用户补充，不沿用失败执行的模型观察或旧许可快照。
      const journal: RunJournal = { calls: {}, freshRetries: 0, dependencies: {
        messages: [...new Set([...inputs.flatMap(i => i.messageId ? [i.messageId] : []), ...(source ? [source.id] : [])])],
        diaries: [], usedMemories: false,
      } };
      const denied = !cat || !conv ? '原话已不可使用' : await errandDenial(tx, cat, conv, { ...t, status: 'open' }, journal,
        [...inputs.map(i => i.text), source?.text ?? text].join('\n'));
      if (denied) throw new TicketError(409, denied);
      const now = await clockNow(), zone = await userTimeZone(catId), day = localISO(now, zone).slice(0, 10);
      const queued = !await capacity(tx, catId, day);
      await tx.insert(ticketInputs).values({ ticketId, messageId: source?.id, text: source?.text ?? text });
      const [next] = await tx.insert(runs).values({ ticketId, generation: r.generation + 1, localDay: queued ? null : day, report: journal }).returning();
      await tx.update(tickets).set({ status: 'open', stage: queued ? 'queued' : 'thinking', endedReason: null,
        localDay: queued ? null : day, timeZone: zone, updatedAt: now }).where(eq(tickets.id, ticketId));
      if (!queued) await wakeErrand(tx, next!.id);
      return { ...accepted, receipt: { ...accepted.receipt, resumed: true, queued }, reasons: ['用户补充并继续原托付', queued ? '预算排队' : '重新开始想'] };
    }
    await tx.insert(ticketInputs).values({ ticketId, messageId: source?.id, text: source?.text ?? text });
    // 新补充撤销旧候选；执行中的消费者在下一步读取，不争抢其租约。
    if (r) {
      const journal = { ...r.report, active: undefined, version: undefined, freshRetries: 0 };
      await tx.update(runs).set({ report: journal, status: r.status === 'running' ? 'running' : 'pending' }).where(eq(runs.id, r.id));
      if (t.stage !== 'queued') await wakeErrand(tx, r.id);
    }
    if (t.stage !== 'queued') await tx.update(tickets).set({ stage: 'thinking', updatedAt: sql`now()` }).where(eq(tickets.id, ticketId));
    return accepted;
  });
}
export async function scanErrands(at?:Date,catId?:string) {
 const now=at??await clockNow();
 let cursor:{createdAt:string;id:string}|undefined;
 while(true){
 // 用数据库原始时间精度推进游标，等待中的旧事项不会永久占住第一页。
 const page=await db.select({ticket:tickets,cursorTime:sql<string>`${tickets.createdAt}::text`}).from(tickets).where(and(eq(tickets.kind,'errand'),eq(tickets.status,'open'),catId?eq(tickets.catId,catId):undefined,
 cursor?sql`(${tickets.createdAt},${tickets.id}) > (${cursor.createdAt}::timestamptz,${cursor.id}::uuid)`:undefined)).orderBy(asc(tickets.createdAt),asc(tickets.id)).limit(500);
 for(const {ticket:t} of page){
 const zone=await userTimeZone(t.catId),day=localISO(now,zone).slice(0,10);
 await db.transaction(async tx=>{
 await catLock(tx,t.catId);
 const [current]=await tx.select().from(tickets).where(eq(tickets.id,t.id)).for('update');
 if(!current||current.status!=='open')return;
 const [r]=await tx.select().from(runs).where(eq(runs.ticketId,t.id)).orderBy(desc(runs.generation)).limit(1).for('update');if(!r)return;
 if(current.stage==='queued'){
 if(!await capacity(tx,t.catId,day))return;
 await tx.update(tickets).set({stage:'thinking',localDay:day,timeZone:zone,updatedAt:now}).where(eq(tickets.id,t.id));
 await tx.update(runs).set({localDay:day}).where(eq(runs.id,r.id));await wakeErrand(tx,r.id);
 }else if(current.stage==='waiting'&&r.report.active&&+now-Date.parse(r.report.active.createdAt)>=86400000){
 await tx.update(tickets).set({stage:'quiet_waiting',updatedAt:now}).where(eq(tickets.id,t.id));
 }else if(current.stage==='thinking'&&r.status==='pending'&&!r.report.active){
 const [job]=await tx.select().from(asyncJobs).where(and(eq(asyncJobs.objectId,r.id),eq(asyncJobs.kind,'errand')));
 if(!job||['done','failed'].includes(job.state))await wakeErrand(tx,r.id);
 }
 });
 }
 if(page.length<500)break;
 const last=page.at(-1)!;cursor={createdAt:last.cursorTime,id:last.ticket.id};
 }
}
