/** 内部实测协议 v2：一次测试 runId，一次网页加载 pageId。 */
declare global {
  interface Window {
    webkit?: { messageHandlers?: { maomao?: { postMessage(message: string): void } } };
    __app?: { command(json: string): string };
  }
}
const params = new URLSearchParams(location.search);
export const identity = { runId: params.get('runId') ?? 'browser', pageId: params.get('pageId') ?? 'browser' };
export const inApp = () => Boolean(window.webkit?.messageHandlers?.maomao);
export function post(message: { type: string; [key: string]: unknown }) {
  const envelope = { ...message, ...identity };
  const handler = window.webkit?.messageHandlers?.maomao;
  if (handler) handler.postMessage(JSON.stringify(envelope));
  else if (message.type !== 'perf') console.info('[bridge]', envelope);
}
addEventListener('error', event => post({ type: 'error', message: `${event.message} (${event.filename}:${event.lineno})` }));
addEventListener('unhandledrejection', event => post({ type: 'error', message: `未处理的 Promise 拒绝：${String(event.reason)}` }));
