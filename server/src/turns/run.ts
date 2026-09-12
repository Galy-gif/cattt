import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, dbNow } from '../db/client.ts';
import { boundaries, conversations, turns } from '../db/schema.ts';
import { runtimeCalls, runtimeSteps } from '../db/schema-runtime.ts';
import { buildTurnContext } from '../runtime/context.ts';
import { chatSlot, classifyModelError, recordModelCall } from '../runtime/model.ts';
import { getSoul } from '../soul/service.ts';
import { runCatAgent } from '../runtime/agent.ts';
import { catTools } from '../runtime/tools.ts';
import { recoverJobs } from '../jobs/store.ts';
import { cancelRequestedActions } from '../world/service.ts';
import { authorizeFirstToken, claimTurn, commitOutcome } from './store.ts';
import {
  acquireConversationLock, type CancelReason, publish, readCancel, readVisibleLength,
  refreshConversationLock, releaseConversationLock,
} from './events.ts';

const running = new Set<Promise<void>>();
export function startTurn(turnId: string) {
  const p = runTurn(turnId).catch((error) => console.error(`[turn ${turnId}]`, error)).finally(() => running.delete(p));
  running.add(p);
}
export async function drainTurns(timeoutMs: number) {
  if (running.size === 0) return;
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([Promise.allSettled([...running]), new Promise<void>((resolve) => { timer = setTimeout(resolve, timeoutMs); })]);
  clearTimeout(timer);
}

