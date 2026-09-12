import { z } from 'zod';
import type { Observation, RuntimeTool } from './agent.ts';
import { timeTool } from './time.ts';
import { weatherTool } from './weather.ts';
import { getActionStatus, getWorldState, moveCat } from '../world/service.ts';
import { WorldError } from '../world/protocol.ts';

export async function catTools(owner: { catId: string; turnId: string; userMessageId: string }): Promise<Record<string, RuntimeTool>> {
  const observe = async (work: () => Promise<unknown>): Promise<Omit<Observation, 'call_id'>> => {
    try { return { status: 'succeeded', data: await work(), source: 'world-bridge', observed_at: new Date().toISOString() }; }
    catch (error) { return { status: 'failed', error: { code: error instanceof WorldError ? error.code : 'world_failed', retryable: true }, source: 'world-bridge', observed_at: new Date().toISOString() }; }
  };
  const tools: Record<string, RuntimeTool> = {
    get_time: timeTool(),
    get_weather: weatherTool(),
    get_world_state: { description: '读取猫的真实世界观察；available=false 表示当前不能执行动作。移动中 current 是上次到达位置。', inputSchema: z.object({}), execute: () => observe(() => getWorldState(owner.catId)) },
    get_action_status: { description: '查询已知动作的真实状态，不忙轮询。只有 arrived 才代表到达。', inputSchema: z.object({ actionId: z.uuid() }), execute: ({ actionId }) => observe(() => getActionStatus(owner.catId, actionId)) },
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
