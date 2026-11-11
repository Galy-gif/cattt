import { processInference,scanInferenceClock } from './agent/inference.ts';
import { writeFileSync, unlinkSync } from 'node:fs';
import { processPush } from './push/service.ts';
import { scanDailyDiaries, processDailyDiary } from './agent/daily-diary.ts';
import { processErrand } from './agent/executor.ts';
import { scanErrands } from './agent/errands.ts';
import { scanFollowups, processFollowup } from './agent/followup.ts';
import { config, assertModelConfig, describeModelConfig } from './config.ts';
import { sql } from './db/client.ts';
import { closeQueues, startQueueWorkers } from './queue.ts';
import { redis } from './redis.ts';
import { summarizeBoundary } from './worker/boundary.ts';
import { extractMemories } from './worker/memory.ts';
import { sweepStaleTurns } from './worker/sweep.ts';
import { executeJob, recoverJobs } from './jobs/store.ts';
import { recoveryScanner } from './worker/recovery.ts';
import { readDiary } from './worker/diary.ts';

assertModelConfig();
await startQueueWorkers({
  memory: id => executeJob(id, task => extractMemories(task.objectId, task.id)),
  boundary: id => executeJob(id, task => summarizeBoundary(task.objectId, task.id)),
  diary_read: id => executeJob(id, task => readDiary(task.objectId, task.version, task.id)),
  inference:id=>executeJob(id,task=>processInference(task.objectId)),
  push: id=>executeJob(id,task=>config.AGENT_ENABLED==='true'?processPush(task.objectId):Promise.resolve({retryAt:new Date(Date.now()+60000)})),
  daily_diary: id => executeJob(id,task=>config.AGENT_ENABLED==='true'?processDailyDiary(task.objectId):Promise.resolve({retryAt:new Date(Date.now()+60000)})),
  errand: id => executeJob(id,task=>config.AGENT_ENABLED==='true'?processErrand(task.objectId):Promise.resolve({retryAt:new Date(Date.now()+60000)})),
  followup: id => executeJob(id, task => config.AGENT_ENABLED==='true'?processFollowup(task.objectId):Promise.resolve({retryAt:new Date(Date.now()+60000)})),
  sweep: sweepStaleTurns,
});

const scan = recoveryScanner(recoverJobs, sweepStaleTurns);
const scanTimer = setInterval(() => void scan().then(()=>writeFileSync('/tmp/cattt-worker-heartbeat','ready')), 15_000);
void scan().then(()=>writeFileSync('/tmp/cattt-worker-heartbeat','ready'));
const followupScan = () => config.AGENT_ENABLED==='false'?Promise.resolve():scanFollowups().then(()=>scanErrands()).then(()=>scanDailyDiaries()).then(()=>scanInferenceClock()).then(() => recoverJobs()).catch(error=>console.error('[followup scan]',error));
const followupTimer = setInterval(() => void followupScan(),30_000);
void followupScan();

console.log(`[worker] 已启动  ${describeModelConfig()}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('[worker] 收到退出信号，等手上的任务做完');
  clearInterval(scanTimer);
  clearInterval(followupTimer);
  try{unlinkSync('/tmp/cattt-worker-heartbeat');}catch{}
  await closeQueues();
  redis.disconnect();
  await sql.end({ timeout: 5 });
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
