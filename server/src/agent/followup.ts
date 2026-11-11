import { followupDenial } from './gate.ts';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { db, sql } from '../db/client.ts';
import {
  asyncJobs,
  boundaries,
  cats,
  conversations,
  messages,
  proactiveRules,
  tickets,
  triggers,
  users,
} from '../db/schema.ts';
import { acquireConversationLock, releaseConversationLock } from '../turns/events.ts';
import { localISO, availableAt } from './tickets.ts';
import { publishFollowups } from './publisher.ts';
import { routeFollowup, reviewRoute, followupText } from './router.ts';
type FollowupTicket = typeof tickets.$inferSelect;
import { personaBlock } from '../runtime/persona.ts';
export async function clockNow() {
  const [r] = await sql`select now() as now`;
  return new Date(r!.now);
}
export async function scanFollowups(at?: Date, catId?: string) {
  const now = at ?? (await clockNow());
  const due = await db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.status, 'open'),
        eq(tickets.kind, 'followup'),
        lte(tickets.dueAt, now),
        catId ? eq(tickets.catId, catId) : undefined,
      ),
    )
    .orderBy(asc(tickets.dueAt))
    .limit(500);
  for (const t of due)
    await db.transaction(async (tx) => {
      const key = `clock:${t.id}:${t.dueAt!.toISOString()}`;
      await tx
        .insert(triggers)
        .values({
          catId: t.catId,
          source: 'clock',
          idempotencyKey: key,
          payload: { ticket_id: t.id, due_at: t.dueAt!.toISOString() },
        })
        .onConflictDoNothing();
      const [trigger] = await tx
        .select()
        .from(triggers)
        .where(and(eq(triggers.catId, t.catId), eq(triggers.source, 'clock'), eq(triggers.idempotencyKey, key)));
      await tx
        .insert(asyncJobs)
        .values({ kind: 'followup', sourceId: trigger!.id, objectId: trigger!.id, version: 'v1' })
        .onConflictDoNothing();
    });
}
export async function processFollowup(triggerId: string, options: { now?: Date; route?: () => Promise<unknown> } = {}) {
  const [trigger] = await db.select().from(triggers).where(eq(triggers.id, triggerId));
  if (!trigger || trigger.source !== 'clock' || !trigger.payload.ticket_id || !trigger.payload.due_at) return;
  const [conv] = await db.select().from(conversations).where(eq(conversations.catId, trigger.catId));
  if (!conv) return;
  const token = randomUUID();
  if (!(await acquireConversationLock(conv.id, token, 1000)))
    return { retryAt: new Date(+(options.now ?? new Date()) + 30000) };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const now = options.now ?? (await clockNow());
      const [current] = await db
        .select({ c: cats, u: users, v: conversations })
        .from(cats)
        .innerJoin(users, eq(users.id, cats.userId))
        .innerJoin(conversations, eq(conversations.catId, cats.id))
        .where(eq(cats.id, trigger.catId));
      if (!current) return;
      const [target] = await db.select().from(tickets).where(eq(tickets.id, trigger.payload.ticket_id));
      if (!target || target.status !== 'open' || target.dueAt?.toISOString() !== trigger.payload.due_at) return;
      const time = availableAt(target.dueAt, current.u.timeZone);
      const overdue = +now - +target.dueAt > 86400000;
      if (
        !overdue &&
        (+now < +time ||
          Number(localISO(now, current.u.timeZone).slice(11, 13)) < 9 ||
          Number(localISO(now, current.u.timeZone).slice(11, 13)) >= 22)
      )
        return { retryAt: new Date(+now + 30000) };
      const all: FollowupTicket[] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.catId, trigger.catId),
            eq(tickets.kind, 'followup'),
            eq(tickets.status, 'open'),
            lte(tickets.dueAt, now),
          ),
        )
        .orderBy(asc(tickets.dueAt), asc(tickets.id));
      const batch = all
        .filter((t) => +now - +t.dueAt! > 86400000 === overdue && +availableAt(t.dueAt!, current.u.timeZone) === +time)
        .slice(0, 8);
      if (!batch.length) return;
      const topics = await db
        .select({ topic: boundaries.description, text: messages.text })
        .from(boundaries)
        .innerJoin(messages, eq(messages.id, boundaries.sourceMessageId))
        .where(and(eq(boundaries.catId, trigger.catId), eq(messages.contextAllowed, true)));
      const allowed: FollowupTicket[] = [];
      for (const t of batch) {
        const [source] = t.sourceMessageId
          ? await db.select().from(messages).where(eq(messages.id, t.sourceMessageId))
          : [];
        if (
          !followupDenial(
            t,
            source,
            conv.id,
            topics.map((t) => t.topic ?? t.text),
          )
        )
          allowed.push(t);
      }
      const recent = await db
        .select({ id: messages.id, text: messages.text })
        .from(messages)
        .where(and(eq(messages.conversationId, conv.id), eq(messages.contextAllowed, true)))
        .orderBy(desc(messages.seq))
        .limit(6);
      const rules = await db
        .select()
        .from(proactiveRules)
        .where(and(eq(proactiveRules.ruleId, 'followup_due'), eq(proactiveRules.version, 1)));
      let text = '',
        reason = '固定模板兜底';
      try {
        if (!allowed.length) throw new Error('followup_gate');
        const snapshot = {
          persona: personaBlock(current.c).split('\n## 你在院子里怎么过')[0]!, rules, version: current.v.version,
          tickets: allowed.map(t=>({id:t.id,goal:t.goal.slice(0,60)})), recent: recent.map(m=>({...m,text:m.text.slice(0,120)})),
        };
        text = reviewRoute(await (options.route ? options.route() : routeFollowup(snapshot)), snapshot);
        reason = 'Router措辞复核通过';
      } catch {
        text = followupText(batch);
      }
      if (overdue)
        text = followupText(batch, true);
      const result = await publishFollowups({
        catId: trigger.catId,
        userId: current.u.id,
        conversationId: conv.id,
        version: current.v.version,
        triggerId,
        batch,
        text,
        overdue,
        now: options.now,
        reason,
        lockToken: token,
        timeZone: current.u.timeZone,
      });
      if (result !== 'stale') return;
    }
    return { retryAt: new Date(+(options.now ?? await clockNow()) + 30000) };
  } finally {
    await releaseConversationLock(conv.id, token);
  }
}
