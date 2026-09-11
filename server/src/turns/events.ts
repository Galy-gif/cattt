import { TURN_EVENTS_TTL_S } from '../config.ts';
import { redis } from '../redis.ts';

/**
 * 发给 iOS 的 SSE 事件。格式是我们自己定的，不用 AI SDK 的流协议，
 * 这样 SDK 升级不会牵连 iOS 发版。见 docs/specs/后端-开发者版-2026-09-11.md 第 7 节。
 */
export type TurnEvent =
  | { event: 'accepted'; data: { turn_id: string; user_message_id: string } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'superseded'; data: { turn_id: string } }
  | { event: 'done'; data: { message_id: string | null; status: 'done' | 'stopped' } }
  | { event: 'error'; data: { code: string; retryable: boolean } };

export type StoredEvent = TurnEvent & { id: string };

const TERMINAL = new Set(['done', 'superseded', 'error']);
export const isTerminal = (event: string) => TERMINAL.has(event);

const eventsKey = (turnId: string) => `turn:${turnId}:events`;

/**
 * 每一段都写进 Redis Stream。HTTP 响应只是跟着读，断线后带 Last-Event-ID 从断点接着读。
 * 结束事件写完后只留 10 分钟；进行中的留 1 小时兜底，防止进程崩了留下孤儿键。
 */
export async function publish(turnId: string, ev: TurnEvent) {
  const key = eventsKey(turnId);
  await redis
    .multi()
    .xadd(key, '*', 'event', ev.event, 'data', JSON.stringify(ev.data))
    .expire(key, isTerminal(ev.event) ? TURN_EVENTS_TTL_S : 3600)
    .exec();
}

function parse(id: string, fields: string[]): StoredEvent {
  const map: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) map[fields[i]!] = fields[i + 1]!;
  return { id, event: map.event, data: JSON.parse(map.data ?? '{}') } as StoredEvent;
}

/**
 * 从 afterId 之后开始读这一轮的事件，读到结束事件为止。
 * 键不存在（已过期或从没有过）返回 'missing'，由调用方回库里查。
 * 每 15 秒没新事件吐一个 'ping'，用来给 SSE 保活。
 */
export async function* tail(
  turnId: string,
  afterId: string,
  signal: AbortSignal,
): AsyncGenerator<StoredEvent | 'ping', 'missing' | 'end' | 'aborted'> {
  const key = eventsKey(turnId);
  if ((await redis.exists(key)) === 0) return 'missing';

  // 阻塞读会占住连接，每个监听者单独一条
  const conn = redis.duplicate();
  const onAbort = () => conn.disconnect();
  signal.addEventListener('abort', onAbort, { once: true });
  let lastId = afterId;
  try {
    while (!signal.aborted) {
      const res = await conn.xread('BLOCK', 15_000, 'STREAMS', key, lastId);
      if (!res) {
        yield 'ping';
        continue;
      }
      for (const [, entries] of res) {
        for (const [id, fields] of entries) {
          lastId = id;
          const ev = parse(id, fields);
          yield ev;
          if (isTerminal(ev.event)) return 'end';
        }
      }
    }
    return 'aborted';
  } catch (err) {
    if (signal.aborted) return 'aborted';
    throw err;
  } finally {
    signal.removeEventListener('abort', onAbort);
    conn.disconnect();
  }
}

// ---- 停止与作废 ----

export type CancelReason = 'stop' | 'supersede';
const cancelKey = (turnId: string) => `turn:${turnId}:cancel`;

export async function requestCancel(turnId: string, reason: CancelReason) {
  // 作废优先于停止：两者都来时按作废处理
  if (reason === 'stop') await redis.set(cancelKey(turnId), reason, 'EX', 600, 'NX');
  else await redis.set(cancelKey(turnId), reason, 'EX', 600);
}

export async function readCancel(turnId: string): Promise<CancelReason | null> {
  return (await redis.get(cancelKey(turnId))) as CancelReason | null;
}

/** 停止时客户端屏幕上显示了多少（UTF-16 长度），存库时截到这里 */
const visibleKey = (turnId: string) => `turn:${turnId}:visible`;

export async function recordVisibleLength(turnId: string, length: number) {
  await redis.set(visibleKey(turnId), String(length), 'EX', 600);
}

export async function readVisibleLength(turnId: string): Promise<number | null> {
  const raw = await redis.get(visibleKey(turnId));
  return raw === null ? null : Number(raw);
}

// ---- 同一段对话同一时间只生成一轮 ----

const lockKey = (conversationId: string) => `conv:${conversationId}:lock`;
const LOCK_TTL_MS = 30_000;

export async function acquireConversationLock(
  conversationId: string,
  token: string,
  waitMs: number,
  onWait?: () => Promise<void>,
): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  let lastBeat = Date.now();
  while (Date.now() < deadline) {
    const ok = await redis.set(lockKey(conversationId), token, 'PX', LOCK_TTL_MS, 'NX');
    if (ok) return true;
    if (onWait && Date.now() - lastBeat > 5_000) {
      lastBeat = Date.now();
      await onWait();
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// 只删自己持有的锁
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
const REFRESH = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

export async function releaseConversationLock(conversationId: string, token: string) {
  await redis.eval(RELEASE, 1, lockKey(conversationId), token);
}

export async function refreshConversationLock(conversationId: string, token: string) {
  await redis.eval(REFRESH, 1, lockKey(conversationId), token, LOCK_TTL_MS);
}
