import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.ts';
import { workerReports } from '../src/db/schema.ts';
import { processErrand as work, type ExecutorOptions } from '../src/agent/executor.ts';
import { processDailyDiary as write } from '../src/agent/daily-diary.ts';
import { readDiary as read, type DiaryReader } from '../src/worker/diary.ts';
import { processReport } from '../src/agent/reports.ts';
export async function deliverReports(sourceId:string,now?:Date) {
 for(const report of await db.select().from(workerReports).where(eq(workerReports.sourceId,sourceId))) await processReport(report.id,{now});
}
export async function processErrand(id:string,options:ExecutorOptions={}) {
 await work(id,options);await deliverReports(id,options.now?.());
}
export async function processDailyDiary(id:string,options:Parameters<typeof write>[1]={}) {
 await write(id,options);await deliverReports(id);
}
export async function readDiary(id:string,version:string,jobId:string,reader?:DiaryReader) {
 await read(id,version,jobId,reader);await deliverReports(id);
}
