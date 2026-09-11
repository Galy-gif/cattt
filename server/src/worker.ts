import { Queue, Worker } from 'bullmq';
import { assertModelConfig, config, describeModelConfig } from './config.ts';
import { sql } from './db/client.ts';
import { type BoundarySummarizeJob, closeQueues, type MemoryExtractJob, QUEUE } from './queue.ts';
import { bullConnection, redis } from './redis.ts';
import { summarizeBoundary } from './worker/boundary.ts';
import { extractMemories } from './worker/memory.ts';
import { sweepStaleTurns } from './worker/sweep.ts';

assertModelConfig();
const connection = bullConnection();

const workers = [
  new Worker<MemoryExtractJob>(QUEUE.memoryExtract, (job) => extractMemories(job.data.turnId, job.id!), {
    connection,
    concurrency: 4,
  }),
  new Worker<BoundarySummarizeJob>(
    QUEUE.boundarySummarize,
    (job) => summarizeBoundary(job.data.boundaryId, job.id!),
    { connection, concurrency: 2 },
  ),
  new Worker(QUEUE.sweep, () => sweepStaleTurns(), { connection, concurrency: 1 }),
];

for (const w of workers) {
  w.on('failed', (job, err) => console.error(`[worker ${w.name}] ${job?.id} 失败（第 ${job?.attemptsMade} 次）`, err));
}

const sweepQueue = new Queue(QUEUE.sweep, { connection });
await sweepQueue.upsertJobScheduler(
  'sweep-stale-turns',
  { every: 15_000 },
  { opts: { removeOnComplete: true, removeOnFail: 100 } },
);

console.log(`[worker] 已启动  ${describeModelConfig()}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('[worker] 收到退出信号，等手上的任务做完');
  await Promise.all(workers.map((w) => w.close()));
  await sweepQueue.close();
  await closeQueues();
  redis.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
