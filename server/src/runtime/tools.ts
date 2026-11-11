import { startErrand, appendTicketInput } from '../agent/errands.ts';
import { scheduleFollowup, updateTicket, cancelTicket, listTickets, ticketView, TicketError } from '../agent/tickets.ts';
import { z } from 'zod';
import type { Observation, RuntimeTool } from './agent.ts';
import { timeTool, userTimeZone } from './time.ts';
import { weatherTool } from './weather.ts';
import { getActionStatus, getWorldState, moveCat } from '../world/service.ts';
import { WorldError } from '../world/protocol.ts';

export async function catTools(owner: { catId: string; turnId: string; userMessageId: string }): Promise<Record<string, RuntimeTool>> {
  const observe = async (work: () => Promise<unknown>): Promise<Omit<Observation, 'call_id'>> => {
    try { return { status: 'succeeded', data: await work(), source: 'world-bridge', observed_at: new Date().toISOString() }; }
    catch (error) { return { status: 'failed', error: { code: error instanceof WorldError ? error.code : 'world_failed', retryable: true }, source: 'world-bridge', observed_at: new Date().toISOString() }; }
  };
  const tools: Record<string, RuntimeTool> = {
    get_time: timeTool(undefined, await userTimeZone(owner.catId)),
    get_weather: weatherTool(),
    get_world_state: { description: '读取猫的真实世界观察；available=false 表示当前不能执行动作。移动中 current 是上次到达位置。', inputSchema: z.object({}), execute: () => observe(() => getWorldState(owner.catId)) },
    get_action_status: { description: '查询已知动作的真实状态，不忙轮询。只有 arrived 才代表到达。', inputSchema: z.object({ actionId: z.uuid() }), execute: ({ actionId }) => observe(() => getActionStatus(owner.catId, actionId)) },
  };
  const agreement = async (work: () => Promise<unknown>): Promise<Omit<Observation, 'call_id'>> => {
    try { return {status:'succeeded',data:await work(),source:'saved-agreement',observed_at:new Date().toISOString()}; }
    catch(error) { return {status:'failed',data:{reason:error instanceof TicketError?error.message:'保存未成功'},error:{code:'agreement_failed',retryable:!(error instanceof TicketError)},source:'saved-agreement',observed_at:new Date().toISOString()}; }
  };
  tools.schedule_followup = {
    description:'只在用户明确约定、日期和时间都确定后保存约定。when 为用户本地 ISO 日期时间；先用 get_time 确认用户时区与今天，相对日期据此解析。改天、明晚等模糊时间先问具体几点，不调用。仅 succeeded 凭证才能说约好了。',
    inputSchema:z.object({when:z.string(),about:z.string().trim().min(1).max(60)}),
    execute:({when,about})=>agreement(()=>scheduleFollowup(owner.catId,owner.userMessageId,when,about)),
  };
  tools.start_errand = {
    description:'用户明确托付一件事，保存后交给后台安静地想。不能联网检索、外部文档或执行代码。成功凭证才可承诺；queued时说“这件我先记着，前面那件办完再来”。',
    inputSchema:z.object({goal:z.string().trim().min(1).max(60)}),execute:({goal})=>agreement(()=>startErrand(owner.catId,owner.userMessageId,goal)),
  };
  tools.list_tickets = {
    description:'读取用户未结束的约定、托付及阶段和 ticket_id。用户说改成后天、取消那件时先读，按当前聊天所指的已有事项直达 update_ticket/cancel_ticket；无法唯一判断就澄清，不另建一件。',
    inputSchema:z.object({}),execute:()=>agreement(async()=>({tickets:(await listTickets(owner.catId)).map(ticketView)})),
  };
  tools.update_ticket = {
    description:'把已有约定改到确定的时间，ticket_id 必须来自 list_tickets。相对日期按 get_time 的用户时区，改成后天可沿用该约定原先的本地钟点；时间不清楚先问。成功才说改好了。托付补一句话传text，直接写ticket_inputs；在等用户的托付由此继续。不可用when修改托付。',
    inputSchema:z.object({ticket_id:z.uuid(),when:z.string().optional(),text:z.string().trim().min(1).max(2000).optional()}).refine(x=>!!x.when!==!!x.text),
    execute:({ticket_id,when,text})=>agreement(()=>text ? appendTicketInput(owner.catId,ticket_id,text,owner.userMessageId) : updateTicket(owner.catId,ticket_id,when!,owner.userMessageId)),
  };
  tools.cancel_ticket = {
    description:'用户明确撤回已有约定或托付时取消，成功才说取消了。ticket_id 来自 list_tickets，指代不明先问清。',
    inputSchema:z.object({ticket_id:z.uuid()}),execute:({ticket_id})=>agreement(()=>cancelTicket(owner.catId,ticket_id)),
  };
  const world = await getWorldState(owner.catId);
  if (world.available) tools.move_cat = {
    description: '执行用户要求的移动。先 get_world_state 获取 sessionId、generation 和 stateVersion；地点必须来自该观察的 destinationIds。',
    inputSchema: z.object({ destinationId: z.string().max(80), stateVersion: z.number().int().min(0), sessionId: z.uuid(), generation: z.uuid() }),
    changesWorld: true,
    execute: async (input, signal) => {
      const result = await observe(async () => {
        let action = await moveCat({ ...input, ...owner });
        const deadline = performance.now() + 2_000;
        while (action.status === 'requested' && performance.now() < deadline) {
          signal.throwIfAborted();
          await new Promise((resolve) => setTimeout(resolve, 100));
          action = await getActionStatus(owner.catId, action.id);
        }
        return { actionId: action.id, status: action.status, destinationId: action.destinationId, reason: action.reason };
      });
      if (result.status === 'failed') return result;
      const data = result.data as { status: string };
      if (['accepted', 'running'].includes(data.status)) return { ...result, status: 'accepted' };
      if (data.status === 'arrived') return result;
      return { ...result, status: 'failed', error: { code: data.status === 'requested' ? 'accept_unknown' : `action_${data.status}`, retryable: false } };
    },
  };
  return tools;
}
