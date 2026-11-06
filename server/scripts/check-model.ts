/** 真实模型连通检查：仅发送固定测试文字，不读取账号或日记数据。失败以非零状态退出。 */
import { createDeepSeek } from '@ai-sdk/deepseek';
import { APICallError, generateText } from 'ai';
import { config } from '../src/config.ts';

async function check() {
  if (config.MODEL_PROVIDER !== 'deepseek') {
    return { connected: false, code: 'real_provider_required', detail: '请使用 MODEL_PROVIDER=deepseek，检查不会回退到模拟模型。' };
  }
  const key = config.MAOMAO_DEEPSEEK_API_KEY;
  if (!key?.trim()) return { connected: false, code: 'model_key_missing' };
  if (key !== key.trim() || /\s/.test(key)) return { connected: false, code: 'model_key_format' };

  const response = await fetch('https://api.deepseek.com/user/balance', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    return { connected: false, authentication: 'failed', status: response.status,
      code: [401, 403].includes(response.status) ? 'model_auth' : 'model_balance_check_failed' };
  }
  const balance: unknown = await response.json();
  if (typeof balance !== 'object' || balance === null || !('is_available' in balance) || typeof balance.is_available !== 'boolean') {
    return { connected: false, authentication: 'passed', code: 'model_balance_response_invalid' };
  }
  if (!balance.is_available) {
    return { connected: false, authentication: 'passed', generation: 'not_attempted', code: 'model_quota',
      detail: '密钥认证通过，账户余额不足；补充余额后重新运行。' };
  }

  // 可能用于不同的聊天与提取模型；相同模型只验证一次。
  const provider = createDeepSeek({ apiKey: key });
  const slots = [
    { model: config.CHAT_MODEL, thinking: config.CHAT_THINKING },
    { model: config.EXTRACT_MODEL, thinking: config.EXTRACT_THINKING },
  ].filter((slot, index, all) => all.findIndex(other => other.model === slot.model && other.thinking === slot.thinking) === index);
  for (const slot of slots) {
    try {
      const result = await generateText({
        model: provider(slot.model), prompt: '连接测试：只回复 OK。',
        providerOptions: { deepseek: { thinking: { type: slot.thinking } } },
        maxOutputTokens: 64, maxRetries: 0, abortSignal: AbortSignal.timeout(15_000),
      });
      if (result.text.trim() !== 'OK') return { connected: false, authentication: 'passed', model: slot.model, code: 'model_unexpected_reply' };
    } catch (error) {
      const status = APICallError.isInstance(error) ? error.statusCode : undefined;
      return { connected: false, authentication: 'passed', model: slot.model, status,
        code: status === 402 ? 'model_quota' : [401, 403].includes(status ?? 0) ? 'model_auth' : 'model_generation_failed' };
    }
  }
  return { connected: true, authentication: 'passed', models: slots.map(slot => slot.model),
    scope: '仅验证固定文字生成，不代表记忆召回、日记读取或自然表达验收通过。' };
}

try {
  const result = await check();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.connected ? 0 : 1;
} catch {
  // 不输出原始异常，避免供应商错误携带请求头或密钥。
  console.log(JSON.stringify({ connected: false, code: 'model_check_unavailable', detail: '网络或模型服务检查失败，请稍后重试。' }));
  process.exitCode = 1;
}
