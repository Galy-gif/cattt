import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { estimateTokens, routerInput, reviewRoute, followupText, type RouteSnapshot } from '../src/agent/router.ts';
const id = randomUUID();
const snapshot: RouteSnapshot = {persona:'你是团子。',rules:[],version:0,tickets:[{id,goal:'问我面试怎么样'}],recent:[]};
const result = (text: string, ids = [id]) => ({decision:'attach',ticket_ids:ids,merge:true,text,rule_assessments:[{rule_id:'followup_due',matched:true,reason:'亲口约定'}]});
it('接受换说法，ID恰好覆盖本批；不再要求逐字复制goal',()=>{
 expect(reviewRoute(result('面试聊得还顺利吗？'),snapshot)).toBe('面试聊得还顺利吗？');
 for(const ids of [[],[id,id],[randomUUID()]]) expect(()=>reviewRoute(result('聊得怎么样？',ids),snapshot)).toThrow();
});
it('复核120字、单条文字、禁词和快照外的时间或人名启发式',()=>{
 for(const text of ['猫'.repeat(121),'面试怎样？\n看牙呢？','1. 面试\n2. 比赛','记下了','提醒你面试','新任务','来打卡','明天见','周五见','下午三点见','2026-12-15见','张伟说面试很好','小王陪你去','Alice也去']) expect(()=>reviewRoute(result(text),snapshot),text).toThrow();
 expect(reviewRoute(result('面试怎么样，张伟也去了？'),{...snapshot,recent:[{id:randomUUID(),text:'张伟陪我面试'}]})).toContain('张伟');
});
it('按字符估token，六条中文聊天仍保留；超长内容压短而非按字节全删',()=>{
 expect(estimateTokens('团子abc猫d')).toBe(4);
 const recent = Array.from({length:6},()=>({id:randomUUID(),text:'周末我想和团子聊聊'.repeat(12)}));
 const input=routerInput({...snapshot,recent});
 expect(input.card.recent).toHaveLength(6);
 expect(input.card.recent.every(x=>x.text.length>50)).toBe(true);
 expect(estimateTokens(input.system+JSON.stringify(input.card))).toBeLessThanOrEqual(3000);
 const huge=routerInput({...snapshot,recent:recent.map(x=>({...x,text:x.text.repeat(100)}))});
 expect(huge.card.recent).toHaveLength(6);
 expect(estimateTokens(huge.system+JSON.stringify(huge.card))).toBeLessThanOrEqual(3000);
});
it('团子模板短而自然，多件可读，过期留信不催问',()=>{
 expect(followupText([{goal:'问我面试怎么样'}])).toBe('面试怎么样？');
 expect(followupText([{goal:'面试怎么样'},{goal:'看牙怎么样'}])).toBe('面试怎么样？还有，看牙怎么样？');
 expect(followupText([{goal:'面试怎么样'}],true)).toContain('想聊的时候，我在。');
 expect(followupText([{goal:'面试怎么样'}],true)).not.toContain('？');
});
