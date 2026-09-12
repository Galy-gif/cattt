import { z } from 'zod';
import type { RuntimeTool } from './agent.ts';

export const timeZoneSchema = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, '无效 IANA 时区');

export function timeTool(now: () => Date = () => new Date()): RuntimeTool {
  return {
    description: '查询真实当前时间。默认 Asia/Shanghai 是开发者版回退时区，不代表用户所在城市。',
    inputSchema: z.object({ timeZone: timeZoneSchema.optional() }),
    execute: async ({ timeZone = 'Asia/Shanghai' }) => {
      const instant = now();
      return {
        status: 'succeeded', source: 'system-clock', observed_at: instant.toISOString(),
        data: { instant: instant.toISOString(), timeZone, local: new Intl.DateTimeFormat('zh-CN', { timeZone, dateStyle: 'full', timeStyle: 'long' }).format(instant) },
      };
    },
  };
}
