import { describe, expect, it } from 'vitest';
import { boundaryOverlaps, rankMemories, recallQuery, selectMemories, type RecallItem } from '../src/memory/relevance.ts';
const item = (id: string, predicate: string, value: string, extra: Partial<RecallItem> = {}): RecallItem => ({
  id, predicate, value, subject: '用户', fingerprint: id, explicit: false, sensitivity: 'low',
  lastConfirmedAt: new Date('2026-01-01'), revision: 0, ...extra,
});
describe('相关记忆排序', () => {
  it('旧饮食偏好能胜过大量新近无关条目', () => {
    const old = item('diet', '忌口', '不吃香菜');
    const noise = Array.from({ length: 80 }, (_, i) => item(`noise-${i}`, `收藏编号${i}`, `蓝色石头${i}`, { explicit: true, lastConfirmedAt: new Date() }));
    const selected = selectMemories(rankMemories([old, ...noise], '帮我想想晚饭吃什么'));
    expect(selected.map(x => x.id)).toEqual(['diet']);
  });
  it('问一件事最后怎么样能找回结果，普通的“怎么样”不会触发结果查询', () => {
    const result = item('outcome', '面试结果', '没有通过');
    const concern = item('plan', '面试安排', '担心现场拆解产品题');
    const query = '之前我说先放一放的那件事，现在想聊聊了。你记得最后怎么样，还有我当时最担心哪一部分吗？';
    expect(selectMemories(rankMemories([result, concern], query))).toEqual(expect.arrayContaining([result, concern]));
    expect(selectMemories(rankMemories([result], '天气怎么样？'))).toEqual([]);
  });
  it('语义扩词能找到没有相同字面的旧偏好，不编造新事实', () => {
    const old = item('book', '阅读偏好', '喜欢硬科幻小说');
    expect(selectMemories(rankMemories([old], '找本烧脑的读物'))).toEqual([]);
    expect(selectMemories(rankMemories([old], '找本烧脑的读物', ['阅读', '小说', '科幻']))).toEqual([old]);
  });
  it('不因明确要求和新近确认注入无关内容', () => {
    const row = item('coffee', '饮品偏好', '只喝无咖啡因咖啡', { explicit: true, lastConfirmedAt: new Date() });
    expect(selectMemories(rankMemories([row], '明天天气怎么样'))).toEqual([]);
  });
  it('高敏感内容不能靠扩词入选，必须明确保存且问题直接提到', () => {
    const high = item('health', '花生过敏', '不能吃花生', { explicit: true, sensitivity: 'high' });
    expect(selectMemories(rankMemories([high], '晚饭吃什么', ['花生', '过敏']))).toEqual([]);
    expect(selectMemories(rankMemories([high], '我的花生过敏吃饭要注意什么'))).toEqual([high]);
    expect(selectMemories(rankMemories([{ ...high, explicit: false }], '花生过敏'))).toEqual([]);
  });
  it('最多8条、2400字符、同一方面只带一份，不截断限制条件', () => {
    const rows = Array.from({ length: 15 }, (_, i) => item(String(i), `咖啡偏好${i}`, '咖啡不加糖'));
    expect(selectMemories(rankMemories(rows, '咖啡'))).toHaveLength(8);
    const long = item('long', '咖啡', '甲'.repeat(2500) + '但是不能喝');
    const short = item('short', '咖啡', '可以喝，但不能加糖');
    expect(selectMemories(rankMemories([long, short], '咖啡'))).toEqual([short]);
    expect(selectMemories(rankMemories([short, { ...short, id: 'copy' }], '咖啡'))).toHaveLength(1);
  });
  it('明确的表达偏好保留，普通兴趣不会被当成长期指令', () => {
    const style = item('style', '回答方式', '简短、少用术语', { explicit: true });
    const hobby = item('hobby', '喜欢的东西', '旧相机', { explicit: true });
    expect(selectMemories(rankMemories([style, hobby], '晚饭吃什么'))).toEqual([style]);
  });
  it('回避话题的近邻记忆保守排除', () => {
    expect(boundaryOverlaps(item('exam', '考试安排', '下周复习'), '考试成绩')).toBe(true);
    expect(boundaryOverlaps(item('book', '阅读偏好', '科幻'), '考试成绩')).toBe(false);
  });
  it('只有接续请求借用上一句；寒暄与新话题不带回旧主题', () => {
    expect(recallQuery('换一本', '推荐一本小说')).toContain('推荐一本小说');
    expect(recallQuery('好的', '推荐一本小说')).toBe('好的');
    expect(recallQuery('晚饭吃什么', '推荐一本小说')).toBe('晚饭吃什么');
  });
});
