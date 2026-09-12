import { z } from 'zod';
import type { Traits } from '../db/schema.ts';

export type Personality = { name: string; appearance: string; temperament: string; traits: Traits };
export const adjustmentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('response_length'), value: z.enum(['brief', 'balanced']) }),
  z.object({ kind: z.literal('advice'), value: z.enum(['only_when_asked', 'ask_first']) }),
  z.object({ kind: z.literal('cat_expression'), value: z.enum(['subtle', 'natural']) }),
]);
export type Adjustment = z.infer<typeof adjustmentSchema>;
export type SoulEntry = Adjustment & {
  id: string; sourceMessageId: string; status: 'active' | 'superseded' | 'withdrawn';
  createdAt: string; reason: string;
};
export type RuntimeState = {
  energy: 'baseline' | 'resting' | 'awake';
  willingness: 'baseline' | 'quiet' | 'open';
  sourceMessageId: string | null;
  observedAt: string;
  expiresAt: string | null;
};
export const runtimeInputSchema = z.object({
  sourceMessageId: z.uuid(),
  energy: z.enum(['baseline', 'resting', 'awake']),
  willingness: z.enum(['baseline', 'quiet', 'open']),
  // 调用者明确给有效期，工程上限一天；不宣称这是情绪科学模型。
  durationMinutes: z.number().int().min(1).max(1440),
});
export const soulAdjustmentBody = z.object({
  sourceMessageId: z.uuid(), adjustment: adjustmentSchema,
  reason: z.string().trim().min(1).max(200),
});
export function baseline(now: Date): RuntimeState {
  return { energy: 'baseline', willingness: 'baseline', sourceMessageId: null, observedAt: now.toISOString(), expiresAt: null };
}
export function recoverState(state: RuntimeState, now: Date): RuntimeState {
  return state.expiresAt && Date.parse(state.expiresAt) <= now.getTime() ? baseline(now) : state;
}
export function evolveEntries(entries: SoulEntry[], entry: SoulEntry): SoulEntry[] {
  // 一条来源对同一维度只能形成一次调整，重试不能覆盖后来发生的修订。
  if (entries.some(e => e.sourceMessageId === entry.sourceMessageId && e.kind === entry.kind)) return entries;
  return [...entries.map(e => e.kind === entry.kind && e.status === 'active' ? { ...e, status: 'superseded' as const } : e), entry];
}
const descriptions: Record<string, string> = {
  'response_length:brief': '通常简短回应，认真问题仍说清楚。',
  'response_length:balanced': '按话题需要自然展开，不为凑长度多说。',
  'advice:only_when_asked': '对方明确征求建议时再给建议。',
  'advice:ask_first': '需要建议时先轻声问对方是否愿意听。',
  'cat_expression:subtle': '猫咪语气与小动作更克制，少量自然流露。',
  'cat_expression:natural': '自然使用少量“喵”和猫咪细节，不每句重复。',
};
export function entryBehavior(entry: Adjustment): string {
  return descriptions[`${entry.kind}:${entry.value}`]!;
}
export function compileSoul(entries: SoulEntry[]): string {
  const lines = entries.filter(e => e.status === 'active').map(e => `- ${entryBehavior(e)}`);
  return lines.length ? `## 经对方明确调整形成的表达习惯\n${lines.join('\n')}\n这些习惯不覆盖当前需要、明确边界和基础身份。` : '';
}
export function soulMarkdown(name: string, version: number, personaVersion: number, entries: SoulEntry[]): string {
  return `# Soul · ${name.replace(/[\r\n]/g, ' ')}\n\nSoul 版本：${version}；基础性格版本：${personaVersion}。\n\n` +
    (entries.length ? entries.map(e => `- ${e.id}｜${e.status}｜${entryBehavior(e)}\n  来源消息：${e.sourceMessageId}；形成时间：${e.createdAt}。`).join('\n') : '尚无已确认的成长条目。') + '\n';
}
export function compileRuntime(state: RuntimeState): string {
  return `## 当前临时状态\n精力：${state.energy}；活动意愿：${state.willingness}。来源是显式状态事件；baseline 表示没有有效额外状态。\n这不是对用户情绪的判断，不表示已完成任何院子动作，不把离线时间解释为被冷落。`;
}
