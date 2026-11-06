import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { MockLanguageModelV4 } from 'ai/test';
import { config } from '../config.ts';

/**
 * 假模型：MODEL_PROVIDER=mock 时用。不花钱、结果固定，测试和没有 key 时用它。
 * 用户消息里的测试标记：
 * - [fail]  每次都在吐了几个字之后报错
 * - [fail1] 同一句话只在第一次报错，用来测「再试一次」
 * - [slow]  每个字停 300ms，用来测停止、作废和续传
 */
const failedOnce = new Set<string>();

export function mockDiaryModel() {
  return new MockLanguageModelV4({ provider: 'mock', modelId: 'mock-diary', doGenerate: async options => ({
    content: [{ type: 'text' as const, text: JSON.stringify({ comment: lastUserText(options).includes('[quiet]') ? null : '在这里陪你坐一会儿。' }) }],
    finishReason: { unified: 'stop' as const, raw: 'stop' }, usage: usage(100, 20), warnings: [],
  }) });
}

const usage = (input: number, output: number) => ({
  inputTokens: { total: input, noCache: input, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: output, text: output, reasoning: 0 },
});

function lastUserText(options: LanguageModelV4CallOptions): string {
  for (let i = options.prompt.length - 1; i >= 0; i--) {
    const m = options.prompt[i]!;
    if (m.role === 'user') {
      return m.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
    }
  }
  return '';
}

export function mockChatModel() {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-chat',
    doStream: async (options) => {
      const said = lastUserText(options);
      if (options.toolChoice?.type !== 'none' && options.tools?.length) {
        const toolReplies = options.prompt.filter((m) => m.role === 'tool').flatMap((m) => m.content);
        const hasTime = toolReplies.some((p) => p.type === 'tool-result' && p.toolName === 'get_time');
        const worldReply = toolReplies.find((p) => p.type === 'tool-result' && p.toolName === 'get_world_state');
        const hasMove = toolReplies.some((p) => p.type === 'tool-result' && p.toolName === 'move_cat');
        let toolName = said.includes('[time]') && !hasTime ? 'get_time' : 'finish_tools';
        let toolInput: object = {};
        if (said.includes('[move]') && !hasMove) {
          if (!worldReply) toolName = 'get_world_state';
          else if (worldReply.type === 'tool-result' && worldReply.output.type === 'json') {
            const observation = worldReply.output.value as { data?: { available?: boolean; sessionId: string; generation: string; stateVersion: number } };
            if (observation.data?.available && options.tools.some(t => t.name === 'move_cat')) {
              toolName = 'move_cat';
              toolInput = { destinationId: 'pond', sessionId: observation.data.sessionId, generation: observation.data.generation, stateVersion: observation.data.stateVersion };
            }
          }
        }
        return { stream: new ReadableStream<LanguageModelV4StreamPart>({ start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'tool-call', toolCallId: `mock-${toolName}`, toolName, input: JSON.stringify(toolInput) });
          controller.enqueue({ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: usage(200, 5) });
          controller.close();
        } }) };
      }
      const system = options.prompt.find(m => m.role === 'system')?.content ?? '';
      const recalled = system.match(/## 你记得的事\n([\s\S]*?)(?=\n\n|$)/)?.[1]?.trim();
      const diary = system.match(/## 本轮日记来源\n([^\n]+)/)?.[1];
      const reply = said.includes('[diary]') ? `合成验收：本轮日记来源${diary ?? '为空'}`
        : said.includes('[recall]') ? `合成验收：本轮可参考的长期记忆${recalled ? `如下。\n${recalled}` : '为空。'}`
        : `喵，我听到了：「${said.replace(/\[(fail1?|slow)\]/g, '').trim()}」。`;
      // 诊断回复只验证上下文到达，不逐字放大本机PG往返；故障/慢流标记仍按字输出。
      const chars = /\[(recall|diary)\]/.test(said) && !/\[(fail1?|slow)\]/.test(said) ? [reply] : Array.from(reply);
      const delay = said.includes('[slow]') ? 300 : config.MOCK_DELAY_MS;
      let shouldFail = said.includes('[fail]');
      if (said.includes('[fail1]') && !failedOnce.has(said)) {
        failedOnce.add(said);
        shouldFail = true;
      }
      const signal = options.abortSignal;
      const sleep = (ms: number) =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, ms);
          signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(signal.reason ?? new DOMException('aborted', 'AbortError'));
          });
        });

      const stream = new ReadableStream<LanguageModelV4StreamPart>({
        async start(controller) {
          try {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 't0' });
            for (const [i, ch] of chars.entries()) {
              await sleep(delay);
              if (shouldFail && i === 3) {
                controller.enqueue({ type: 'error', error: new Error('mock model failure') });
                controller.close();
                return;
              }
              controller.enqueue({ type: 'text-delta', id: 't0', delta: ch });
            }
            controller.enqueue({ type: 'text-end', id: 't0' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: usage(said.length + 200, chars.length),
            });
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
      return { stream };
    },
  });
}

/**
 * 假的记忆提取：
 * - 「记住……」→ 一条用户明确要记的
 * - 「我喜欢……」→ 一条普通偏好
 * 其余不提取。
 */
export function mockExtractModel() {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'mock-extract',
    doGenerate: async (options) => {
      const said = lastUserText(options);
      const system = options.prompt.find((m) => m.role === 'system')?.content ?? '';
      // 边界整理：返回一个短语
      if (system.includes('概括')) {
        const text = `关于「${Array.from(said).slice(0, 6).join('')}」的事`;
        return {
          content: [{ type: 'text', text }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: usage(100, 10),
          warnings: [],
        };
      }
      const found: unknown[] = [];
      // 按行匹配：对话里猫也会复述用户的话，只取第一处（用户那行）
      const remember = said.match(/记住(.+?)(?:[。！!]|$)/m);
      if (remember) {
        found.push({
          subject: '用户',
          predicate: '让你记住的事',
          value: remember[1]!.trim(),
          kind: 'fact',
          confidence: 0.95,
          sensitivity: 'low',
          explicit: true,
          correction: false,
        });
      }
      const like = said.match(/我喜欢(.+?)(?:[。！!，,]|$)/m);
      if (like) {
        found.push({
          subject: '用户',
          predicate: '喜欢的东西',
          value: like[1]!.trim(),
          kind: 'preference',
          confidence: 0.8,
          sensitivity: 'low',
          explicit: false,
          correction: false,
        });
      }
      const text = JSON.stringify({ memories: found });
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: usage(300, text.length),
        warnings: [],
      };
    },
  });
}

/** 测试扩词仅模拟结构化返回，不代表真实模型理解质量。 */
export function mockRecallModel() {
  return new MockLanguageModelV4({
    provider: 'mock', modelId: 'mock-recall',
    doGenerate: async options => {
      const query = lastUserText(options);
      const terms = /烧脑.*(读物|看)|硬核.*(读物|看)/.test(query) ? ['阅读', '小说', '科幻']
        : /晚饭|晚餐|吃什么/.test(query) ? ['饮食', '口味', '忌口']
        : /提神|清醒/.test(query) ? ['咖啡', '饮品', '茶饮'] : [];
      const text = JSON.stringify({ terms });
      return { content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: 'stop' }, usage: usage(query.length + 180, text.length), warnings: [] };
    },
  });
}
