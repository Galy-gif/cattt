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

it('记忆管理增量迁移保留旧正文与有效来源，只隔离缺来源或串号的条目', async () => {
  await sql.begin(async tx => {
    await tx`create temp table cats (id text) on commit drop`;
    await tx`create temp table conversations (id text, cat_id text) on commit drop`;
    await tx`create temp table messages (id text, conversation_id text, role text, text text) on commit drop`;
    await tx`create temp table memories (id text, cat_id text, source_message_id text, status text, value text) on commit drop`;
    await tx`create temp table turns (id text) on commit drop`;
    await tx`insert into cats values ('cat-a'), ('cat-b')`;
    await tx`insert into conversations values ('a', 'cat-a'), ('b', 'cat-b')`;
    await tx`insert into messages values ('valid', 'a', 'user', '原话保留'), ('foreign', 'b', 'user', '他人原话'), ('reply', 'a', 'cat', '猫的猜测')`;
    await tx`insert into memories values ('one', 'cat-a', 'valid', 'active', '有效旧记忆'), ('two', 'cat-a', 'missing', 'active', '待核对'), ('three', 'cat-a', 'foreign', 'active', '串号'), ('four', 'cat-a', 'reply', 'active', '猜测')`;
    await tx.unsafe(readFileSync(new URL('../drizzle/0005_military_veda.sql', import.meta.url), 'utf8'));
    expect(await tx`select id, status, value from memories order by id`).toEqual([
      { id: 'four', status: 'conflicted', value: '猜测' }, { id: 'one', status: 'active', value: '有效旧记忆' },
      { id: 'three', status: 'conflicted', value: '串号' }, { id: 'two', status: 'conflicted', value: '待核对' },
    ]);
    expect(await tx`select text, context_allowed from messages where id = 'valid'`).toEqual([{ text: '原话保留', context_allowed: true }]);
    expect(await tx`select learn_memories, use_memories from cats where id = 'cat-a'`).toEqual([{ learn_memories: true, use_memories: true }]);
  });
});
