import { randomUUID } from 'node:crypto';
import { streamText } from 'ai';
import { and, eq } from 'drizzle-orm';
import { db, dbNow } from '../db/client.ts';
import { conversations, messages, turns } from '../db/schema.ts';
import { enqueueMemoryExtract } from '../queue.ts';
import { buildTurnContext } from '../runtime/context.ts';
import { chatSlot, classifyModelError, recordModelCall } from '../runtime/model.ts';
import {
  acquireConversationLock,
  type CancelReason,
  publish,
  readCancel,
  readVisibleLength,
  refreshConversationLock,
  releaseConversationLock,
} from './events.ts';

/**
 * 生成和 HTTP 连接无关：客户端断了，这里照样跑完、照样落库。
 * HTTP 那边只是跟着读 Redis Stream。
 */
const running = new Set<Promise<void>>();

export function startTurn(turnId: string) {
  const p: Promise<void> = runTurn(turnId)
    .catch((err) => console.error(`[turn ${turnId}]`, err))
    .finally(() => running.delete(p));
  running.add(p);
}

/** 进程退出前等进行中的回复跑完 */
export async function drainTurns(timeoutMs: number) {
  if (running.size === 0) return;
  console.log(`[turn] 等 ${running.size} 条进行中的回复跑完…`);
  await Promise.race([Promise.allSettled([...running]), new Promise((r) => setTimeout(r, timeoutMs))]);
}

async function runTurn(turnId: string) {
  const [turn] = await db.select().from(turns).where(eq(turns.id, turnId));
  if (!turn || turn.status !== 'queued') return;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, turn.conversationId));
  if (!conv) return;

  const beat = async () => {
    await db.update(turns).set({ heartbeatAt: dbNow() }).where(eq(turns.id, turnId));
  };
  await beat();

  // 同一段对话同一时间只生成一轮，后来的等前面的说完，上下文里才有前面那句
  const lockToken = randomUUID();
  if (!(await acquireConversationLock(conv.id, lockToken, 60_000, beat))) {
    await fail(turnId, 'busy', 'waited 60s for conversation lock');
    return;
  }

  const abort = new AbortController();
  let cancelReason: CancelReason | null = null;
  let heartbeat: NodeJS.Timeout | undefined;
  let cancelPoll: NodeJS.Timeout | undefined;

  try {
    // 等锁期间可能已经被清理任务判了失败
    const claimed = await db
      .update(turns)
      .set({ status: 'generating', startedAt: dbNow(), heartbeatAt: dbNow() })
      .where(and(eq(turns.id, turnId), eq(turns.status, 'queued')))
      .returning({ id: turns.id });
    if (claimed.length === 0) return;

    cancelReason = await readCancel(turnId);
    if (cancelReason) {
      await finishCancelled(turnId, turn.userMessageId, conv.id, cancelReason, '');
      return;
    }

    heartbeat = setInterval(() => {
      beat().catch(() => {});
      refreshConversationLock(conv.id, lockToken).catch(() => {});
    }, 5_000);
    cancelPoll = setInterval(() => {
      readCancel(turnId)
        .then((reason) => {
          if (reason && !cancelReason) {
            cancelReason = reason;
            abort.abort();
          }
        })
        .catch(() => {});
    }, 200);

    const ctx = await buildTurnContext(conv.catId, conv.id);
    const slot = chatSlot();
    await db.update(turns).set({ memoryIds: ctx.memoryIds, model: slot.modelId }).where(eq(turns.id, turnId));

    const started = Date.now();
    let streamError: unknown = null;
    const result = streamText({
      model: slot.model,
      instructions: ctx.instructions,
      messages: ctx.messages,
      providerOptions: slot.providerOptions,
      abortSignal: abort.signal,
      maxRetries: 1,
      onError: ({ error }) => {
        streamError ??= error;
      },
    });

    let text = '';
    let published = false;
    // 模型爱在句子之间空一行，气泡里就是一大块空白。连续换行压成一个；
    // 换行先扣着，等后面还有字才发出去，这样开头和结尾也不会多出空行。
    let pendingNewline = false;
    const tidy = (chunk: string) => {
      let out = '';
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r') {
          if (text.length + out.length > 0) pendingNewline = true;
          continue;
        }
        if (pendingNewline) {
          out += '\n';
          pendingNewline = false;
        }
        out += ch;
      }
      return out;
    };
    try {
      for await (const part of result.stream) {
        if (part.type === 'text-delta') {
          const visible = tidy(part.text);
          if (!visible) continue;
          if (!published) {
            // 新鲜度复核：第一段可见内容发出去之前，用户又说了话就作废这一轮
            const [latest] = await db
              .select({ version: conversations.version })
              .from(conversations)
              .where(eq(conversations.id, conv.id));
            if (latest!.version > turn.inputVersion) {
              cancelReason = 'supersede';
              abort.abort();
              break;
            }
            published = true;
            await db.update(turns).set({ firstTokenAt: dbNow() }).where(eq(turns.id, turnId));
          }
          text += visible;
          await publish(turnId, { event: 'delta', data: { text: visible } });
        } else if (part.type === 'error') {
          streamError ??= part.error;
          break;
        }
      }
    } catch (err) {
      if (!cancelReason) streamError ??= err;
    }

    const usage = await Promise.race([
      Promise.resolve(result.totalUsage).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 2_000)),
    ]);
    await recordModelCall({ purpose: 'chat', modelId: slot.modelId, usage, latencyMs: Date.now() - started, turnId });

    if (cancelReason) {
      await finishCancelled(turnId, turn.userMessageId, conv.id, cancelReason, text);
      return;
    }
    if (streamError) {
      const info = classifyModelError(streamError);
      console.error(`[turn ${turnId}] 模型出错 ${info.code}：${info.summary}`);
      await fail(turnId, info.code, info.summary, info.retryable);
      return;
    }
    if (text.length === 0) {
      await fail(turnId, 'empty_reply', 'model returned no text');
      return;
    }

    const catMessageId = await db.transaction(async (tx) => {
      const [msg] = await tx
        .insert(messages)
        .values({ conversationId: conv.id, role: 'cat', text, turnId })
        .returning({ id: messages.id });
      await tx
        .update(turns)
        .set({ status: 'completed', catMessageId: msg!.id, finishedAt: dbNow() })
        .where(eq(turns.id, turnId));
      return msg!.id;
    });
    await publish(turnId, { event: 'done', data: { message_id: catMessageId, status: 'done' } });
    await enqueueMemoryExtract(turnId, turn.userMessageId).catch((err) =>
      console.error(`[turn ${turnId}] enqueue extract failed`, err),
    );
  } catch (err) {
    console.error(`[turn ${turnId}]`, err);
    await fail(turnId, 'internal_error', String(err)).catch(() => {});
  } finally {
    clearInterval(heartbeat);
    clearInterval(cancelPoll);
    await releaseConversationLock(conv.id, lockToken).catch(() => {});
  }
}

