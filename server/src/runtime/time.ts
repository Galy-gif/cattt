import { eq } from 'drizzle-orm';
import { db, type Tx } from '../db/client.ts';
import { cats, users } from '../db/schema.ts';
import { z } from 'zod';
import type { RuntimeTool } from './agent.ts';

export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';

export async function userTimeZone(catId: string, reader: Tx | typeof db = db): Promise<string> {
  const [owner] = await reader.select({ timeZone: users.timeZone }).from(users)
    .innerJoin(cats, eq(cats.userId, users.id)).where(eq(cats.id, catId));
  return owner?.timeZone ?? DEFAULT_TIME_ZONE;
}

export const timeZoneSchema = z.string().max(100).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return !/^[+-]/.test(value); } catch { return false; }
}, '无效 IANA 时区');

export function timeTool(now: () => Date = () => new Date(), defaultTimeZone = DEFAULT_TIME_ZONE): RuntimeTool {
  return {
    description: '查询真实当前时间。默认使用用户上报的时区；未上报时回退 Asia/Shanghai，不代表用户所在城市。',
    inputSchema: z.object({ timeZone: timeZoneSchema.optional() }),
    execute: async ({ timeZone = defaultTimeZone }) => {
      const instant = now();
      return {
        status: 'succeeded', source: 'system-clock', observed_at: instant.toISOString(),
        data: { instant: instant.toISOString(), timeZone, local: new Intl.DateTimeFormat('zh-CN', { timeZone, dateStyle: 'full', timeStyle: 'long' }).format(instant) },
      };
    },
  };
}
