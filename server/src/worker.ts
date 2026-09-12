import { Worker } from 'bullmq';
import { assertModelConfig, config, describeModelConfig } from './config.ts';
import { sql } from './db/client.ts';
import { type BoundarySummarizeJob, closeQueues, type MemoryExtractJob, QUEUE } from './queue.ts';
import { bullConnection, redis } from './redis.ts';
import { summarizeBoundary } from './worker/boundary.ts';
import { extractMemories } from './worker/memory.ts';
import { sweepStaleTurns } from './worker/sweep.ts';
import { executeJob, recoverJobs } from './jobs/store.ts';
import { recoveryScanner } from './worker/recovery.ts';

assertModelConfig();
const connection = bullConnection();

const workers = [
  new Worker<MemoryExtractJob>(QUEUE.memoryExtract, (job) => executeJob(job.data.taskId, (task) => extractMemories(task.objectId, task.id)), {
    connection,
    concurrency: 4,
  }),
  new Worker<BoundarySummarizeJob>(
    QUEUE.boundarySummarize,
    (job) => executeJob(job.data.taskId, (task) => summarizeBoundary(task.objectId, task.id)),
    { connection, concurrency: 2 },
  ),
  new Worker(QUEUE.sweep, () => sweepStaleTurns(), { connection, concurrency: 1 }),
];

for (const w of workers) {
  w.on('failed', (job, err) => console.error(`[worker ${w.name}] ${job?.id} 失败（第 ${job?.attemptsMade} 次）`, err));
}

const scan = recoveryScanner(recoverJobs, sweepStaleTurns);
const scanTimer = setInterval(() => void scan(), 15_000);
void scan();

console.log(`[worker] 已启动  ${describeModelConfig()}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('[worker] 收到退出信号，等手上的任务做完');
  await Promise.all(workers.map((w) => w.close()));
  clearInterval(scanTimer);
  await closeQueues();
  redis.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
