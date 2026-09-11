import { Redis } from 'ioredis';
import { config } from './config.ts';

export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

/** BullMQ 自己建连接，给它连接参数而不是实例 */
export function bullConnection() {
  const url = new URL(config.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
