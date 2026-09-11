/**
 * 记忆写入规则。连本机的 PG（docker compose up），每个用例建一只新猫，跑完删掉。
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, memories, memoryBlocks, messages, users } from '../src/db/schema.ts';
import { memoryFingerprint } from '../src/runtime/fingerprint.ts';
import { DEFAULT_TRAITS } from '../src/runtime/persona.ts';
import { applyCandidate } from '../src/worker/memory.ts';

let catId = '';
let sourceId = '';
const userIds: string[] = [];

beforeEach(async () => {
  const [user] = await db.insert(users).values({ name: 'vitest' }).returning();
  userIds.push(user!.id);
  const [cat] = await db
    .insert(cats)
    .values({ userId: user!.id, name: '团子', appearance: 'orange', temperament: 'slow', traits: DEFAULT_TRAITS })
    .returning();
  const [conv] = await db.insert(conversations).values({ catId: cat!.id }).returning();
  catId = cat!.id;
  sourceId = await newSource(conv!.id);
});

afterAll(async () => {
  for (const id of userIds) await db.delete(users).where(eq(users.id, id));
  await sql.end();
});

async function newSource(conversationId?: string) {
  const convId =
    conversationId ?? (await db.select().from(conversations).where(eq(conversations.catId, catId)))[0]!.id;
  const [m] = await db
    .insert(messages)
    .values({ conversationId: convId, role: 'user', text: '…', clientMessageId: randomUUID() })
    .returning();
  return m!.id;
}

const base = {
  subject: '用户',
  predicate: '喜欢的饮料',
  value: '拿铁',
  kind: 'preference' as const,
  confidence: 0.9,
  sensitivity: 'low' as const,
  explicit: false,
  correction: false,
};

const rows = () => db.select().from(memories).where(eq(memories.catId, catId));

describe('写入门槛', () => {
  it('高敏感的不写，除非用户明确要求记', async () => {
    await applyCandidate(catId, sourceId, { ...base, predicate: '病史', value: '哮喘', sensitivity: 'high' });
    expect(await rows()).toHaveLength(0);
    await applyCandidate(catId, sourceId, { ...base, predicate: '病史', value: '哮喘', sensitivity: 'high', explicit: true });
    expect(await rows()).toHaveLength(1);
  });

  it('把握不够的不写', async () => {
    await applyCandidate(catId, sourceId, { ...base, confidence: 0.4 });
    expect(await rows()).toHaveLength(0);
  });

  it('同一条来源消息重复提取不会写两遍', async () => {
    await applyCandidate(catId, sourceId, base);
    await applyCandidate(catId, sourceId, { ...base, value: '拿铁。' });
    expect(await rows()).toHaveLength(1);
  });
});

describe('同一方面有新内容', () => {
  it('偏好：新的生效，旧的留作历史', async () => {
    await applyCandidate(catId, sourceId, base);
    await applyCandidate(catId, await newSource(), { ...base, value: '美式' });
    const all = await rows();
    expect(all.find((m) => m.value === '拿铁')!.status).toBe('superseded');
    expect(all.find((m) => m.value === '美式')!.status).toBe('active');
  });

  it('事实：两条都标冲突，不静默覆盖', async () => {
    const fact = { ...base, predicate: '生日', value: '3月5日', kind: 'fact' as const };
    await applyCandidate(catId, sourceId, fact);
    await applyCandidate(catId, await newSource(), { ...fact, value: '3月15日' });
    expect((await rows()).map((m) => m.status).sort()).toEqual(['conflicted', 'conflicted']);
  });

  it('事实：用户纠正时直接用新的', async () => {
    const fact = { ...base, predicate: '生日', value: '3月5日', kind: 'fact' as const };
    await applyCandidate(catId, sourceId, fact);
    await applyCandidate(catId, await newSource(), { ...fact, value: '3月15日', correction: true });
    const all = await rows();
    expect(all.find((m) => m.value === '3月15日')!.status).toBe('active');
    expect(all.find((m) => m.value === '3月5日')!.status).toBe('superseded');
  });

  it('称呼不同的「我」和「用户」算同一个人', async () => {
    await applyCandidate(catId, sourceId, base);
    await applyCandidate(catId, await newSource(), { ...base, subject: '我', value: '美式' });
    expect((await rows()).filter((m) => m.status === 'active')).toHaveLength(1);
  });
});

describe('删除后的阻断', () => {
  it('命中阻断的不写；用户明确说记住时解除阻断', async () => {
    await db.insert(memoryBlocks).values({ catId, fingerprint: memoryFingerprint('用户', '喜欢的饮料') });
    await applyCandidate(catId, sourceId, base);
    expect(await rows()).toHaveLength(0);

    await applyCandidate(catId, await newSource(), { ...base, explicit: true });
    expect(await rows()).toHaveLength(1);
    const blocks = await db
      .select()
      .from(memoryBlocks)
      .where(and(eq(memoryBlocks.catId, catId)));
    expect(blocks).toHaveLength(0);
  });
});
