import { expect,it } from 'vitest';
import { budgetMessages, estimateRequest, INPUT_BUDGET } from '../src/runtime/input-budget.ts';
it('保留当前原话，按完整用户轮次移除旧历史且不原地修改',()=>{
 const messages:any[]=[{role:'user',content:'旧'.repeat(80000)},{role:'assistant',content:'回答'},{role:'user',content:'现在🙂问题'}];
 const original=JSON.stringify(messages); const result=budgetMessages('人格',messages,{});
 expect(result).toEqual([messages[2]]);expect(JSON.stringify(messages)).toBe(original);
 expect(estimateRequest('人格',result,{})).toBeLessThanOrEqual(INPUT_BUDGET);
});
it('必要问题超限明确失败',()=>expect(()=>budgetMessages('人格',[{role:'user',content:'🙂'.repeat(100000)}],{})).toThrow('model_input_budget'));
it('当前工具调用与结果保持成对',()=>{
 const messages:any[]=[{role:'user',content:'旧'.repeat(80000)},{role:'assistant',content:'旧答'},{role:'user',content:'现在'}, {role:'assistant',content:[{type:'tool-call',toolCallId:'a',toolName:'x',input:{}}]}, {role:'tool',content:[{type:'tool-result',toolCallId:'a',toolName:'x',output:{type:'text',value:'结果'}}]}];
 expect(budgetMessages('',messages,{})).toEqual(messages.slice(2));
});
it('同轮旧工具观察可按完整配对移除，保留最新工具轮次',()=>{
 const pair=(id:string,text:string):any[]=>[{role:'assistant',content:[{type:'tool-call',toolCallId:id,toolName:'x',input:{}}]},{role:'tool',content:[{type:'tool-result',toolCallId:id,toolName:'x',output:{type:'text',value:text}}]}];
 const messages:any[]=[{role:'user',content:'我的当前原话'},...pair('old','旧观察'.repeat(30000)),...pair('new','新观察')];
 expect(budgetMessages('',messages,{})).toEqual([messages[0],...messages.slice(3)]);
});
it('worker保留原托付与所有补充，不能为预算删掉用户输入',()=>{
 const history:any[]=[{role:'user',content:'原托付'.repeat(20000)},{role:'user',content:'补充'}];
 expect(()=>budgetMessages('',history,{},true)).toThrow('model_input_budget');
});
it('输入预算错误通过现有聊天错误契约给出可识别code',async()=>{
 const {classifyModelError}=await import('../src/runtime/model.ts');
 expect(classifyModelError(new Error('model_input_budget: 必需上下文超过输入预算'))).toMatchObject({code:'model_input_budget',retryable:false});
});
