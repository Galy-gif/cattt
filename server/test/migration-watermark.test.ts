import { readFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { sql } from '../src/db/client.ts';

afterAll(() => sql.end());
it('存量删除阻断回填每猫消息水位，已有有效水位保留', async () => {
  // 临时表还原旧迁移 DEFAULT 0 的数据形态，不修改测试库里其他用例的阻断。
  await sql.begin(async tx => {
    await tx`create temp table memory_blocks (cat_id text, source_seq integer default 0) on commit drop`;
    await tx`create temp table conversations (id text, cat_id text) on commit drop`;
    await tx`create temp table messages (seq integer, conversation_id text) on commit drop`;
    await tx`insert into conversations values ('a', 'cat-a'), ('b', 'cat-b')`;
    await tx`insert into messages values (10, 'a'), (20, 'a'), (100, 'b')`;
    await tx`insert into memory_blocks values ('cat-a', 0), ('cat-b', 50), ('cat-empty', 0)`;
    await tx.unsafe(readFileSync(new URL('../drizzle/0004_memory_block_watermark.sql', import.meta.url), 'utf8'));
    expect(await tx`select * from memory_blocks order by cat_id`).toEqual([
      { cat_id: 'cat-a', source_seq: 20 }, { cat_id: 'cat-b', source_seq: 50 }, { cat_id: 'cat-empty', source_seq: 0 },
    ]);
  });
});
