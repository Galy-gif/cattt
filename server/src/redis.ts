import { Redis } from 'ioredis';
import { config } from './config.ts';

// 普通请求必须能失败返回；只有 BullMQ 消费连接需要无限重试。
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000, commandTimeout: 2_000,
});

/** BullMQ 自己建连接，给它连接参数而不是实例 */
export function bullConnection() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    db: Number(url.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
  };
}
