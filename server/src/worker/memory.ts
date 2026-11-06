import { bumpMemory, lockMemory, removeAspect } from '../memory/control.ts';
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
  clarification: z.string().default(''),
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
用户明确纠正同一方面时必须沿用已有 subject 和 predicate，不要另造近义字段。若无法确定用户在改哪件事，不写候选，clarification 写一句简短的澄清问题。已有记忆只是匹配方面的参考，不能作为新事实来源。

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

  const [anchor] = await db.select().from(messages).where(eq(messages.id, turn.userMessageId));
  if (!anchor) return false;
  const [prevCat] = await db.select({ seq: max(messages.seq) }).from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.role, 'cat'), lt(messages.seq, anchor.seq)));
  const sources = await db.select().from(messages).where(and(eq(messages.conversationId, conv.id), eq(messages.role, 'user'),
    gt(messages.seq, prevCat?.seq ?? 0), lte(messages.seq, anchor.seq))).orderBy(messages.seq);
  let remembered = false;
  for (const source of sources) {
    const result = await extractSource(conv.catId, source.id, turnId, jobId);
    remembered ||= result.remembered;
  }
  return remembered;
}

/** 每条原话单独提取，来源不会误挂在同轮最后一句上。回复前的明确记忆操作也走同一写入门。 */
export async function extractSource(catId: string, sourceId: string, turnId: string, jobId?: string, signal?: AbortSignal) {
  const [cat] = await db.select().from(cats).where(eq(cats.id, catId));
  const [source] = await db.select().from(messages).innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(messages.id, sourceId), eq(conversations.catId, catId)));
  const m = source?.messages;
  if (!cat?.learnMemories || !m || m.role !== 'user' || !m.contextAllowed || !m.memoryEligible || m.seq <= cat.learnAfterSeq)
    return { remembered: false, note: '本次没有保存任何新记忆：继续记新的事情已关闭，或这条原话已停止使用。回复必须明确说明这次没有记下来、不会留作以后使用；即使用户说“记住”，也不能答应。不要用“记下了”“记住了”“改好了”“以后会记得”等成功或未来记忆承诺来表示听见了。仍可回应用户当下的其他问题。' };
  const receipts = await db.select().from(memoryReceipts).where(and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.sourceMessageId, sourceId)));
  if (receipts.length) {
    const saved = (await db.select({ memory: memories }).from(memories).innerJoin(memoryReceipts, and(eq(memoryReceipts.catId, catId), eq(memoryReceipts.fingerprint, memories.fingerprint), eq(memoryReceipts.sourceMessageId, sourceId), eq(memoryReceipts.accepted, true)))
      .where(and(eq(memories.catId, catId), eq(memories.status, 'active')))).map(r => r.memory);
    return { remembered: saved.some(x => x.explicit), note: saved.length ? `已经保存：${saved.map(x => x.value).join('；')}` : '本次没有新增记忆，不要宣称记下了。' };
  }
  const existing = cat.useMemories ? await db.select().from(memories).innerJoin(messages, eq(messages.id, memories.sourceMessageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(eq(memories.catId, catId), eq(conversations.catId, catId), eq(messages.role, 'user'), inArray(memories.status, ['active', 'conflicted']), eq(messages.contextAllowed, true)))
    .orderBy(desc(memories.lastConfirmedAt)).limit(60) : [];
  const existingBlock = existing.map(({ memories: x }) => `- ${x.subject}｜${x.predicate}｜${x.value}`).join('\n') || '（还没有，或已有记忆已停止参考）';
  const slot = extractSlot();
  const started = Date.now();
  const { output, usage } = await generateText({
    model: slot.model, instructions: `${EXTRACT_INSTRUCTIONS}\n今天是${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full' }).format(m.createdAt)}。\n已有记忆：\n${existingBlock}`,
    messages: [{ role: 'user', content: m.text }], output: Output.object({ schema: candidateSchema }),
    providerOptions: slot.providerOptions, maxRetries: 2, abortSignal: signal,
  }).catch(rethrowForQueue);
  await recordModelCall({ purpose: 'memory_extract', modelId: slot.modelId, usage, latencyMs: Date.now() - started, turnId, jobId });
  let remembered = false;
  const saved: string[] = [];
  for (const candidate of output.memories) {
    signal?.throwIfAborted();
    if (await applyCandidate(catId, sourceId, candidate)) {
      saved.push(candidate.value);
      remembered ||= candidate.explicit;
    }
  }
  return { remembered, note: saved.length ? `已成功保存到长期记忆：${saved.join('；')}` : output.clarification || '本次没有保存记忆，不能说已经记住或改好。' };
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
    const cat = await lockMemory(tx, catId);
    const [source] = await tx.select().from(messages).where(eq(messages.id, sourceMessageId));
    const [conv] = await tx.select().from(conversations).where(eq(conversations.catId, catId));
    if (!source || source.conversationId !== conv?.id || source.role !== 'user' || !source.contextAllowed || !source.memoryEligible || !cat.learnMemories || source.seq <= cat.learnAfterSeq) return false;
    const edited = await tx.select().from(memories).where(and(eq(memories.catId, catId), eq(memories.fingerprint, fingerprint)));
    if (edited.some(m => m.editedThroughSeq >= source.seq)) return false;
    const [receipt] = await tx.select().from(memoryReceipts).where(and(eq(memoryReceipts.sourceMessageId, sourceMessageId), eq(memoryReceipts.fingerprint, fingerprint)));
    if (receipt) return receipt.accepted;
    const [prior] = await tx.select().from(memories).where(and(eq(memories.sourceMessageId, sourceMessageId), eq(memories.fingerprint, fingerprint)));
    if (prior) return prior.status === 'active';
    const finish = async (accepted: boolean) => {
      await tx.insert(memoryReceipts).values({ catId, sourceMessageId, fingerprint, accepted }).onConflictDoNothing();
      if (accepted) await bumpMemory(tx, catId);
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
  return db.transaction(async tx => {
    await lockMemory(tx, catId);
    const [memory] = await tx.select().from(memories).where(and(eq(memories.id, memoryId), eq(memories.catId, catId)));
    if (!memory) return false;
    await removeAspect(tx, catId, memory.fingerprint);
    await bumpMemory(tx, catId);
    return true;
  });
}
