import { followupText } from './router.ts';
import { availableAt, localISO } from './tickets.ts';
import { refreshConversationLock } from '../turns/events.ts';
import { and, eq, sql } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { boundaries, diaryEntries, messages, tickets, conversations, outbox, mailboxLetters, decisions, users } from '../db/schema.ts';
import { lockMemory } from '../memory/control.ts';
import { diaryCommentAllowed, overlapsBoundaries, followupDenial } from './gate.ts';

/** 保留聊天首字前可重读、发布后终止旧快照的原有检查顺序。 */
export function turnPublicationChecks(catId: string) {
  const boundaryStamp = async () => (await db.select({ id: boundaries.id }).from(boundaries).where(eq(boundaries.catId, catId)))
      .map((b) => b.id).sort().join(',');
  const revision = async () => JSON.stringify(await db.execute(sql`select c.persona_version, c.updated_at, c.memory_revision,
      (select max(version) from soul_versions where cat_id = c.id) soul,
      (select count(*) from soul_blocked_sources where cat_id = c.id) blocked,
      (select max(created_at) from memory_blocks where cat_id = c.id) memory_deleted
      from cats c where c.id = ${catId}`));
  const protection = async () => JSON.stringify(await db.execute(sql`select c.persona_version, c.updated_at,
      c.learn_memories, c.use_memories, c.learn_after_seq,
      (select count(*) from messages m join conversations v on v.id = m.conversation_id
        where v.cat_id = c.id and m.context_allowed = false) withdrawn,
      (select count(*) from soul_blocked_sources where cat_id = c.id) blocked,
      (select max(created_at) from memory_blocks where cat_id = c.id) memory_deleted,
      (select jsonb_agg(jsonb_build_array(id, revision) order by id) from memories
        where cat_id = c.id and extractor_version = 'user-edit-v1') edited
      from cats c where c.id = ${catId}`));
  return {
    boundaryStamp, revision, protection,
    contextUnchanged: async (expectedRevision: string | undefined, expectedBoundaries: string) =>
      !(expectedRevision !== undefined && await revision() !== expectedRevision) && await boundaryStamp() === expectedBoundaries,
    protectionUnchanged: async (expected: string) => await protection() === expected,
    revisionUnchanged: async (expected: string) => await revision() === expected,
  };
}

export async function diaryPublicationInput(tx: Tx, entryId: string, version: string) {
  const [initial] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, entryId));
  if (!initial) return null;
  const cat = await lockMemory(tx, initial.catId);
  const [entry] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, entryId));
  if (!diaryCommentAllowed(entry, version)) return null;
  const topics = await tx.select({ topic: boundaries.description, text: messages.text }).from(boundaries)
    .innerJoin(messages, eq(messages.id, boundaries.sourceMessageId))
    .where(and(eq(boundaries.catId, cat.id), eq(messages.contextAllowed, true)));
  const item = { id: entry.id, subject: '', predicate: '', value: entry.text, fingerprint: '', explicit: true, sensitivity: 'low', lastConfirmedAt: entry.updatedAt, revision: entry.revision };
  if (overlapsBoundaries(item, topics.map(t => t.topic ?? t.text))) return null;
  return { entry, revision: cat.memoryRevision, name: cat.name };
}

/** 调用方持有同一个事务，复核后才写入用户可见的留言。 */
export async function reviewDiaryPublication(tx: Tx, input: NonNullable<Awaited<ReturnType<typeof diaryPublicationInput>>>) {
  const cat = await lockMemory(tx, input.entry.catId);
  const [current] = await tx.select().from(diaryEntries).where(eq(diaryEntries.id, input.entry.id));
  if (!current?.catAllowed || current.revision !== input.entry.revision || current.visit > 0) return false;
  if (cat.memoryRevision !== input.revision) throw new Error('diary_context_changed');
  return true;
}

