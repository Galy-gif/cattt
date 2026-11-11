import { statSync } from 'node:fs';
import postgres from 'postgres';
const sql=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:2});
try {
 if(Date.now()-statSync('/tmp/cattt-worker-heartbeat').mtimeMs>45000)throw new Error('worker heartbeat expired');
 await sql`select 1`;
 await sql.end();
} catch { await sql.end({timeout:1}); process.exitCode=1; }
