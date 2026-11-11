import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { asyncJobs, cats, conversations, decisions, diaryCalendars, diaryEntries, diaryFacts, messages, proactiveRules, tickets, triggers, users } from '../db/schema.ts';
import type { WorldSnapshot } from '../world/protocol.ts';
import { recallPermissions } from '../memory/recall.ts';
import { overlapsBoundaries } from './gate.ts';
import { localISO } from './tickets.ts';
import { publishDailyDiary } from './publisher.ts';
import { routeDailyDiary, writeDailyDiary } from './diary-writer.ts';
import { z } from 'zod';
import { personaBlock } from '../runtime/persona.ts';

export const reflectionText = {
  quiet: '把日子过慢一点，也很好。给自己留一点安静的空当，心里就软软的。',
  curious: '小小的念头，可以慢慢想。不急着给每一件事找答案，也有一点自在。',
  gentle: '喜欢不慌不忙的感觉。把这一页轻轻收好，再给自己留一点柔软。',
} as const;
const draftSchema = z.object({ reflection: z.string().trim().min(1).max(180), fact_ids: z.array(z.string()).max(4) }).strict();
export type DailyFact = { id: string; sourceId: string; kind: 'message' | 'world'; text: string };
export type DailyInput = { ticketId: string; catId: string; day: string; timeZone: string; persona: string; facts: DailyFact[]; boundaryTopics: string[]; stamp: string };
const item = (text: string) => ({ id: '', subject: '', predicate: '', value: text, fingerprint: '', explicit: true, sensitivity: 'low', lastConfirmedAt: new Date(0), revision: 0 });
export const nextDay = (day: string, n = 1) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** 此时区该日期第一个真实时刻；兼容 DST 缺失午夜和整日跳过。 */
export function dayStart(day: string, zone: string) {
  let low = Date.parse(day + 'T00:00:00Z') - 36 * 3600000;
  let high = low + 72 * 3600000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localISO(new Date(mid), zone).slice(0, 10) < day) low = mid; else high = mid;
  }
  return new Date(high);
}

/** 调用方已鉴权且持有猫锁；不存天气、用户到访/倒水、累计轨迹或未完成动作。 */
export async function recordDiaryObservation(tx: Tx, catId: string, snapshot: WorldSnapshot, observedAt: Date) {
  if (snapshot.paused || !snapshot.runnable || snapshot.phase !== 'idle' && snapshot.phase !== 'interacting') return;
  const [u] = await tx.select({ zone: users.timeZone }).from(cats).innerJoin(users, eq(users.id, cats.userId)).where(eq(cats.id, catId));
  if (!u) return;
  const places = { house: '小屋旁', tree: '树边', bed: '窝边', grass: '草地边', pond: '池塘边', fence: '栅栏边' };
  // 观察只证明该时刻的地点，activity 不能证明整套动作已完成。
  const text = `有一会儿，我在${places[snapshot.currentDestinationId]}。`;
  await tx.insert(diaryFacts).values({ catId, localDay: localISO(observedAt, u.zone).slice(0, 10), timeZone: u.zone,
    fingerprint: createHash('sha256').update(text).digest('hex'), text, observedAt }).onConflictDoNothing();
}

