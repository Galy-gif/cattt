import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { cats, conversations, messages, turns } from '../db/schema.ts';
import { publish, requestCancel } from './events.ts';
import { startTurn } from './run.ts';

export type Owner = { userId: string; catId: string; conversationId: string };

export async function loadOwner(userId: string): Promise<Owner | null> {
  const [row] = await db
    .select({ catId: cats.id, conversationId: conversations.id })
    .from(cats)
    .innerJoin(conversations, eq(conversations.catId, cats.id))
    .where(eq(cats.userId, userId));
  return row ? { userId, ...row } : null;
}

/**
 * 用户发一条消息：同一个事务里存消息、version +1、建一轮回复。
 * client_message_id 重复（发送失败重试）时不新建，返回已有的那一轮。
 */
export async function createSendTurn(
  owner: Owner,
  clientMessageId: string,
  text: string,
): Promise<{ turnId: string; userMessageId: string; created: boolean }> {
  const result = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(messages)
      .values({ conversationId: owner.conversationId, role: 'user', text, clientMessageId })
      .onConflictDoNothing()
      .returning({ id: messages.id });

    if (!inserted) {
      const [existing] = await tx
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.conversationId, owner.conversationId), eq(messages.clientMessageId, clientMessageId)));
      const [turn] = await tx
        .select({ id: turns.id })
        .from(turns)
        .where(eq(turns.userMessageId, existing!.id))
        .orderBy(desc(turns.createdAt))
        .limit(1);
      return { turnId: turn!.id, userMessageId: existing!.id, created: false };
    }

    const [conv] = await tx
      .update(conversations)
      .set({ version: sql`${conversations.version} + 1` })
      .where(eq(conversations.id, owner.conversationId))
      .returning({ version: conversations.version });
    const [turn] = await tx
      .insert(turns)
      .values({ conversationId: owner.conversationId, userMessageId: inserted.id, inputVersion: conv!.version })
      .returning({ id: turns.id });
    return { turnId: turn!.id, userMessageId: inserted.id, created: true };
  });

  if (result.created) await launch(owner, result.turnId, result.userMessageId);
  return result;
}

/** 对已有的用户消息重新回复（超时后「再试一次」）。不新增用户消息，所以 version 不变。 */
export async function createReplyTurn(owner: Owner, userMessageId: string): Promise<{ turnId: string } | null> {
  const turnId = await db.transaction(async (tx) => {
    const [msg] = await tx
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.id, userMessageId),
          eq(messages.conversationId, owner.conversationId),
          eq(messages.role, 'user'),
        ),
      );
    if (!msg) return null;
    const [conv] = await tx
      .select({ version: conversations.version })
      .from(conversations)
      .where(eq(conversations.id, owner.conversationId));
    const [turn] = await tx
      .insert(turns)
      .values({ conversationId: owner.conversationId, userMessageId, inputVersion: conv!.version })
      .returning({ id: turns.id });
    return turn!.id;
  });
  if (!turnId) return null;
  await launch(owner, turnId, userMessageId);
  return { turnId };
}

async function launch(owner: Owner, turnId: string, userMessageId: string) {
  await publish(turnId, { event: 'accepted', data: { turn_id: turnId, user_message_id: userMessageId } });

  // 还没开口的旧回复作废：用户补了一句，新的这一轮会把两句一起回。已经开口的让它说完。
  const pending = await db
    .select({ id: turns.id })
    .from(turns)
    .where(
      and(
        eq(turns.conversationId, owner.conversationId),
        inArray(turns.status, ['queued', 'generating']),
        isNull(turns.firstTokenAt),
        ne(turns.id, turnId),
      ),
    );
  await Promise.all(pending.map((t) => requestCancel(t.id, 'supersede')));

  startTurn(turnId);
}
