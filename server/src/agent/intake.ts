import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { cats, conversations, decisions, messages, tickets, triggers } from '../db/schema.ts';
import { TicketError } from './errors.ts';

export type CommandOrigin = { source: 'chat'; messageId: string } | { source: 'app'; requestId?: string };
export type CommandKind = 'schedule' | 'start' | 'reschedule' | 'append' | 'cancel';
type Receipt = Record<string, string | boolean>;
type Command = {
  kind: CommandKind;
  input: Record<string, string>;
  // 创建操作延续已有事件身份，旧事件不回写、不重新执行。
  legacyKey?: string;
  payload?: Pick<typeof triggers.$inferInsert.payload, 'message_id' | 'when' | 'about' | 'ticket_id'>;
};
type Accepted<T> = { receipt: T; ticketId: string; outcome: 'accept' | 'attach'; reasons: string[] };

export const commandOrigin = (messageId?: string, requestId?: string): CommandOrigin =>
  messageId ? { source: 'chat', messageId } : { source: 'app', requestId };

/** 宿主绑定身份；同一只猫的准入、业务变更、事件与收据在同一事务中提交。 */
export async function receiveCommand<T extends Receipt>(
  catId: string,
  origin: CommandOrigin,
  command: Command,
  execute: (tx: Tx, source: typeof messages.$inferSelect | undefined) => Promise<Accepted<T>>,
  replayLegacy?: (ticket: typeof tickets.$inferSelect) => T,
): Promise<T> {
  if (origin.source === 'app' && origin.requestId !== undefined && !/^[\x21-\x7e]{1,128}$/.test(origin.requestId))
    throw new TicketError(400, '请求标识须为1至128个可见ASCII字符');

  return db.transaction(async tx => {
    const [cat] = await tx.select().from(cats).where(eq(cats.id, catId)).for('update');
    if (!cat) throw new TicketError(404, '没有这件事');
    let source: typeof messages.$inferSelect | undefined;
    if (origin.source === 'chat') {
      const [row] = await tx.select({ message: messages }).from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .where(and(eq(messages.id, origin.messageId), eq(conversations.catId, catId),
          eq(messages.role, 'user'), eq(messages.contextAllowed, true)));
      if (!row) throw new TicketError(404, '原话已不可使用');
      source = row.message;
    }

    // 补充的事实取原话；模型换一种概括，不会把同一条补充变成另一条操作。
    const input = command.kind === 'append' && source ? { ...command.input, text: source.text } : command.input;
    const fingerprint = createHash('sha256').update(JSON.stringify([
      command.kind, Object.entries(input).sort(([a], [b]) => a.localeCompare(b)),
    ])).digest('hex');
    const key = command.legacyKey ?? (origin.source === 'chat'
      ? `command:v1:${origin.messageId}:${fingerprint}`
      : `command:v1:${origin.requestId ?? randomUUID()}`);
    const [prior] = await tx.select().from(triggers).where(and(
      eq(triggers.catId, catId), eq(triggers.source, origin.source), eq(triggers.idempotencyKey, key),
    ));
    if (prior) {
      if (prior.payload.command) {
        if (prior.payload.command.fingerprint !== fingerprint) throw new TicketError(409, '同一请求标识不能用于不同操作');
        if (prior.payload.receipt) return prior.payload.receipt as T;
      } else if (replayLegacy) {
        const [accepted] = await tx.select({ ticket: tickets }).from(decisions)
          .innerJoin(tickets, eq(tickets.id, decisions.ticketId))
          .where(and(eq(decisions.triggerId, prior.id), eq(decisions.outcome, 'accept'), eq(tickets.catId, catId)));
        if (accepted) return replayLegacy(accepted.ticket);
      }
      throw new TicketError(409, '这条操作没有完整收据，请重新确认事项状态');
    }

    const result = await execute(tx, source);
    const [event] = await tx.insert(triggers).values({
      catId, source: origin.source, idempotencyKey: key,
      payload: { ...command.payload, message_id: source?.id, ticket_id: result.ticketId,
        command: { kind: command.kind, fingerprint }, receipt: result.receipt },
    }).returning();
    await tx.insert(decisions).values({ triggerId: event!.id, outcome: result.outcome,
      ticketId: result.ticketId, reasons: result.reasons });
    return result.receipt;
  });
}
