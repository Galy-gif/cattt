import { and, asc, eq, sql } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { cats, conversations, decisions, messages, ticketInputs, tickets, triggers } from '../db/schema.ts';
import { userTimeZone } from '../runtime/time.ts';
export class TicketError extends Error {
  constructor(
    public status: 400 | 404,
    message: string,
  ) {
    super(message);
  }
}
export const ticketView = (t: typeof tickets.$inferSelect) => ({
  id: t.id,
  kind: t.kind,
  goal: t.goal,
  status: t.status,
  stage: t.stage,
  due_at: t.dueAt,
  time_zone: t.timeZone,
  ended_reason: t.endedReason,
});
export function localISO(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
/** 只接具体本地ISO时间或带偏移的ISO。自然语言由聊天结合 get_time 澄清后再调用。 */
export function parseFollowupTime(when: string, timeZone: string): Date {
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(when)) {
    const value = new Date(when);
    if (Number.isFinite(+value)) return value;
  }
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(when)) throw new TicketError(400, '请先说清具体日期和时间');
  const normalized = when.length === 16 ? when + ':00' : when;
  const wall = Date.parse(normalized + 'Z');
  let instant = wall;
  for (let i = 0; i < 4; i++) instant += wall - Date.parse(localISO(new Date(instant), timeZone) + 'Z');
  if (!Number.isFinite(instant) || localISO(new Date(instant), timeZone) !== normalized)
    throw new TicketError(400, '这个本地时间不存在，请换个时间');
  // 夏令时回拨的重复时刻必须由用户给出偏移，不能替用户猜。
  for (const delta of [-3600000, 3600000])
    if (localISO(new Date(instant + delta), timeZone) === normalized)
      throw new TicketError(400, '这个时间有两个时区偏移，请说清具体偏移');
  return new Date(instant);
}
async function lockCat(tx: Tx, catId: string) {
  const [cat] = await tx.select().from(cats).where(eq(cats.id, catId)).for('update');
  if (!cat) throw new TicketError(404, '没有这件约定');
  return cat;
}
export async function listTickets(catId: string, status = 'open') {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.catId, catId), status === 'all' ? undefined : eq(tickets.status, status)))
    .orderBy(asc(tickets.dueAt), asc(tickets.createdAt));
}
export async function scheduleFollowup(catId: string, sourceId: string, when: string, about: string, now = new Date()) {
  const zone = await userTimeZone(catId);
  const due = parseFollowupTime(when, zone);
  if (+due <= +now || !about.trim() || about.length > 60)
    throw new TicketError(400, '请约一个之后的具体时间，主题不超过60字');
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const [source] = await tx
      .select({ m: messages })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          eq(messages.id, sourceId),
          eq(conversations.catId, catId),
          eq(messages.role, 'user'),
          eq(messages.contextAllowed, true),
        ),
      );
    if (!source) throw new TicketError(404, '原话已不可使用');
    const key = `chat:${sourceId}:${due.toISOString()}:${about.trim()}`;
    await tx
      .insert(triggers)
      .values({
        catId,
        source: 'chat',
        idempotencyKey: key,
        payload: { message_id: sourceId, when: due.toISOString(), about: about.trim() },
      })
      .onConflictDoNothing();
    const [event] = await tx
      .select()
      .from(triggers)
      .where(and(eq(triggers.catId, catId), eq(triggers.source, 'chat'), eq(triggers.idempotencyKey, key)));
    const [prior] = await tx
      .select({ t: tickets })
      .from(decisions)
      .innerJoin(tickets, eq(tickets.id, decisions.ticketId))
      .where(eq(decisions.triggerId, event!.id));
    if (prior) return { ticket_id: prior.t.id, when: localISO(prior.t.dueAt!, zone), time_zone: zone };
    const [ticket] = await tx
      .insert(tickets)
      .values({
        catId,
        kind: 'followup',
        goal: about.trim(),
        mandate: { kind: 'explicit', source_message_id: sourceId },
        dueAt: due,
        timeZone: zone,
        sourceMessageId: sourceId,
      })
      .returning();
    await tx
      .insert(decisions)
      .values({ triggerId: event!.id, outcome: 'accept', ticketId: ticket!.id, reasons: ['用户亲口约定'] });
    return { ticket_id: ticket!.id, when: localISO(due, zone), time_zone: zone };
  });
}
export async function updateTicket(catId: string, ticketId: string, when: string, sourceId?: string, now = new Date()) {
  const zone = await userTimeZone(catId);
  const due = parseFollowupTime(when, zone);
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const [ticket] = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.catId, catId), eq(tickets.status, 'open')))
      .for('update');
    if (!ticket || ticket.kind !== 'followup') throw new TicketError(404, '没有这件约定');
    if (+due <= +now) throw new TicketError(400, '请选之后的时间');
    if (sourceId) {
      const [input] = await tx
        .select({ m: messages })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(
          and(
            eq(messages.id, sourceId),
            eq(conversations.catId, catId),
            eq(messages.role, 'user'),
            eq(messages.contextAllowed, true),
          ),
        );
      if (!input) throw new TicketError(404, '原话已不可使用');
      await tx.insert(ticketInputs).values({ ticketId, messageId: sourceId, text: input.m.text, readAt: sql`now()` });
    }
    await tx
      .update(tickets)
      .set({ dueAt: due, timeZone: zone, updatedAt: sql`now()` })
      .where(eq(tickets.id, ticketId));
    return { ticket_id: ticketId, when: localISO(due, zone), time_zone: zone };
  });
}
export async function cancelTicket(catId: string, ticketId: string) {
  return db.transaction(async (tx) => {
    await lockCat(tx, catId);
    const [ticket] = await tx
      .update(tickets)
      .set({ status: 'ended', stage: 'cancelled', endedReason: 'cancelled', updatedAt: sql`now()` })
      .where(and(eq(tickets.id, ticketId), eq(tickets.catId, catId), eq(tickets.status, 'open')))
      .returning();
    if (!ticket) throw new TicketError(404, '没有这件约定');
    return { ticket_id: ticket.id, cancelled: true };
  });
}

export function availableAt(due: Date, zone: string) {
  const local = localISO(due, zone),
    hour = Number(local.slice(11, 13));
  if (hour >= 9 && hour < 22) return due;
  const day = new Date(local.slice(0, 10) + 'T12:00:00Z');
  if (hour >= 22) day.setUTCDate(day.getUTCDate() + 1);
  return parseFollowupTime(day.toISOString().slice(0, 10) + 'T09:00:00', zone);
}
