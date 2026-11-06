import { and, desc, eq, notExists } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { conversations, memories, memoryBlocks, messages } from '../db/schema.ts';
import { boundaryOverlaps, rankMemories, selectMemories } from './relevance.ts';
import { expandRecallQuery } from './query.ts';

type RecallOptions = {
  suppressedSources: Set<string>; suppressedMemories: Set<string>; boundaryTopics: string[];
  turnId?: string; signal?: AbortSignal;
};
/** 每轮读当前许可，不建正文缓存/向量副本；回退也走同一过滤。 */
export async function recallMemories(catId: string, query: string, options: RecallOptions) {
  const rows = await db.select({ memory: memories }).from(memories)
    .innerJoin(messages, eq(messages.id, memories.sourceMessageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(memories.catId, catId), eq(conversations.catId, catId), eq(messages.role, 'user'),
      eq(memories.status, 'active'), eq(memories.scope, 'cat'), eq(messages.contextAllowed, true),
      notExists(db.select({ id: memoryBlocks.id }).from(memoryBlocks).where(and(eq(memoryBlocks.catId, catId), eq(memoryBlocks.fingerprint, memories.fingerprint))))))
    .orderBy(desc(memories.revision), desc(memories.lastConfirmedAt));
  const allowed = rows.map(row => row.memory).filter(m => (m.explicit || m.confidence >= .6)
    && !options.suppressedSources.has(m.sourceMessageId) && !options.suppressedMemories.has(m.id)
    && !options.boundaryTopics.some(topic => boundaryOverlaps(m, topic)));
  if (!allowed.length) return [];
  const expanded = await expandRecallQuery(query, options.turnId, options.signal);
  options.signal?.throwIfAborted();
  return selectMemories(rankMemories(allowed, query, expanded));
}
