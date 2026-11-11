/** 本机/受控运维CLI，仅聚合；无HTTP入口、无原文或身份参数。 */
import { outcomeMetrics } from "../src/agent/inference.ts";
import { redis } from "../src/redis.ts";
import { sql } from "../src/db/client.ts";
console.log(JSON.stringify(await outcomeMetrics(), null, 2));
await redis.quit();
await sql.end();
