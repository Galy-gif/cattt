import { and, eq } from 'drizzle-orm';
import type { Tx } from '../db/client.ts';
import { asyncJobs, workerReports, type WorkerReportPayload } from '../db/schema.ts';

/** 汇报和前台待办同事务提交；通知只是唤醒信号，正文只保存在 PG。 */
export async function submitWorkerReport(tx: Tx, catId: string, sourceId: string, version: string, payload: WorkerReportPayload) {
  await tx.insert(workerReports).values({catId,sourceId,version,payload}).onConflictDoNothing();
  const [report] = await tx.select().from(workerReports).where(and(eq(workerReports.sourceId,sourceId),eq(workerReports.version,version)));
  await tx.insert(asyncJobs).values({kind:'report',sourceId,objectId:report!.id,version}).onConflictDoNothing();
}