/** 主动产出与普通回复共用对话锁；只由用户输入递增 version。 */
export async function publishFollowups(candidate: {
  catId:string; userId:string; conversationId:string; version:number; triggerId:string;
  batch:(typeof tickets.$inferSelect)[]; text:string; overdue:boolean; now?:Date; reason:string; lockToken:string; timeZone:string;
}):Promise<'sent'|'stale'> {
  return db.transaction(async tx=>{
    const cat=await lockMemory(tx,candidate.catId);
    const [conv]=await tx.select().from(conversations).where(eq(conversations.id,candidate.conversationId)).for('update');
    if(!conv || conv.catId!==cat.id || cat.userId!==candidate.userId) throw new Error('followup_owner');
    const [user]=await tx.select().from(users).where(eq(users.id,cat.userId)).for('update');
    if(conv.version!==candidate.version || user?.timeZone!==candidate.timeZone) return 'stale';
    if(!await refreshConversationLock(conv.id,candidate.lockToken)) throw new Error('followup_lock_lost');
    const topics=await tx.select({topic:boundaries.description,text:messages.text}).from(boundaries).innerJoin(messages,eq(messages.id,boundaries.sourceMessageId)).where(and(eq(boundaries.catId,cat.id),eq(messages.contextAllowed,true)));
    const valid: (typeof tickets.$inferSelect)[]=[];
    for(const expected of candidate.batch) {
      const [t]=await tx.select().from(tickets).where(eq(tickets.id,expected.id)).for('update');
      if(!t || t.catId!==cat.id || t.status!=='open') continue;
      if(t.dueAt?.toISOString()!==expected.dueAt?.toISOString() || +t.updatedAt!==+expected.updatedAt) return 'stale';
      const [source]=t.sourceMessageId ? await tx.select().from(messages).where(eq(messages.id,t.sourceMessageId)) : [];
      const denied=followupDenial(t,source,conv.id,topics.map(t=>t.topic??t.text));
      // 本段候选只依赖用户亲口约定，不依赖记忆，use_memories=false 不撤回 explicit 授权。
      const [receipt]=await tx.select().from(outbox).where(and(eq(outbox.ticketId,t.id),eq(outbox.purpose,'followup:letter')));
      if(receipt) continue;
      if(denied) {
        await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:'followup:letter',kind:'mailbox_letter',status:'dropped',droppedReason:denied}).onConflictDoNothing();
        await tx.update(tickets).set({status:'ended',stage:'dropped',endedReason:denied,updatedAt:sql`now()`}).where(eq(tickets.id,t.id));
      } else valid.push(t);
    }
    if(!valid.length) return 'sent';
    const [clock]=await tx.execute<{instant:string}>(sql`select clock_timestamp() as instant`);
    const now=candidate.now ?? new Date(clock!.instant);
    const hour=Number(localISO(now,user!.timeZone).slice(11,13));
    if(valid.some(t=>(+now-+t.dueAt!>86400000)!==candidate.overdue)) return 'stale';
    if(!candidate.overdue && (hour<9 || hour>=22 || valid.some(t=>+availableAt(t.dueAt!,user!.timeZone)>+now))) return 'stale';
    const text=valid.length===candidate.batch.length ? candidate.text : followupText(valid,candidate.overdue);
    if(!candidate.overdue) await tx.insert(messages).values({conversationId:conv.id,role:'cat',text,ticketId:valid[0]!.id,memoryEligible:false});
    await tx.insert(mailboxLetters).values({catId:cat.id,ticketId:valid[0]!.id,text});
    for(const t of valid) {
      if(!candidate.overdue) await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:'followup:chat',kind:'chat_message',status:'sent'}).onConflictDoNothing();
      await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:'followup:letter',kind:'mailbox_letter',status:'sent'}).onConflictDoNothing();
      await tx.update(tickets).set({status:'ended',stage:candidate.overdue?'letter':'asked',endedReason:'delivered',updatedAt:sql`now()`}).where(eq(tickets.id,t.id));
      await tx.insert(decisions).values({triggerId:candidate.triggerId,ticketId:t.id,outcome:'attach',reasons:[candidate.reason,candidate.overdue?'超过24小时只留信':'亲口约定到期']});
    }
    // PG收据即前台可重放的提示来源；本段没有外部副作用，无需额外投递。
    return 'sent';
  });
}