/** 00:05 后，为上一完整日期及更早缺项建 PG 事项/待办。每轮至多32个缺日，下轮接续。 */
export async function scanDailyDiaries(now?: Date, catId?: string) {
  const instant = now ?? new Date((await db.execute<{instant:string}>(sql`select now() as instant`))[0]!.instant);
  const all = await db.select({ c: cats, u: users }).from(cats).innerJoin(users, eq(users.id, cats.userId)).where(catId ? eq(cats.id, catId) : undefined);
  for (const { c, u } of all) await db.transaction(async tx => {
    await tx.select().from(cats).where(eq(cats.id, c.id)).for('update');
    const [owner] = await tx.select().from(users).where(eq(users.id, u.id)).for('update');
    if (!owner) return;
    const zone = owner.timeZone, local = localISO(instant, zone);
    const last = nextDay(local.slice(0, 10), local.slice(11, 16) >= '00:05' ? -1 : -2);
    await tx.insert(diaryCalendars).values({ catId: c.id, startDay: localISO(c.createdAt, zone).slice(0, 10) }).onConflictDoNothing();
    const [calendar] = await tx.select().from(diaryCalendars).where(eq(diaryCalendars.catId, c.id));
    const existing = new Set((await tx.select({day:tickets.localDay}).from(tickets).where(and(eq(tickets.catId,c.id),eq(tickets.kind,'diary')))).map(t=>t.day));
    let added = 0;
    for (let day = calendar!.startDay; day <= last && added < 32; day = nextDay(day)) {
      if (existing.has(day)) continue;
      const start = dayStart(day, zone), end = dayStart(nextDay(day), zone);
      // IANA 日历曾跳过的整天不是完整本地日，明确不生成。
      if (+start === +end) continue;
      const [event] = await tx.insert(triggers).values({catId:c.id,source:'clock',idempotencyKey:`clock:day:${c.id}:${day}`,
        payload:{local_day:day,time_zone:zone,start_at:start.toISOString(),end_at:end.toISOString()}}).onConflictDoNothing().returning();
      if (!event) continue;
      const [ticket] = await tx.insert(tickets).values({catId:c.id,kind:'diary',goal:`写${day}的日记`,localDay:day,timeZone:zone,
        mandate:{kind:'inferred',rule_id:'daily_diary',version:1},stage:'writing'}).returning();
      await tx.insert(decisions).values({triggerId:event.id,ticketId:ticket!.id,outcome:'accept',reasons:['产品规则：为已完整结束的本地日期写日记']});
      await tx.insert(asyncJobs).values({kind:'daily_diary',sourceId:event.id,objectId:event.id,version:'v1'}).onConflictDoNothing();
      added++;
    }
  });
}

/** 每次重新建立素材；不读当前世界 snapshot，不读用户私密小记或长期记忆。 */
export async function dailyDiaryInput(ticketId: string, reader: Tx | typeof db = db): Promise<DailyInput | null> {
  const [row] = await reader.select({t:tickets,c:cats,u:users,v:conversations}).from(tickets)
    .innerJoin(cats,eq(cats.id,tickets.catId)).innerJoin(users,eq(users.id,cats.userId)).innerJoin(conversations,eq(conversations.catId,cats.id)).where(eq(tickets.id,ticketId));
  if (!row || row.t.kind !== 'diary' || row.t.status !== 'open') return null;
  const {t,c,u,v} = row;
  const [rule] = await reader.select().from(proactiveRules).where(and(eq(proactiveRules.ruleId,'daily_diary'),eq(proactiveRules.version,1)));
  if (rule?.mode !== 'auto' || t.mandate.kind !== 'inferred' || t.mandate.rule_id !== 'daily_diary' || t.mandate.version !== 1) return null;
  const [event] = await reader.select({e:triggers}).from(decisions).innerJoin(triggers,eq(triggers.id,decisions.triggerId)).where(eq(decisions.ticketId,t.id));
  if (!event?.e.payload.start_at || !event.e.payload.end_at || !t.localDay || !t.timeZone) return null;
  const permissions = await recallPermissions(c.id, reader);
  const facts: DailyFact[] = (await reader.select().from(diaryFacts).where(and(eq(diaryFacts.catId,c.id),eq(diaryFacts.localDay,t.localDay))).orderBy(asc(diaryFacts.observedAt)).limit(6))
    .map(f=>({id:f.id,sourceId:f.id,kind:'world' as const,text:f.text}));
  if (c.useMemories) {
    const recent = await reader.select().from(messages).where(and(eq(messages.conversationId,v.id),eq(messages.contextAllowed,true),eq(messages.role,'user'),
      gte(messages.createdAt,new Date(event.e.payload.start_at)),lt(messages.createdAt,new Date(event.e.payload.end_at)))).orderBy(desc(messages.seq)).limit(30);
    facts.push(...recent.filter(m=>!permissions.suppressedSources.has(m.id)).slice(0,6).map(m=>({id:m.id,sourceId:m.id,kind:'message' as const,text:m.text.slice(0,80)})));
  }
  const allowed = facts.filter(f=>!overlapsBoundaries(item(f.text),permissions.boundaryTopics));
  // 出口重建相同依赖和许可戳，连同原话、规则、persona、时区和version一起比较。
  const stamp = JSON.stringify({facts:allowed,revision:c.memoryRevision,use:c.useMemories,persona:c.personaVersion,updated:c.updatedAt,version:v.version,
    zone:u.timeZone,topics:permissions.boundaryTopics,suppressed:[...permissions.suppressedSources].sort(),rule});
  return {ticketId:t.id,catId:c.id,day:t.localDay,timeZone:t.timeZone,persona:personaBlock(c).split("\n## 你在院子里怎么过")[0]!,facts:allowed,boundaryTopics:permissions.boundaryTopics,stamp};
}

