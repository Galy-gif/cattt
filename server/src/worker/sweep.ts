import { and, inArray, sql } from 'drizzle-orm';
import { STALE_TURN_MS } from '../config.ts';
import { db, dbNow } from '../db/client.ts';
import { turns } from '../db/schema.ts';
import { publish } from '../turns/events.ts';

/**
 * 进程崩了或被杀，进行中的回复就没人管了。生成时每 5 秒写一次心跳，
 * 超过 STALE_TURN_MS 没心跳的判失败，并给还在听的客户端发一个可重试的错误。
 */
export async function sweepStaleTurns() {
  const stale = await db
    .update(turns)
    .set({ status: 'failed', error: 'stale: no heartbeat', finishedAt: dbNow() })
    .where(
      and(
        inArray(turns.status, ['queued', 'generating']),
        sql`coalesce(${turns.heartbeatAt}, ${turns.createdAt}) < now() - ${`${STALE_TURN_MS} milliseconds`}::interval`,
      ),
    )
    .returning({ id: turns.id });

  for (const t of stale) {
    await publish(t.id, { event: 'error', data: { code: 'stale', retryable: true } });
  }
  if (stale.length > 0) console.log(`[sweep] ${stale.length} 条卡住的回复判为失败`);
}
