import { rethrowForQueue } from './model-error.ts';
import { generateText, Output } from 'ai';
import { and, desc, eq, gt, inArray, lt, lte, max } from 'drizzle-orm';
import { z } from 'zod';
import { db, dbNow } from '../db/client.ts';
import { cats, conversations, memories, memoryBlocks, memoryReceipts, messages, turns } from '../db/schema.ts';
import { EXTRACTOR_VERSION } from '../queue.ts';
import { memoryFingerprint, normalize } from '../runtime/fingerprint.ts';
import { extractSlot, recordModelCall } from '../runtime/model.ts';

// 次要字段缺了给默认值，免得模型漏一个字段整次提取作废；
// 敏感度不给默认值，缺了宁可这次不记
const candidateSchema = z.object({
  memories: z.array(
    z.object({
      subject: z.string(),
      predicate: z.string(),
      value: z.string(),
      kind: z.enum(['preference', 'plan', 'fact', 'other']).default('other'),
      confidence: z.number().min(0).max(1),
      sensitivity: z.enum(['low', 'medium', 'high']),
      explicit: z.boolean().default(false),
      correction: z.boolean().default(false),
    }),
  ),
});

type Candidate = z.infer<typeof candidateSchema>['memories'][number];

// DeepSeek 的 JSON 模式要求提示词里出现 "json" 字样，并且要写清楚格式
const EXTRACT_INSTRUCTIONS = `你负责从一段对话里挑出以后还值得记住的、关于用户的信息，只输出 json。

可以记：稳定的偏好、持续的目标、明确的人际关系、重要的未来安排、反复出现且一致的信息，以及用户明确说"记住"的内容。
不要记：一次性的闲聊、一时的情绪、对用户心理的推测、没核实的第三方隐私。
只看用户自己说的话；猫说的话不算事实来源。

每条记忆的字段：
- subject：关于谁。用户本人写「用户」；用户提到的具体的人或宠物写称呼，如「用户的妈妈」。
- predicate：哪一方面，简短的名词短语，如「喜欢的饮料」「过敏」「工作」「考试时间」。和已有记忆是同一方面时，照抄已有的 subject 和 predicate。
- value：具体内容，按用户的原意，不添油加醋。涉及时间的换算成具体日期。
- kind：preference（偏好）/ plan（安排）/ fact（事实）/ other。
- confidence：0 到 1，这确实是用户真实情况的把握。
- sensitivity：low / medium / high。健康、性、宗教、政治、财务、证件号、精确住址写 high。
- explicit：用户是否明确要求记住。
- correction：用户是否在纠正之前的说法。

输出格式：{"memories": [ ... ]}。没有值得记的就输出 {"memories": []}。`;

/** 低于这个把握的、不是用户明确要求记的，不写 */
const MIN_CONFIDENCE = 0.6;

export async function extractMemories(turnId: string, jobId: string) {
  const [turn] = await db.select().from(turns).where(eq(turns.id, turnId));
  if (!turn) return false;
  if (turn.extractedAt) return turn.remembered;
  // 作废和失败的轮次不提取：用户的话会跟着下一轮一起提
  if (turn.status !== 'completed' && turn.status !== 'stopped') return;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, turn.conversationId));
  if (!conv) return;

  // 这一轮对应的用户消息：上一条猫消息之后、到这一轮的用户消息为止（连着发的几句一起算）
  const [anchor] = await db.select().from(messages).where(eq(messages.id, turn.userMessageId));
  if (!anchor) return;
  const [prevCat] = await db
    .select({ seq: max(messages.seq) })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.role, 'cat'), lt(messages.seq, anchor.seq)));
  const userMessages = await db
    .select({ text: messages.text, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conv.id),
        eq(messages.role, 'user'),
        gt(messages.seq, prevCat?.seq ?? 0),
        lte(messages.seq, anchor.seq),
      ),
    )
    .orderBy(messages.seq);
  const catReply = turn.catMessageId
    ? (await db.select({ text: messages.text }).from(messages).where(eq(messages.id, turn.catMessageId)))[0]?.text
    : undefined;

  const existing = await db
    .select({ subject: memories.subject, predicate: memories.predicate, value: memories.value })
    .from(memories)
    .where(and(eq(memories.catId, conv.catId), inArray(memories.status, ['active', 'conflicted'])))
    .orderBy(desc(memories.lastConfirmedAt))
    .limit(60);

  const today = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full' }).format(anchor.createdAt);
  const existingBlock =
    existing.length > 0 ? existing.map((m) => `- ${m.subject}｜${m.predicate}｜${m.value}`).join('\n') : '（还没有）';
  const dialogue = [...userMessages.map((m) => `用户（${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "full" }).format(m.createdAt)}）：${m.text}`), ...(catReply ? [`猫：${catReply}`] : [])].join('\n');

  const slot = extractSlot();
  const started = Date.now();
  const { output, usage } = await generateText({
    model: slot.model,
    instructions: `${EXTRACT_INSTRUCTIONS}\n\n今天是${today}。\n\n已有记忆：\n${existingBlock}`,
    messages: [{ role: 'user', content: dialogue }],
    output: Output.object({ schema: candidateSchema }),
    providerOptions: slot.providerOptions,
    maxRetries: 2,
  }).catch(rethrowForQueue);
  await recordModelCall({ purpose: 'memory_extract', modelId: slot.modelId, usage, latencyMs: Date.now() - started, turnId, jobId });

  let remembered = false;
  for (const candidate of output.memories) {
    const applied = await applyCandidate(conv.catId, turn.userMessageId, candidate);
    if (applied && candidate.explicit) remembered = true;
  }
  return remembered;
}