/** 事实由已审核卡片渲染；自由短记只写感受，显式外部事实启发式不替代来源核验。 */
export function reviewDailyDraft(raw: unknown, input: DailyInput) {
  const draft = draftSchema.parse(raw);
  if (new Set(draft.fact_ids).size !== draft.fact_ids.length || draft.fact_ids.some(id=>!input.facts.some(f=>f.id===id))) throw new Error('diary_unknown_fact');
  // 具体经历只出现在事实卡中；感受段不能偷偷添加来访、地点、天气或已发生动作。
  if (/[A-Za-z\d\r\n]|你|您|我们|咱|主人|他|她|一起|来过|来看|来访|到访|陪|见面|聊|倒水|浇水|喝|吃|走|跑|跳|睡|趴|坐|玩|抓|挠|舔|闻|晒|蹭|摸|抱|池塘|小屋|木屋|草地|窝|栅栏|树|院子|门口|屋顶|雨|晴|雪|风|云|阳光|天气|天空|月亮|星星|周[一二三四五六日天]/u.test(draft.reflection)) throw new Error('diary_reflection_fact');
  const text = draft.fact_ids.map(id=>input.facts.find(f=>f.id===id)!).map(f=>f.kind==='world'?f.text:`这天留着一句话：「${f.text}」`).concat(draft.reflection).join('\n');
  if (text.length > 600) throw new Error('diary_length');
  return text;
}

export async function processDailyDiary(triggerId: string, options: {
  route?: (input: DailyInput) => Promise<unknown>; write?: (input: DailyInput) => Promise<unknown>; beforePublish?: () => Promise<void>;
} = {}): Promise<void | {retryAt:Date}> {
  const [row] = await db.select({t:tickets,e:triggers}).from(decisions).innerJoin(tickets,eq(tickets.id,decisions.ticketId)).innerJoin(triggers,eq(triggers.id,decisions.triggerId)).where(eq(triggers.id,triggerId));
  if (!row || row.t.kind !== 'diary' || row.t.status !== 'open') return;
  for (let attempt=0;attempt<2;attempt++) {
    const input = await dailyDiaryInput(row.t.id);
    if (!input) return {retryAt:new Date(Date.now()+30000)};
    let selected = input;
    try {
      const raw = await (options.route ?? routeDailyDiary)(input);
      const route = z.object({has_events:z.boolean(),fact_ids:z.array(z.string()).max(12)}).strict().parse(raw);
      if (route.has_events !== (input.facts.length>0) || route.fact_ids.some(id=>!input.facts.some(f=>f.id===id))) throw new Error('diary_route');
      selected = {...input,facts:input.facts.filter(f=>route.fact_ids.includes(f.id))};
    } catch { /* Router故障不丢产品规则：仅使用已过硬门的事实。 */ }
    let text: string;
    try { text=reviewDailyDraft(await (options.write ?? writeDailyDiary)(selected),selected); }
    catch { text=reflectionText.quiet; }
    await options.beforePublish?.();
    const result = await publishDailyDiary({input,text,triggerId});
    if (result !== 'stale') return;
  }
  return {retryAt:new Date(Date.now()+30000)};
}

/** 出口也过滤确定性日常文案；极端情况下留白，不为凑字数重提回避话题。 */
export function safeDailyText(text: string, topics: string[]) {
  return [text, ...Object.values(reflectionText), '这一页先轻轻留白。', '…'].find(value=>!overlapsBoundaries(item(value),topics)) ?? '…';
}
