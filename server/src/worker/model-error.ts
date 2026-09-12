import { UnrecoverableError } from 'bullmq';
import { classifyModelError } from '../runtime/model.ts';

/** 队列错误适配留在 worker 边界，模型模块不依赖队列。 */
export function rethrowForQueue(error: unknown): never {
  const info = classifyModelError(error);
  if (!info.retryable) throw new UnrecoverableError(`${info.code}: ${info.summary}`);
  throw error;
}
