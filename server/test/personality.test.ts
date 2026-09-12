import { describe, expect, it } from 'vitest';
import { behaviorLines, compileBehavior, SLOW_WARMUP_DAYS } from '../src/runtime/behavior.ts';
import { DEFAULT_TRAITS, personaBlock } from '../src/runtime/persona.ts';
import { snapshotSchema } from '../src/world/protocol.ts';

const baseSnapshot = {
  stateVersion: 3, sceneVersion: 4 as const, destinationIds: ['house', 'grass'] as const,
  currentDestinationId: 'house' as const, targetDestinationId: 'house' as const,
  phase: 'idle' as const, action: 'sleepyNod', paused: false, runnable: true,
};

describe('性格参数表', () => {
  it('四种气质在院子里过得不一样', () => {
    const quiet = compileBehavior('quiet', DEFAULT_TRAITS);
    const curious = compileBehavior('curious', DEFAULT_TRAITS);
    const close = compileBehavior('close', DEFAULT_TRAITS);
    expect(quiet.idleScale).toBeGreaterThan(curious.idleScale * 2);
    expect(quiet.sleepWeight).toBeGreaterThan(curious.sleepWeight);
    expect(close.lookWeight).toBeGreaterThan(quiet.lookWeight);
    expect(close.placeWeights[0]!).toBeGreaterThan(curious.placeWeights[0]!);
    expect(curious.placeWeights[3]!).toBeGreaterThan(quiet.placeWeights[3]!);
    expect(close.drinkDelay[1]).toBeLessThan(quiet.drinkDelay[0]);
    expect(quiet.comesToDoor).toBe(false);
    expect(close.comesToDoor).toBe(true);
  });

  it('特征在气质的默认值上各挪一档，情绪倍数有上限', () => {
    const base = compileBehavior('quiet', DEFAULT_TRAITS);
    const lively = compileBehavior('quiet', { ...DEFAULT_TRAITS, energy: 2 });
    expect(lively.idleScale).toBeLessThan(base.idleScale);
    expect(lively.sleepWeight).toBeLessThan(base.sleepWeight);
    const homebody = compileBehavior('curious', { ...DEFAULT_TRAITS, initiative: 0 });
    expect(homebody.comesToDoor).toBe(false);
    expect(homebody.placeWeights[3]!).toBeLessThan(compileBehavior('curious', DEFAULT_TRAITS).placeWeights[3]!);
    const warm = compileBehavior('close', { ...DEFAULT_TRAITS, closeness: 2 });
    expect(warm.moodScale).toBeLessThanOrEqual(2);
    expect(warm.moodScale).toBeGreaterThan(compileBehavior('close', DEFAULT_TRAITS).moodScale);
    expect(compileBehavior('close', { ...DEFAULT_TRAITS, directness: 0 }).diarySentences).toBe(2);
  });

  it('慢热按领养日算：前三天不来门口，第四天起来', () => {
    for (let day = 0; day < SLOW_WARMUP_DAYS; day += 1) {
      expect(compileBehavior('slow', DEFAULT_TRAITS, day).comesToDoor).toBe(false);
    }
    expect(compileBehavior('slow', DEFAULT_TRAITS, SLOW_WARMUP_DAYS).comesToDoor).toBe(true);
  });

  it('作息写进性格段落，和院子里说的是同一件事', () => {
    const cat = { name: '团子', appearance: 'orange', temperament: 'quiet', traits: DEFAULT_TRAITS, createdAt: new Date('2026-01-01T00:00:00Z') };
    const block = personaBlock(cat);
    expect(block).toContain('## 你在院子里怎么过');
    expect(block).toContain('大部分时间在打盹');
    expect(block).toContain('你待在原地，不特意迎过去');
    expect(personaBlock({ ...cat, temperament: 'close' })).toContain('你会回到蘑菇屋门口坐下看着对方');
    // 慢热头几天：性格段落里说清还不熟
    expect(personaBlock({ ...cat, temperament: 'slow', createdAt: new Date() })).toContain('还不熟');
    expect(behaviorLines(compileBehavior('curious', DEFAULT_TRAITS))[0]).toContain('待不住');
  });
});

describe('世界快照带上院子里的事实', () => {
  it('老版本 App 不带这些字段也能用，默认值是平常', () => {
    const parsed = snapshotSchema.parse(baseSnapshot);
    expect(parsed.mood).toBe('calm');
    expect(parsed.weather).toBe('clear');
    expect(parsed.bowlFilledToday).toBe(false);
    expect(parsed.placesToday).toEqual([]);
  });
  it('带了就按带的来；乱填的拒收', () => {
    const parsed = snapshotSchema.parse({
      ...baseSnapshot, mood: 'sad', moodReason: '团子缩成一团，碗已经空了两天',
      dayPhase: 'night', weather: 'rain', bowlFilledToday: true,
      lastDrinkAt: '2026-09-12T10:00:00Z', placesToday: ['蘑菇屋', '草丛'],
    });
    expect(parsed.mood).toBe('sad');
    expect(parsed.lastDrinkAt).toBe('2026-09-12T10:00:00Z');
    expect(snapshotSchema.safeParse({ ...baseSnapshot, mood: '很难过' }).success).toBe(false);
    expect(snapshotSchema.safeParse({ ...baseSnapshot, lastDrinkAt: '昨天' }).success).toBe(false);
  });
});

describe('院子里的事实进聊天', () => {
  const world = {
    available: true as const, error: null, sessionId: 's', generation: 'g', observedAt: new Date(),
    ...baseSnapshot, destinationIds: ['house', 'grass'] as never,
  };
  it('只写当天事实，平常时不提情绪', async () => {
    const { yardBlock } = await import('../src/runtime/yard.ts');
    const block = yardBlock({ ...world, mood: 'calm', moodReason: '', dayPhase: 'day', weather: 'clear', bowlFilledToday: false, lastDrinkAt: null, placesToday: [] } as never)!;
    expect(block).toContain('## 院子里');
    expect(block).toContain('你在蘑菇屋门口');
    expect(block).toContain('碗里今天还没有水');
    expect(block).toContain('你今天还没喝过水');
    expect(block).not.toContain('你现在平常');
  });
  it('有情绪、下雨、去过的地方都照实说', async () => {
    const { yardBlock } = await import('../src/runtime/yard.ts');
    const block = yardBlock({
      ...world, currentDestinationId: 'grass', targetDestinationId: 'grass', phase: 'idle',
      mood: 'sulk', moodReason: '团子背对着门口，碗空了一整天', dayPhase: 'night', weather: 'rain',
      bowlFilledToday: false, lastDrinkAt: null, placesToday: ['蘑菇屋', '草丛', '蘑菇屋'],
    } as never)!;
    expect(block).toContain('你在草丛');
    expect(block).toContain('夜里，在下雨');
    expect(block).toContain('今天去过：蘑菇屋、草丛。');
    expect(block).toContain('你现在不高兴：团子背对着门口，碗空了一整天');
  });
  it('世界不可用时不写这一块', async () => {
    const { yardBlock } = await import('../src/runtime/yard.ts');
    expect(yardBlock(null)).toBeNull();
    expect(yardBlock({ available: false, error: 'world_offline' } as never)).toBeNull();
  });
});