async function runTurn(turnId: string) {
  const [turn] = await db.select().from(turns).where(eq(turns.id, turnId));
  if (!turn || turn.status !== 'queued') return;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, turn.conversationId));
  if (!conv) return;
  const beat = async () => {
    await db.update(turns).set({ heartbeatAt: dbNow() }).where(and(eq(turns.id, turnId), inArray(turns.status, ['queued', 'generating'])));
  };
  const lockToken = randomUUID();
  const abort = new AbortController();
  let cancelReason: CancelReason | null = null;
  let failureCode: string | null = null;
  let heartbeat: NodeJS.Timeout | undefined;
  let cancelPoll: NodeJS.Timeout | undefined;
  let budget: NodeJS.Timeout | undefined;
  let text = '';
  let published = false;
  let acquired = false;
  const stop = (code: string) => { failureCode ??= code; abort.abort(new Error(code)); };
  try {
    await beat();
    acquired = await acquireConversationLock(conv.id, lockToken, 60_000, beat);
    if (!acquired) { await fail(turnId, 'busy', 'waited 60s for conversation lock'); return; }
    if (!await claimTurn(turnId)) return;
    // 同一预算贯穿上下文、所有模型步骤与工具，不在每步重置。
    budget = setTimeout(() => stop('turn_timeout'), 45_000);
    heartbeat = setInterval(() => {
      void (async () => {
        if (!await refreshConversationLock(conv.id, lockToken)) { stop('lock_lost'); return; }
        await beat();
      })().catch(() => stop('lock_lost'));
    }, 5_000);
    cancelPoll = setInterval(() => {
      void readCancel(turnId).then((reason) => {
        if (reason) { cancelReason = reason; abort.abort(new Error(reason)); }
      }).catch(() => stop('cancel_unavailable'));
    }, 200);

    const boundaryStamp = async () => (await db.select({ id: boundaries.id }).from(boundaries).where(eq(boundaries.catId, conv.catId)))
      .map((b) => b.id).sort().join(',');
    const initialBoundaries = await boundaryStamp();
    const revision = async () => JSON.stringify(await db.execute(sql`select c.persona_version, c.updated_at,
      (select max(version) from soul_versions where cat_id = c.id) soul,
      (select count(*) from soul_blocked_sources where cat_id = c.id) blocked,
      (select max(created_at) from memory_blocks where cat_id = c.id) memory_deleted
      from cats c where c.id = ${conv.catId}`));
    let contextRevision: string | undefined;
    const guard = async () => {
      abort.signal.throwIfAborted();
      cancelReason = await readCancel(turnId);
      if (cancelReason) { abort.abort(new Error(cancelReason)); abort.signal.throwIfAborted(); }
      const [current] = await db.select({ status: turns.status, version: conversations.version }).from(turns)
        .innerJoin(conversations, eq(conversations.id, turns.conversationId)).where(eq(turns.id, turnId));
      if (!current || current.status !== 'generating') { stop('stale'); abort.signal.throwIfAborted(); }
      if (!published && current!.version > turn.inputVersion) {
        cancelReason = 'supersede'; abort.abort(new Error('supersede')); abort.signal.throwIfAborted();
      }
      if ((contextRevision !== undefined && await revision() !== contextRevision) || await boundaryStamp() !== initialBoundaries) { stop('context_changed'); abort.signal.throwIfAborted(); }
      if (!await refreshConversationLock(conv.id, lockToken)) { stop('lock_lost'); abort.signal.throwIfAborted(); }
    };
    await guard();
    await getSoul(conv.catId);
    contextRevision = await revision();
    const ctx = await buildTurnContext(conv.catId, conv.id, turnId);
    const slot = chatSlot();
    await db.update(turns).set({ memoryIds: ctx.memoryIds, model: slot.modelId }).where(and(eq(turns.id, turnId), eq(turns.status, 'generating')));
    let pendingNewline = false;
    const tidy = (chunk: string) => {
      let out = '';
      for (const char of chunk) {
        if (char === '\n' || char === '\r') { if (text.length + out.length) pendingNewline = true; continue; }
        if (pendingNewline) { out += '\n'; pendingNewline = false; }
        out += char;
      }
      return out;
    };
    await runCatAgent({
      model: slot.model, providerOptions: slot.providerOptions, instructions: ctx.instructions, messages: ctx.messages,
      tools: await catTools({ catId: conv.catId, turnId, userMessageId: turn.userMessageId }), signal: abort.signal, guard,
      onText: async (chunk) => {
        const visible = tidy(chunk);
        if (!visible) return;
        if (!published) {
          const permission = await authorizeFirstToken(turnId);
          if (permission !== 'allowed') {
            if (permission === 'superseded') cancelReason = 'supersede';
            else failureCode = 'stale';
            abort.abort(new Error(permission)); abort.signal.throwIfAborted();
          }
          published = true;
        }
        await guard();
        await publish(turnId, { event: 'delta', data: { text: visible } });
        text += visible;
      },
      onTool: async (trace) => {
        if (!trace.output) await db.insert(runtimeCalls).values({ turnId, step: trace.step, callId: trace.callId, tool: trace.tool, input: trace.input, status: 'started' });
        else await db.update(runtimeCalls).set({ status: trace.output.status, output: trace.output, finishedAt: dbNow() })
          .where(and(eq(runtimeCalls.turnId, turnId), eq(runtimeCalls.step, trace.step), eq(runtimeCalls.callId, trace.callId)));
      },
      onStep: async (step) => {
        await db.insert(runtimeSteps).values({ turnId, step: step.step, phase: step.phase, finishReason: step.finishReason, durationMs: step.durationMs });
        await recordModelCall({ purpose: 'chat', modelId: slot.modelId, usage: step.usage, latencyMs: step.durationMs, turnId });
      },
    });
    await guard();
    if (!text.length) { await fail(turnId, 'empty_reply', 'model returned no final text'); return; }
    const result = await commitOutcome(turnId, { status: 'completed', text });
    if (result.applied) await safePublish(turnId, { event: 'done', data: { message_id: result.catMessageId, status: 'done' } });
  } catch (error) {
    if (cancelReason) await finishCancelled(turnId, cancelReason, text);
    else {
      const info = classifyModelError(error);
      await fail(turnId, failureCode ?? info.code, info.summary, failureCode !== null || info.retryable).catch((e) => console.error(`[turn ${turnId}] 收尾失败`, e));
    }
  } finally {
    clearInterval(heartbeat); clearInterval(cancelPoll); clearTimeout(budget);
    await cancelRequestedActions(turnId).catch(() => {});
    if (acquired) await releaseConversationLock(conv.id, lockToken).catch(() => {});
    await recoverJobs().catch((error) => console.error(`[turn ${turnId}] 待办稍后补投`, error));
  }
}

async function safePublish(turnId: string, event: Parameters<typeof publish>[1]) {
  // 数据库已经提交：发布失败交给 SSE 终态恢复，绝不把完成改成失败。
  await publish(turnId, event).catch((error) => console.error(`[turn ${turnId}] 终止事件投递失败`, error));
}
async function finishCancelled(turnId: string, reason: CancelReason, text: string) {
  if (reason === 'supersede') {
    const result = await commitOutcome(turnId, { status: 'superseded' });
    if (result.applied) await safePublish(turnId, { event: 'superseded', data: { turn_id: turnId } });
    return;
  }
  const visibleLength = await readVisibleLength(turnId);
  if (visibleLength !== null) text = text.slice(0, visibleLength);
  const result = await commitOutcome(turnId, { status: 'stopped', text });
  if (result.applied) await safePublish(turnId, { event: 'done', data: { message_id: result.catMessageId, status: 'stopped' } });
}
async function fail(turnId: string, code: string, detail: string, retryable = true) {
  const result = await commitOutcome(turnId, { status: 'failed', error: `${code}: ${detail}` });
  if (result.applied) await safePublish(turnId, { event: 'error', data: { code, retryable } });
}
