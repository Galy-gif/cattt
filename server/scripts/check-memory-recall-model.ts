/** 小规模真实模型探测，只有合成查询，不打印凭证或供应商原始响应。 */
import { mkdir, writeFile } from 'node:fs/promises';
import { APICallError, generateText, Output } from 'ai';
import { z } from 'zod';
import { config } from '../src/config.ts';
import { classifyModelError, recallSlot } from '../src/runtime/model.ts';
import { sql } from '../src/db/client.ts';
if (config.MODEL_PROVIDER !== 'deepseek') throw new Error('此脚本仅用于现有真实模型');
const checks: object[] = [];
const slot = recallSlot();
for (const query of ['找本烧脑的读物', '晚饭吃什么']) {
  const start = Date.now();
  try {
    const response = await generateText({ model: slot.model, instructions: '只输出json，把当前请求转成用于查找个人记忆的主题词，不编造用户事实。格式：{"terms":["主题词"]}。最多6个主题词。',
      prompt: query, output: Output.object({ schema: z.object({ terms: z.array(z.string()).max(6) }) }), providerOptions: slot.providerOptions,
      maxOutputTokens: 192, maxRetries: 0, abortSignal: AbortSignal.timeout(5000) });
    checks.push({ query, status: 'responded', terms: response.output.terms, inputTokens: response.usage.inputTokens, outputTokens: response.usage.outputTokens, elapsedMs: Date.now() - start });
  } catch (error) {
    const info = classifyModelError(error);
    checks.push({ query, status: 'unverified', code: info.code, httpStatus: APICallError.isInstance(error) ? error.statusCode : null, elapsedMs: Date.now() - start });
    if (!info.retryable) break;
  }
}
const directory = new URL('../../outputs/memory-recall-review/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('真实模型检查.json', directory), JSON.stringify({ model: slot.modelId, evidence: '现有供应商、合成查询、单次无重试；成功返回也不等于完整聊天质量验收', checks }, null, 2));
console.log(JSON.stringify(checks)); await sql.end();
