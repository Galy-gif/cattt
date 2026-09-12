import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { z } from 'zod';
import { runCatAgent, type RuntimeTool, type ToolTrace } from '../src/runtime/agent.ts';
import { timeTool } from '../src/runtime/time.ts';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 3, text: 3, reasoning: 0 } };
function step(text: string, calls: { name: string; id: string; input?: object }[] = []): LanguageModelV4StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    ...(text ? [{ type: 'text-start', id: 't' } as const, { type: 'text-delta', id: 't', delta: text } as const, { type: 'text-end', id: 't' } as const] : []),
    ...calls.map(c => ({ type: 'tool-call' as const, toolCallId: c.id, toolName: c.name, input: JSON.stringify(c.input ?? {}) })),
    { type: 'finish', finishReason: { unified: calls.length ? 'tool-calls' : 'stop', raw: calls.length ? 'tool_calls' : 'stop' }, usage },
  ];
}
function model(steps: LanguageModelV4StreamPart[][]) {
  let calls = 0;
  return { model: new MockLanguageModelV4({ doStream: async () => {
    const parts = steps[calls++];
    if (!parts) throw new Error('unexpected model call');
    return { stream: new ReadableStream({ start(c) { for (const part of parts) c.enqueue(part); c.close(); } }) };
  } }), count: () => calls };
}
const observation = { status: 'succeeded' as const, source: 'fixture', observed_at: '2026-09-12T00:00:00Z', data: { ok: true } };
const fake: RuntimeTool = { description: 'fake', inputSchema: z.object({}), execute: async () => observation };
async function run(m: ReturnType<typeof model>, tools: Record<string, RuntimeTool>, extras: object = {}) {
  let text = '';
  const traces: ToolTrace[] = [];
  const phases: string[] = [];
  await runCatAgent({ model: m.model, instructions: '猫', messages: [{ role: 'user', content: '你好' }], tools,
    signal: new AbortController().signal, guard: async () => {}, onText: async t => { text += t; },
    onTool: async t => { traces.push(t); }, onStep: async s => { phases.push(s.phase); }, ...extras });
  return { text, traces, phases };
}
describe('ToolLoopAgent 真实 SDK 循环', () => {
  it('丢弃工具步骤的承诺，只有工具结束后的正文进入聊天', async () => {
    const m = model([step('我已经到池塘了', [{ name: 'lookup', id: '1' }]), step('', [{ name: 'finish_tools', id: '2' }]), step('暂时去不了，喵。')]);
    const result = await run(m, { lookup: { ...fake, execute: async () => ({ ...observation, data: { observedAt: new Date('2026-09-12T00:00:00Z') } }) } });
    expect(result.text).toBe('暂时去不了，喵。');
    expect(result.phases).toEqual(['tools', 'tools', 'answer']);
    expect(m.count()).toBe(3);
  });
  it('连续请求工具达到预算时，第四次调用保留给终答', async () => {
    const m = model([step('', [{ name: 'lookup', id: '1' }]), step('', [{ name: 'lookup', id: '2' }]), step('', [{ name: 'lookup', id: '3' }]), step('知道这些，喵。')]);
    const result = await run(m, { lookup: fake });
    expect(m.count()).toBe(4);
    expect(result.text).toContain('知道这些');
    expect(result.phases.at(-1)).toBe('answer');
  });
  it('同一步多个工具顺序执行，第二个世界动作不执行', async () => {
    const order: string[] = [];
    const move: RuntimeTool = { ...fake, changesWorld: true, execute: async () => { order.push('move'); return observation; } };
    const lookup: RuntimeTool = { ...fake, execute: async () => { expect(order).toEqual(['move']); order.push('lookup'); return observation; } };
    const m = model([step('', [{ name: 'move', id: '1' }, { name: 'lookup', id: '2' }, { name: 'move', id: '3' }]), step('', [{ name: 'finish_tools', id: '4' }]), step('嗯。')]);
    const result = await run(m, { move, lookup });
    expect(order).toEqual(['move', 'lookup']);
    expect(result.traces.find(t => t.callId === '3' && t.output)?.output?.error?.code).toBe('tool_budget');
  });
  it('取消时不派发排队中的下一个工具，也不发布正文', async () => {
    const abort = new AbortController(); let second = 0; let output = '';
    const first: RuntimeTool = { ...fake, execute: async () => { abort.abort(); return observation; } };
    const m = model([step('', [{ name: 'first', id: '1' }, { name: 'second', id: '2' }]), step('不应出现')]);
    await expect(run(m, { first, second: { ...fake, execute: async () => { second++; return observation; } } }, { signal: abort.signal, onText: async (text: string) => { output += text; } })).rejects.toBeDefined();
    expect(second).toBe(0); expect(output).toBe('');
  });
  it('真实时间遵循时区，跨午夜不沿用来源日，拒绝无效时区', async () => {
    const tool = timeTool(() => new Date('2026-09-12T23:30:00Z'));
    const result = await tool.execute({ timeZone: 'Asia/Shanghai' }, new AbortController().signal);
    expect(JSON.stringify(result.data)).toContain('2026年9月13日');
    expect(tool.inputSchema.safeParse({ timeZone: 'invented/city' }).success).toBe(false);
  });
});