/**
 * 按文档的规则写入一条候选：
 * - 高敏感、把握不够的，除非用户明确要求记，否则不写
 * - 删过的（命中阻断）不写；用户明确说「记住」时解除阻断
 * - 同一方面已有同样的内容：只刷新确认时间
 * - 同一方面内容不同：用户明确要求、纠正、或者是偏好和安排（会随时间变），新的生效、旧的留作历史；
 *   其余（事实类）两条都标成冲突，不注入对话，等以后澄清
 *
 * 返回这条是否被采纳（新写入或确认了已有的）。
 */
export async function applyCandidate(catId: string, sourceMessageId: string, c: Candidate): Promise<boolean> {
  if (!c.explicit && (c.sensitivity === 'high' || c.confidence < MIN_CONFIDENCE)) return false;
  const fingerprint = memoryFingerprint(c.subject, c.predicate);

  return db.transaction(async (tx) => {
    await tx.select({ id: cats.id }).from(cats).where(eq(cats.id, catId)).for('update');
    const [source] = await tx.select().from(messages).where(eq(messages.id, sourceMessageId));
    if (!source) return false;
    const [receipt] = await tx.select().from(memoryReceipts).where(and(eq(memoryReceipts.sourceMessageId, sourceMessageId), eq(memoryReceipts.fingerprint, fingerprint)));
    if (receipt) return receipt.accepted;
    const [prior] = await tx.select().from(memories).where(and(eq(memories.sourceMessageId, sourceMessageId), eq(memories.fingerprint, fingerprint)));
    if (prior) return prior.status === 'active';
    const finish = async (accepted: boolean) => {
      await tx.insert(memoryReceipts).values({ catId, sourceMessageId, fingerprint, accepted }).onConflictDoNothing();
      return accepted;
    };
    const [blocked] = await tx
      .select()
      .from(memoryBlocks)
      .where(and(eq(memoryBlocks.catId, catId), eq(memoryBlocks.fingerprint, fingerprint)));
    if (blocked) {
      if (!c.explicit || source.seq <= blocked.sourceSeq) return finish(false);
      await tx.delete(memoryBlocks).where(eq(memoryBlocks.id, blocked.id));
    }

    const current = await tx
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.catId, catId),
          eq(memories.fingerprint, fingerprint),
          inArray(memories.status, ['active', 'conflicted']),
        ),
      );

    const sourceIds = current.map((m) => m.sourceMessageId);
    const latestSources = sourceIds.length ? await tx.select({ seq: messages.seq }).from(messages).where(inArray(messages.id, sourceIds)) : [];
    const confirmations = await tx.select({ seq: messages.seq }).from(memoryReceipts)
      .innerJoin(messages, eq(messages.id, memoryReceipts.sourceMessageId))
      .where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, fingerprint), eq(memoryReceipts.accepted, true)));
    if ([...latestSources, ...confirmations].some((m) => m.seq > source.seq)) return finish(false);
    const same = current.find((m) => normalize(m.value) === normalize(c.value));
    if (same) {
      await tx
        .update(memories)
        .set({ lastConfirmedAt: dbNow(), explicit: same.explicit || c.explicit })
        .where(eq(memories.id, same.id));
      return finish(true);
    }

    let status: 'active' | 'conflicted' = 'active';
    if (current.length > 0) {
      const replaces = c.explicit || c.correction || c.kind === 'preference' || c.kind === 'plan';
      const ids = current.map((m) => m.id);
      if (replaces) {
        await tx.update(memories).set({ status: 'superseded' }).where(inArray(memories.id, ids));
      } else {
        await tx.update(memories).set({ status: 'conflicted' }).where(inArray(memories.id, ids));
        status = 'conflicted';
      }
    }

    await tx
      .insert(memories)
      .values({
        catId,
        subject: c.subject,
        predicate: c.predicate,
        value: c.value,
        confidence: c.confidence,
        sensitivity: c.sensitivity,
        status,
        explicit: c.explicit,
        fingerprint,
        sourceMessageId,
        extractorVersion: EXTRACTOR_VERSION,
      })
      .onConflictDoNothing();
    return finish(true);
  });
}

export async function deleteMemory(catId: string, memoryId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.select({ id: cats.id }).from(cats).where(eq(cats.id, catId)).for('update');
    const [memory] = await tx.select().from(memories).where(and(eq(memories.id, memoryId), eq(memories.catId, catId)));
    if (!memory) return false;
    const sources = await tx.select({ id: memories.sourceMessageId }).from(memories).where(and(eq(memories.catId, catId), eq(memories.fingerprint, memory.fingerprint)));
    const { invalidateSoulSources } = await import('../soul/service.ts');
    const confirmations = await tx.select({ id: memoryReceipts.sourceMessageId }).from(memoryReceipts)
      .where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, memory.fingerprint)));
    await invalidateSoulSources(tx, catId, [...new Set([...sources, ...confirmations].map((s) => s.id))]);
    const [latest] = await tx.select({ seq: max(messages.seq) }).from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId)).where(eq(conversations.catId, catId));
    await tx.insert(memoryBlocks).values({ catId, fingerprint: memory.fingerprint, sourceSeq: latest?.seq ?? 0 })
      .onConflictDoUpdate({ target: [memoryBlocks.catId, memoryBlocks.fingerprint], set: { sourceSeq: latest?.seq ?? 0, createdAt: dbNow() } });
    await tx.delete(memories).where(and(eq(memories.catId, catId), eq(memories.fingerprint, memory.fingerprint)));
    await tx.update(memoryReceipts).set({ accepted: false }).where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, memory.fingerprint)));
    return true;
  });
}
