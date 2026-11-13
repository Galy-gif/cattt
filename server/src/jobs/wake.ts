import { sql } from '../db/client.ts';
import { recoverJobs } from './store.ts';

/** 合并突发通知；扫描中再收到通知时补扫，断线/漏通知由15秒恢复兜底。 */
export async function startJobWakeup(recover:()=>Promise<void> = recoverJobs) {
  let stopped=false, dirty=false;
  let running:Promise<void>|undefined;
  const wake=()=>{
    if(stopped)return;
    dirty=true;
    if(running)return;
    running=(async()=>{
      while(dirty&&!stopped){dirty=false;try{await recover();}catch(error){console.error('[agent wake]',error);}}
    })().finally(()=>{running=undefined;});
  };
  const listener=await sql.listen('cattt_agent_wake',wake,wake);
  const timer=setInterval(wake,15_000);
  wake();
  return async()=>{stopped=true;clearInterval(timer);await listener.unlisten();await running;};
}
