/**
 * 建一个开发者账号，连同一只默认的猫（团子）和它的对话。
 *   pnpm create-dev-user 小明
 * token 只打印这一次，库里只存哈希。
 */
import { sql } from '../src/db/client.ts';
import { createDevUser } from '../src/dev-user.ts';

const name = process.argv[2] ?? 'dev';
const { token } = await createDevUser(name);
console.log(`已建账号「${name}」，猫：团子。\n\ntoken（只显示这一次）：\n${token}\n`);
await sql.end();
