import type { cats, diaryEntries, messages } from '../db/schema.ts';
import { boundaryOverlaps, type RecallItem } from '../memory/relevance.ts';
type Cat = typeof cats.$inferSelect;
type Message = typeof messages.$inferSelect;
type Diary = typeof diaryEntries.$inferSelect;

/** 确定性硬门：只判断已有事实，不调用模型，也不授予新许可。 */
export function messageAllowed(source: Pick<Message, 'contextAllowed'> | undefined): boolean {
  return !!source?.contextAllowed;
}
export function canLearnFrom(cat: Cat | undefined, source: Message | undefined, conversationId: string | undefined): boolean {
  return !!cat?.learnMemories && !!source && source.conversationId === conversationId && source.role === 'user'
    && messageAllowed(source) && source.memoryEligible && source.seq > cat.learnAfterSeq;
}
export function canUseMemories(cat: Pick<Cat, 'useMemories'>): boolean { return cat.useMemories; }

/** 猫自己的日记可由用户明确带入聊天；自动留言仍只接开放的文字日记。 */
export function diaryAllowed(entry: Diary | undefined, catId: string): entry is Diary {
  return !!entry && entry.catId === catId && (entry.catAllowed || entry.kind === 'cat');
}
export function diaryCommentAllowed(entry: Diary | undefined, version: string): entry is Diary {
  return !!entry?.catAllowed && entry.kind === 'text' && String(entry.revision) === version && entry.visit <= 0;
}
export function overlapsBoundaries(item: RecallItem, topics: string[]): boolean {
  return topics.some(topic => boundaryOverlaps(item, topic));
}

/** 约定只依赖明确来源；模型前与提交前使用同一硬门。 */
export function followupDenial(ticket: {id:string;catId:string;goal:string;sourceMessageId:string|null;mandate:{kind:string;source_message_id?:string};createdAt:Date}, source: Message | undefined, conversationId:string, topics:string[]) {
  if(ticket.mandate.kind!=='explicit' || ticket.mandate.source_message_id!==ticket.sourceMessageId) return '授权不可用';
  if(!source?.contextAllowed || source.role!=='user' || source.conversationId!==conversationId) return '原话已停止使用';
  if(overlapsBoundaries({id:ticket.id,subject:'',predicate:'',value:ticket.goal+' '+source.text,fingerprint:'',explicit:true,sensitivity:'low',lastConfirmedAt:ticket.createdAt,revision:0},topics)) return '不要再提';
  return undefined;
}