/** 托付出口：持有对话锁，并在同一事务里复核、写正文和收据。 */
export async function publishErrand(candidate:{runId:string;attempt:number;lockToken:string;now:Date}):Promise<'sent'|'stale'|{retryAt:Date}> {
 const {runs,ticketInputs,proactiveRules}=await import('../db/schema.ts');
 return db.transaction(async tx=>{
 const [initial]=await tx.select({r:runs,t:tickets}).from(runs).innerJoin(tickets,eq(tickets.id,runs.ticketId)).where(eq(runs.id,candidate.runId));if(!initial)return 'sent';
 const cat=await lockMemory(tx,initial.t.catId);
 const [conv]=await tx.select().from(conversations).where(eq(conversations.catId,cat.id)).for('update');
 const [user]=await tx.select().from(users).where(eq(users.id,cat.userId)).for('update');
 const [t]=await tx.select().from(tickets).where(eq(tickets.id,initial.t.id)).for('update');
 const [r]=await tx.select().from(runs).where(eq(runs.id,initial.r.id)).for('update');
 if(!r||!t||!conv||!user||r.attempt!==candidate.attempt||r.status!=='running')return 'sent';
 if(!await refreshConversationLock(conv.id,candidate.lockToken))throw new Error('errand_lock_lost');
 const journal=r.report,a=journal.active;if(!a)return 'stale';
 let denied:string|undefined;
 const sourceTexts:string[]=[];
 if(t.catId!==cat.id||conv.catId!==cat.id||t.kind!=='errand')throw new Error('errand_owner');
 if(t.status!=='open')denied='授权已撤回';
 if(t.mandate.kind==='inferred'){
 const [rule]=await tx.select().from(proactiveRules).where(and(eq(proactiveRules.ruleId,t.mandate.rule_id),eq(proactiveRules.version,t.mandate.version)));
 if(rule?.mode!=='auto')denied='规则已关闭';
 }else if(t.mandate.source_message_id!==t.sourceMessageId)denied='授权不可用';
 const topics=await tx.select({topic:boundaries.description,text:messages.text}).from(boundaries).innerJoin(messages,eq(messages.id,boundaries.sourceMessageId)).where(and(eq(boundaries.catId,cat.id),eq(messages.contextAllowed,true)));
 for(const id of new Set([t.sourceMessageId,...journal.dependencies.messages])){
 const [m]=id?await tx.select().from(messages).where(eq(messages.id,id)):[];
 if(!m?.contextAllowed||m.conversationId!==conv.id)denied='原话已停止使用';
 else sourceTexts.push(m.text);
 }
 for(const ref of journal.dependencies.diaries){
 const [d]=await tx.select().from(diaryEntries).where(eq(diaryEntries.id,ref.id));
 if(!d?.catAllowed||d.catId!==cat.id||d.revision!==ref.revision)denied='日记已停止使用或修改';
 else sourceTexts.push(d.text);
 }
 if(journal.dependencies.usedMemories&&(!cat.useMemories||cat.memoryRevision!==journal.dependencies.memoryRevision))denied='记忆许可或内容已变化';
 if(overlapsBoundaries({id:t.id,subject:'',predicate:'',value:[t.goal,a.result,a.question,a.reason,...sourceTexts].filter(Boolean).join(' '),fingerprint:'',explicit:true,sensitivity:'low',lastConfirmedAt:t.createdAt,revision:0},topics.map(t=>t.topic??t.text)))denied='不要再提';
 const purpose=`errand:${a.status==='waiting'?'waiting:'+a.callId:a.status}`;
 const [receipt]=await tx.select().from(outbox).where(and(eq(outbox.ticketId,t.id),eq(outbox.purpose,purpose+':chat')));
 if(receipt)return 'sent';
 const finish=async(stage:string,reason:string)=>{
 await tx.update(runs).set({status:'ended',leaseUntil:null,stepStartedAt:null}).where(eq(runs.id,r.id));
 if(t.status==='open')await tx.update(tickets).set({status:'ended',stage,endedReason:reason,updatedAt:candidate.now}).where(eq(tickets.id,t.id));
 };
 if(denied||a.status==='dropped'){
 await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:purpose+':chat',kind:'chat_message',status:'dropped',droppedReason:denied??'不需要继续'}).onConflictDoNothing();
 await finish('dropped',denied??'dropped');return 'sent';
 }
 const [unread]=await tx.select().from(ticketInputs).where(and(eq(ticketInputs.ticketId,t.id),sql`${ticketInputs.readAt} is null`)).limit(1);
 if(conv.version!==journal.version||user.timeZone!==journal.timeZone||unread)return 'stale';
 if(a.status==='waiting'&&+candidate.now-Date.parse(a.createdAt)>=86400000){
 await tx.update(tickets).set({stage:'quiet_waiting',updatedAt:candidate.now}).where(eq(tickets.id,t.id));
 await tx.update(runs).set({status:'pending',leaseUntil:null,stepStartedAt:null}).where(eq(runs.id,r.id));return 'sent';
 }
 const available=availableAt(candidate.now,user.timeZone);if(+available>+candidate.now)return {retryAt:available};
 const text=a.status==='ready'?'我想好了一些，放在信箱里了，想看时再拆。':a.status==='waiting'?a.question!:`这件事没能办好。${a.reason??'这次没有想出可靠的办法。'}`;
 if(a.status==='progress')return 'sent';
 await tx.insert(messages).values({conversationId:conv.id,role:'cat',text,ticketId:t.id,memoryEligible:false});
 await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:purpose+':chat',kind:'chat_message',status:'sent'});
 if(a.status==='ready'){
 await tx.insert(mailboxLetters).values({catId:cat.id,ticketId:t.id,text:a.result!});
 await tx.insert(outbox).values({catId:cat.id,ticketId:t.id,purpose:'errand:ready:letter',kind:'mailbox_letter',status:'sent'});
 }
 if(a.status==='waiting'){
 await tx.update(tickets).set({stage:'waiting',updatedAt:candidate.now}).where(eq(tickets.id,t.id));
 await tx.update(runs).set({status:'pending',leaseUntil:null,stepStartedAt:null}).where(eq(runs.id,r.id));
 }else await finish(a.status,'delivered');
 return 'sent';
 });
}
