import { overlapsBoundaries } from '../agent/gate.ts';
import { and, desc, eq, notExists } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { conversations, memories, memoryBlocks, memoryReceipts, messages } from '../db/schema.ts';
import { rankMemories, selectMemories } from './relevance.ts';
import { expandRecallQuery } from './query.ts';

type RecallOptions = {
  suppressedSources: Set<string>; suppressedMemories: Set<string>; boundaryTopics: string[];
  turnId?: string; signal?: AbortSignal;
};
/** 每轮读当前许可，不建正文缓存/向量副本；回退也走同一过滤。 */
export async function recallMemories(catId: string, query: string, options: RecallOptions) {
  const rows = await db.select({ memory: memories, sourceCreatedAt: messages.createdAt }).from(memories)
    .innerJoin(messages, eq(messages.id, memories.sourceMessageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(memories.catId, catId), eq(conversations.catId, catId), eq(messages.role, 'user'),
      eq(memories.status, 'active'), eq(memories.scope, 'cat'), eq(messages.contextAllowed, true),
      notExists(db.select({ id: memoryBlocks.id }).from(memoryBlocks).where(and(eq(memoryBlocks.catId, catId), eq(memoryBlocks.fingerprint, memories.fingerprint))))))
    .orderBy(desc(memories.revision), desc(memories.lastConfirmedAt));
  const allowed = rows.map(({ memory, sourceCreatedAt }) => ({ ...memory, sourceCreatedAt })).filter(m => (m.explicit || m.confidence >= .6)
    && !options.suppressedSources.has(m.sourceMessageId) && !options.suppressedMemories.has(m.id)
    && !overlapsBoundaries(m, options.boundaryTopics));
  if (!allowed.length) return [];
  const expanded = await expandRecallQuery(query, options.turnId, options.signal);
  options.signal?.throwIfAborted();
  return selectMemories(rankMemories(allowed, query, expanded));
}

/** 聊天和托付共用边界来源/轮次抑制，不只做文字重叠过滤。 */
export async function recallPermissions(catId:string, reader: Tx | typeof db = db) {
 const {boundaries,turns}=await import('../db/schema.ts');
 const {inArray}=await import('drizzle-orm');
 const rows=await reader.select({id:messages.id,turnId:messages.turnId,description:boundaries.description,text:messages.text,allowed:messages.contextAllowed}).from(boundaries).innerJoin(messages,eq(messages.id,boundaries.sourceMessageId)).where(eq(boundaries.catId,catId));
 const turnIds=rows.flatMap(b=>b.turnId?[b.turnId]:[]);
 const suppressed=turnIds.length?await reader.select().from(turns).where(inArray(turns.id,turnIds)):[];
 const boundaryIds = rows.map(b => b.id);
 const fromQuestions = boundaryIds.length ? await reader.select({ id: memories.id }).from(memoryReceipts)
   .innerJoin(memories, and(eq(memories.catId, memoryReceipts.catId), eq(memories.fingerprint, memoryReceipts.fingerprint)))
   .where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.accepted, true), inArray(memoryReceipts.questionId, boundaryIds))) : [];
 return {
   suppressedSources: new Set([...boundaryIds, ...suppressed.map(t => t.userMessageId)]),
   suppressedMemories: new Set([...suppressed.flatMap(t => t.memoryIds), ...fromQuestions.map(m => m.id)]),
   boundaryTopics: rows.filter(b => b.allowed).map(b => b.description ?? b.text),
 };
}
