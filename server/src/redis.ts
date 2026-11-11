import { Redis } from 'ioredis';
import { config } from './config.ts';

// 聊天事件流、续传与对话锁：请求必须能失败返回。
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000, commandTimeout: 2_000,
});
