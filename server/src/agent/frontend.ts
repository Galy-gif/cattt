import { config } from '../config.ts';
import { startQueueWorkers } from '../queue.ts';
import { executeJob } from '../jobs/store.ts';
import { startJobWakeup } from '../jobs/wake.ts';
import { processFollowup, scanFollowups } from './followup.ts';
import { processInference, scanInferenceClock } from './inference.ts';
import { processReport } from './reports.ts';
import { processPush } from '../push/service.ts';

/** 与聊天同属 API 的前台团子。执行 worker 不注册这些消费者。 */
export async function startFrontendRouter() {
  const whenEnabled=(run:()=>Promise<any>)=>config.AGENT_ENABLED==='true'?run():Promise.resolve({retryAt:new Date(Date.now()+60000)});
  const kinds = await startQueueWorkers({
    report:id=>executeJob(id,job=>whenEnabled(()=>processReport(job.objectId))),
    followup:id=>executeJob(id,job=>whenEnabled(()=>processFollowup(job.objectId))),
    inference:id=>executeJob(id,job=>whenEnabled(()=>processInference(job.objectId))),
    push:id=>executeJob(id,job=>whenEnabled(()=>processPush(job.objectId))),
  });
  const stopWake=await startJobWakeup(kinds);
  let scanning:Promise<void>|undefined;
  const clock=()=>{
    if(scanning||config.AGENT_ENABLED!=='true')return;
    scanning=scanFollowups().then(()=>scanInferenceClock()).catch(error=>console.error('[router clock]',error)).finally(()=>{scanning=undefined;});
  };
  const timer=setInterval(clock,30_000);clock();
  return async()=>{clearInterval(timer);await scanning;await stopWake();};
}
