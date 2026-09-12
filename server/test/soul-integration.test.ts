import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, sql } from '../src/db/client.ts';
import { cats, conversations, messages, users } from '../src/db/schema.ts';
import { DEFAULT_TRAITS } from '../src/runtime/persona.ts';
import { adjustSoul, getSoul, invalidateSoulSources, setRuntimeState } from '../src/soul/service.ts';
const ids: string[] = [];
async function fixture() {
  const [user] = await db.insert(users).values({ name: 'soul-test' }).returning(); ids.push(user!.id);
  const [cat] = await db.insert(cats).values({ userId: user!.id, name: '团子', appearance: 'orange', temperament: 'slow', traits: DEFAULT_TRAITS }).returning();
  const [conv] = await db.insert(conversations).values({ catId: cat!.id }).returning();
  const [message] = await db.insert(messages).values({ conversationId: conv!.id, role: 'user', text: '以后简短一点', clientMessageId: randomUUID() }).returning();
  return { catId: cat!.id, sourceMessageId: message!.id };
}
afterAll(async () => { for (const id of ids) await db.delete(users).where(eq(users.id, id)); await sql.end(); });
describe('Soul 来源与隔离', () => {
  it('每猫独立，重复明确调整不增长版本，撤回清理所有历史正文', async () => {
    const a = await fixture(); const b = await fixture();
    const input = { sourceMessageId: a.sourceMessageId, adjustment: { kind: 'response_length', value: 'brief' }, reason: '用户明确调整' };
    const [one, two] = await Promise.all([adjustSoul(a.catId, input), adjustSoul(a.catId, input)]);
    expect(one.version).toBe(two.version);
    expect((await getSoul(b.catId)).soul.entries).toHaveLength(0);
    await expect(adjustSoul(b.catId, input)).rejects.toThrow('来源必须');
    await setRuntimeState(a.catId, { sourceMessageId: a.sourceMessageId, energy: 'resting', willingness: 'quiet', durationMinutes: 10 });
    await db.transaction(tx => invalidateSoulSources(tx, a.catId, [a.sourceMessageId]));
    const result = await getSoul(a.catId);
    expect(result.soul.entries).toHaveLength(0); expect(result.runtime.state.energy).toBe('baseline');
    await expect(adjustSoul(a.catId, input)).rejects.toThrow('撤回');
  });
});
