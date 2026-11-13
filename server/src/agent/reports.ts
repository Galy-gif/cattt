import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { asyncJobs, cats, conversations, messages, runs, tickets, workerReports } from '../db/schema.ts';
import { acquireConversationLock, releaseConversationLock, conversationBusy } from '../turns/events.ts';
import { personaBlock } from '../runtime/persona.ts';
import { turnPublicationChecks, publishDailyDiary, publishErrand, publishDiaryRead, errandDenial } from './publisher.ts';
import { routeReport, reviewReport, reportText, type ReportSnapshot } from './router.ts';
import { wakeErrand } from './errands.ts';
import { clockNow } from './followup.ts';

/** 前台入口：重新读取会话、复核汇报；耗时措辞不持会话锁。 */
export async function processReport(id: string, options: {now?:Date; route?:(snapshot:ReportSnapshot)=>Promise<unknown>} = {}): Promise<void|{retryAt:Date}> {
  const [event] = await db.select().from(workerReports).where(eq(workerReports.id,id));
  if (!event) return;
  const payload = event.payload;
  if (payload.kind === 'diary_read') {
    if (await publishDiaryRead(payload) === 'stale') await db.insert(asyncJobs).values({kind:'diary_read',sourceId:id,objectId:payload.entryId,version:payload.version}).onConflictDoNothing();
    return;
  }
  if (payload.kind === 'daily_diary') {
    const result = await publishDailyDiary(payload);
    if (result === 'stale') await db.insert(asyncJobs).values({kind:'daily_diary',sourceId:payload.triggerId,objectId:payload.triggerId,version:id}).onConflictDoNothing();
    return;
  }
  const [row] = await db.select({r:runs,t:tickets,c:cats,v:conversations}).from(runs)
    .innerJoin(tickets,eq(tickets.id,runs.ticketId)).innerJoin(cats,eq(cats.id,tickets.catId))
    .innerJoin(conversations,eq(conversations.catId,cats.id)).where(eq(runs.id,payload.runId));
  if (!row || row.t.status !== 'open' || row.r.status === 'ended' || row.r.attempt !== payload.attempt || row.r.report.active?.callId !== payload.callId) return;
  const now = options.now ?? await clockNow();
  if(await conversationBusy(row.v.id))return {retryAt:new Date(+now+1000)};
  const checks = turnPublicationChecks(row.c.id), protection = await checks.protection();
  const recent = await db.select({id:messages.id,role:messages.role,text:messages.text}).from(messages)
    .where(and(eq(messages.conversationId,row.v.id),eq(messages.contextAllowed,true))).orderBy(desc(messages.seq)).limit(6);
  const snapshot:ReportSnapshot = {persona:personaBlock(row.c).split('\n## 你在院子里怎么过')[0]!,goal:row.t.goal,
    report:row.r.report.active,version:row.v.version,recent:recent.reverse().map(m=>({...m,text:m.text.slice(0,500)}))};
  let text = reportText(snapshot.report);
  // 已过时的计算先重取上下文，不为注定不能发布的结果多花一次措辞请求。
  if (row.r.report.version === row.v.version && snapshot.report.status !== 'dropped' && !await errandDenial(db,row.c,row.v,row.t,row.r.report)) {
    try { text = reviewReport(await (options.route ?? routeReport)(snapshot),snapshot); }
    catch { /* Router故障用已知状态的短句，不丢失汇报。 */ }
  }
  const token = randomUUID();
  if (!await acquireConversationLock(row.v.id,token,150)) return {retryAt:new Date(+now+1000)};
  try {
    // 新的边界/撤回也可能不增加对话 version；旧措辞不能混入新的出版检查。
    if (!await checks.protectionUnchanged(protection)) return {retryAt:new Date(+now+1000)};
    const result = await publishErrand({runId:payload.runId,attempt:payload.attempt,callId:payload.callId,lockToken:token,now,text,protection});
    if (result === 'stale') await db.transaction(async tx=>{
      await tx.select().from(cats).where(eq(cats.id,row.c.id)).for('update');
      const [ticket] = await tx.select().from(tickets).where(eq(tickets.id,row.t.id)).for('update');
      const [run] = await tx.select().from(runs).where(eq(runs.id,payload.runId)).for('update');
      if (ticket?.status !== 'open' || !run || run.attempt !== payload.attempt || run.report.active?.callId !== payload.callId) return;
      await tx.update(runs).set({report:{...run.report,active:undefined,version:undefined,freshRetries:run.report.freshRetries+1},status:'pending',leaseUntil:null}).where(eq(runs.id,run.id));
      await wakeErrand(tx,run.id);
    });
    else if (typeof result === 'object') return result;
  } finally { await releaseConversationLock(row.v.id,token); }
}
