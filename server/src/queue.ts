import { PgBoss } from 'pg-boss';
import { config } from './config.ts';
import type { asyncJobs } from './db/schema.ts';
export const EXTRACTOR_VERSION = 'v2';
export const QUEUE = { memoryExtract: 'memory-extract', boundarySummarize: 'boundary-summarize', diaryRead: 'diary-read', sweep: 'sweep', followup: 'followup', errand: 'errand', dailyDiary: 'daily-diary', push: 'push', inference: 'inference', report: 'report' } as const;
type Kind = keyof typeof names;
type Delivery = { taskId: string };
const names = { memory: QUEUE.memoryExtract, boundary: QUEUE.boundarySummarize, diary_read: QUEUE.diaryRead, followup: QUEUE.followup, errand: QUEUE.errand, daily_diary: QUEUE.dailyDiary, push: QUEUE.push, inference: QUEUE.inference, report: QUEUE.report } as const;
let boss: Promise<PgBoss> | undefined;

/** pg-boss 自管 pgboss schema；业务表和 drizzle 迁移不在这里注册。 */
export function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  // 维护查询允许60秒；请求侧 dispatchJob 仍只等待2.5秒，PG保留待办供恢复扫描。
  const current = new PgBoss({ connectionString: config.DATABASE_URL, schema: 'pgboss',
    connectionTimeoutMillis: 1500, options: '-c statement_timeout=60000' });
  current.on('error', error => console.error('[pg-boss]', error));
  let starting!: Promise<PgBoss>;
  starting = (async () => {
    try {
      await current.start();
      for (const name of Object.values(QUEUE)) await current.createQueue(name, { policy: 'short', retryLimit: 0, expireInSeconds: name===QUEUE.errand?660:300 });
      return current;
    } catch (error) {
      if (boss === starting) boss = undefined;
      await current.stop({ graceful: false }).catch(() => {});
      throw error;
    }
  })();
  boss = starting;
  return starting;
}

export async function dispatchJob(job: typeof asyncJobs.$inferSelect) {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      (async () => {
        const current = await getBoss();
        // 只合并尚未领取的同次投递；新尝试不受旧的 active/failed/completed 投递阻断。
        await current.send(names[job.kind as Kind] ?? QUEUE.boundarySummarize, { taskId: job.id }, { singletonKey: `${job.id}.${job.attempts}`, retryLimit: 0 });
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('queue_dispatch_timeout')), 2500); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** batchSize 保持 1；localConcurrency 是同时运行的处理器数，不是批量大小。 */
export async function startQueueWorkers(handlers: Partial<Record<Kind, (taskId: string) => Promise<void>>> & { sweep?: () => Promise<void> }) {
  const current = await getBoss();
  const concurrency = { memory: 4, boundary: 2, diary_read: 2, followup: 2, errand: 2, daily_diary: 2, push: 2, inference: 2, report: 2 };
  for (const kind of Object.keys(names) as Kind[]) {
    if (!handlers[kind]) continue;
    await current.work<Delivery>(names[kind], { localConcurrency: concurrency[kind], pollingIntervalSeconds: 0.5 }, async ([job]) => {
      try { await handlers[kind]!(job!.data.taskId); }
      catch (error) { console.error(`[worker ${names[kind]}] ${job!.id} 失败`, error); throw error; }
    });
  }
  if (handlers.sweep) await current.work(QUEUE.sweep, { localConcurrency: 1, pollingIntervalSeconds: 0.5 }, async () => { await handlers.sweep!(); });
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
  const current = boss; boss = undefined;
  if (current) await (await current).stop({ graceful: true, timeout: 300_000 });
}
