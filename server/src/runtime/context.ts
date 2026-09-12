import type { ModelMessage } from 'ai';
import { and, desc, eq, ne } from 'drizzle-orm';
import { CONTEXT_MESSAGES, RECALL_EXPLICIT, RECALL_RECENT } from '../config.ts';
import { db } from '../db/client.ts';
import { boundaries, cats, memories, messages } from '../db/schema.ts';
import { personaBlock } from './persona.ts';
import { snapshotSoul } from '../soul/service.ts';
import { compileRuntime, compileSoul } from '../soul/rules.ts';

/** 开发者版先按北京时间；以后按用户时区 */
const TIME_ZONE = 'Asia/Shanghai';

export type TurnContext = {
  instructions: string;
  messages: ModelMessage[];
  memoryIds: string[];
};

/**
 * 组装一轮回复的上下文，顺序是：性格（不变）→ 边界 → 记忆 → 当前时间。
 * 越靠前越稳定，前缀缓存命中越多。
 */
export async function buildTurnContext(catId: string, conversationId: string, turnId?: string): Promise<TurnContext> {
  const snapshot = await snapshotSoul(catId, turnId);
  const cat = snapshot.cat;

  const [boundaryRows, recalled, history] = await Promise.all([
    db
      .select({ description: boundaries.description, text: messages.text })
      .from(boundaries)
      .innerJoin(messages, eq(messages.id, boundaries.sourceMessageId))
      .where(eq(boundaries.catId, catId))
      .orderBy(boundaries.createdAt),
    recallMemories(catId),
    db
      .select({ role: messages.role, text: messages.text })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.seq))
      .limit(CONTEXT_MESSAGES),
  ]);

  const parts = [personaBlock(cat), compileSoul(snapshot.soul.entries), compileRuntime(snapshot.runtime.state)].filter(Boolean);
  parts.push('当前用户需要和最新明确边界优先于性格、习惯与临时状态；熟悉不自动授予许可。');

  if (boundaryRows.length > 0) {
    const lines = boundaryRows.map((b) => `- ${b.description ?? clip(b.text, 60)}`);
    parts.push(`## 对方不想再聊的，不要主动提起\n${lines.join('\n')}`);
  }

  if (recalled.length > 0) {
    const lines = recalled.map((m) => `- ${m.subject}的${m.predicate}：${m.value}${m.explicit ? '（对方让你记住的）' : ''}`);
    parts.push(`## 你记得的事\n${lines.join('\n')}`);
  }

  parts.push(`## 现在\n${formatNow()}`);

  const modelMessages: ModelMessage[] = history
    .reverse()
    .filter((m) => m.text.length > 0)
    .map((m) => (m.role === 'user' ? { role: 'user', content: m.text } : { role: 'assistant', content: m.text }));

  return {
    instructions: parts.join('\n\n'),
    messages: modelMessages,
    memoryIds: recalled.map((m) => m.id),
  };
}

/**
 * 开发者版不接语义召回，按文档的降级方式：用户明确要记的 + 最近的有效记忆。
 * 有冲突的不注入；高敏感的只在用户明确要求记时才注入。
 */
async function recallMemories(catId: string) {
  const base = and(eq(memories.catId, catId), eq(memories.status, 'active'));
  const explicit = await db
    .select()
    .from(memories)
    .where(and(base, eq(memories.explicit, true)))
    .orderBy(desc(memories.lastConfirmedAt))
    .limit(RECALL_EXPLICIT);
  const recent = await db
    .select()
    .from(memories)
    .where(and(base, eq(memories.explicit, false), ne(memories.sensitivity, 'high')))
    .orderBy(desc(memories.lastConfirmedAt))
    .limit(RECALL_RECENT);
  return [...explicit, ...recent];
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function formatNow() {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
