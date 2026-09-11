import { Queue } from 'bullmq';
import { bullConnection } from './redis.ts';

/**
 * 队列在 Redis 里，丢了不要紧：真正要保证的（记忆不重复写、这一轮提取过没有）都在 PG 里有唯一约束和时间戳兜底。
 * jobId 按「来源 id.任务类型.版本」拼，重复投递 BullMQ 直接忽略。BullMQ 的自定义 jobId 不能含冒号。
 */
export const EXTRACTOR_VERSION = 'v1';

export type MemoryExtractJob = { turnId: string };
export type BoundarySummarizeJob = { boundaryId: string };

export const QUEUE = {
  memoryExtract: 'memory-extract',
  boundarySummarize: 'boundary-summarize',
  sweep: 'sweep',
} as const;

const connection = bullConnection();
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: { age: 24 * 3600 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export const memoryExtractQueue = new Queue<MemoryExtractJob>(QUEUE.memoryExtract, { connection, defaultJobOptions });
export const boundarySummarizeQueue = new Queue<BoundarySummarizeJob>(QUEUE.boundarySummarize, {
  connection,
  defaultJobOptions,
});

export async function enqueueMemoryExtract(turnId: string, userMessageId: string) {
  await memoryExtractQueue.add(
    'extract',
    { turnId },
    { jobId: `${userMessageId}.memory-extract.${EXTRACTOR_VERSION}` },
  );
}

export async function enqueueBoundarySummarize(boundaryId: string) {
  await boundarySummarizeQueue.add('summarize', { boundaryId }, { jobId: `${boundaryId}.boundary.v1` });
}

export async function closeQueues() {
  await Promise.all([memoryExtractQueue.close(), boundarySummarizeQueue.close()]);
}