async function finishCancelled(
  turnId: string,
  userMessageId: string,
  conversationId: string,
  reason: CancelReason,
  text: string,
) {
  if (reason === 'supersede') {
    await db.update(turns).set({ status: 'superseded', finishedAt: dbNow() }).where(eq(turns.id, turnId));
    await publish(turnId, { event: 'superseded', data: { turn_id: turnId } });
    return;
  }

  // 停止：保留已经说出来的字。从按下停止到这边真停住，模型还会多吐几十个字，
  // 客户端带来了屏幕上显示了多少，就只存这么多，存下的和用户看到的一致。
  const visibleLength = await readVisibleLength(turnId);
  if (visibleLength !== null && visibleLength < text.length) text = text.slice(0, visibleLength);
  const catMessageId = await db.transaction(async (tx) => {
    let id: string | null = null;
    if (text.length > 0) {
      const [msg] = await tx
        .insert(messages)
        .values({ conversationId, role: 'cat', text, status: 'stopped', turnId })
        .returning({ id: messages.id });
      id = msg!.id;
    }
    await tx
      .update(turns)
      .set({ status: 'stopped', catMessageId: id, finishedAt: dbNow() })
      .where(eq(turns.id, turnId));
    return id;
  });
  await publish(turnId, { event: 'done', data: { message_id: catMessageId, status: 'stopped' } });
  // 回复停了，用户那句话还是要看有没有要记的
  await enqueueMemoryExtract(turnId, userMessageId).catch(() => {});
}

async function fail(turnId: string, code: string, detail: string, retryable = true) {
  await db
    .update(turns)
    .set({ status: 'failed', error: `${code}: ${detail}`.slice(0, 2000), finishedAt: dbNow() })
    .where(eq(turns.id, turnId));
  await publish(turnId, { event: 'error', data: { code, retryable } });
}
