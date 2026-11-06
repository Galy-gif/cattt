/** 固定的合成对照；扩词受控，仅评估排序，不代表真实模型理解质量。 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { rankMemories, selectMemories, type RecallItem } from '../src/memory/relevance.ts';
const old = new Date('2026-01-01'); const recent = new Date('2026-10-15');
const row = (id: string, predicate: string, value: string, fresh = false): RecallItem => ({ id, predicate, value, subject: '用户', fingerprint: id, sensitivity: 'low', explicit: fresh, revision: 0, lastConfirmedAt: fresh ? recent : old });
const corpus = [row('diet', '忌口', '不吃香菜'), row('taste', '口味', '喜欢清淡少油'), row('drink', '饮品选择', '只喝无咖啡因咖啡'), row('book', '阅读偏好', '喜欢硬科幻小说'), row('film', '电影偏好', '喜欢悬疑片'), row('exercise', '运动偏好', '周末喜欢游泳'),
  ...Array.from({ length: 80 }, (_, i) => row(`noise-${i}`, `收藏编号${i}`, `蓝色石头${i}`, true))];
// 旧相关条目也必须超出非明确的20条窗口。
const normalNoise = Array.from({ length: 40 }, (_, i) => ({ ...row(`normal-${i}`, `书签编号${i}`, `红色标记${i}`, true), explicit: false }));
corpus.push(...normalNoise);
const previous = [...corpus.filter(x => x.explicit).slice(0, 30), ...normalNoise.slice(0, 20)];
const cases = [
  { query: '晚饭吃什么', expanded: ['饮食', '忌口', '口味'], expected: ['diet', 'taste'] },
  { query: '想喝点能提神的', expanded: ['饮品', '咖啡', '茶饮'], expected: ['drink'] },
  { query: '找本烧脑的读物', expanded: ['阅读', '科幻', '小说'], expected: ['book'] },
  { query: '推荐一部电影', expanded: [], expected: ['film'] },
  { query: '周末做什么运动好', expanded: [], expected: ['exercise'] },
  { query: '你好', expanded: [], expected: [] },
  { query: '明天天气怎么样', expanded: [], expected: [] },
  { query: '帮我解释一下二次方程', expanded: ['数学', '方程'], expected: [] },
];
const results = cases.map(c => {
  const start = performance.now();
  const local = selectMemories(rankMemories(corpus, c.query)).map(x => x.id);
  const selected = selectMemories(rankMemories(corpus, c.query, c.expanded)).map(x => x.id);
  const elapsedMs = performance.now() - start;
  assert.deepEqual([...selected].sort(), [...c.expected].sort(), c.query);
  return { ...c, previous: previous.map(x => x.id), local, selected, elapsedMs: Number(elapsedMs.toFixed(3)),
    previousRelevant: previous.filter(x => c.expected.includes(x.id)).length,
    currentRelevant: selected.filter(id => c.expected.includes(id)).length,
    currentUnrelated: selected.filter(id => !c.expected.includes(id)).length };
});
const directory = new URL('../../outputs/memory-recall-review/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('固定用例对照.json', directory), JSON.stringify({ evidence: '合成语料与受控扩词；未调用真实模型', corpusSize: corpus.length, passed: results.length,
  previousRecall: '旧实现30条明确记忆+20条近期普通记忆', currentRecall: '许可过滤后本地排序+受控扩词，最多8条2400字', results }, null, 2));
console.log(JSON.stringify({ passed: results.length, corpusSize: corpus.length, beforeRelated: results.reduce((n, r) => n + r.previousRelevant, 0), afterRelated: results.reduce((n, r) => n + r.currentRelevant, 0), unrelated: results.reduce((n, r) => n + r.currentUnrelated, 0), maxLocalMs: Math.max(...results.map(r => r.elapsedMs)) }));
