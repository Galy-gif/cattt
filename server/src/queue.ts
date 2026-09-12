import { Queue } from 'bullmq';
import { bullConnection } from './redis.ts';
import type { asyncJobs } from './db/schema.ts';
export const EXTRACTOR_VERSION = 'v1';
export type MemoryExtractJob = { taskId: string };
export type BoundarySummarizeJob = { taskId: string };
export const QUEUE = { memoryExtract: 'memory-extract', boundarySummarize: 'boundary-summarize', sweep: 'sweep' } as const;
let queues: { memory: Queue<MemoryExtractJob>; boundary: Queue<BoundarySummarizeJob> } | undefined;
function getQueues() {
  const connection = { ...bullConnection(), maxRetriesPerRequest: 1, connectTimeout: 1_500,
    commandTimeout: 2_000, retryStrategy: () => null };
  return queues ??= {
    memory: new Queue(QUEUE.memoryExtract, { connection }),
    boundary: new Queue(QUEUE.boundarySummarize, { connection }),
  };
}
export async function dispatchJob(job: typeof asyncJobs.$inferSelect) {
  const current = getQueues();
  const queue = current[job.kind === 'memory' ? 'memory' : 'boundary'];
  // PG 控制重试；每次尝试独立 jobId，不被 Redis 的旧 failed/completed job 阻断。
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      queue.add(job.kind, { taskId: job.id }, { jobId: `${job.id}.${job.attempts}`, attempts: 1, removeOnComplete: true, removeOnFail: true }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('queue_dispatch_timeout')), 2_500); }),
    ]);
  } catch (error) {
    if (queues === current) queues = undefined;
    // 丢弃故障连接，防止超时请求留在本地队列无限等待；PG 待办下次重新投递。
    await Promise.allSettled([current.memory.disconnect(), current.boundary.disconnect()]);
    throw error;
  } finally { clearTimeout(timer); }
}
export async function enqueueMemoryExtract(_turnId: string, _userMessageId: string) {
  const { recoverJobs } = await import('./jobs/store.ts');
  await recoverJobs();
}
export async function enqueueBoundarySummarize(_boundaryId: string) {
  const { recoverJobs } = await import('./jobs/store.ts');
  await recoverJobs();
}
export async function closeQueues() {
  const current = queues; queues = undefined;
  if (current) await Promise.all([current.memory.close(), current.boundary.close()]);
}
