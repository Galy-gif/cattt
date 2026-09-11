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
      const reply = `喵，我听到了：「${said.replace(/\[(fail1?|slow)\]/g, '').trim()}」。`;
      const chars = Array.from(reply);
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
