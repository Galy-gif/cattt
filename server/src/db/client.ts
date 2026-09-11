import { sql as raw } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export const sql = postgres(config.DATABASE_URL, { max: 10, onnotice: () => {} });
export const db = drizzle(sql, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * 运行状态的时间一律用数据库的钟。应用和数据库的钟可能差几十秒
 * （本机 Docker 虚拟机就慢了 22 秒），心跳用应用的钟、判卡住用数据库的钟就会判错。
 */
export const dbNow = () => raw`now()`;
