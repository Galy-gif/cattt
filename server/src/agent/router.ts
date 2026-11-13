import { generateText, Output } from 'ai';
import { z } from 'zod';
import { routerSlot, recordModelCall } from '../runtime/model.ts';
export const routeOutput = z.object({
  decision: z.literal('attach'), ticket_ids: z.array(z.uuid()).min(1).max(8), merge: z.boolean(),
  text: z.string().trim().min(1).max(120),
  rule_assessments: z.array(z.object({rule_id:z.literal('followup_due'),matched:z.literal(true),reason:z.string().max(200)})).length(1),
});
export type RouteSnapshot = { persona:string; rules:unknown; version:number; tickets:{id:string;goal:string}[]; recent:{id:string;text:string}[] };
/** 输入预算的保守估算，不是供应商精确分词：中文每字1 token，其余每4字符1 token。 */
export function estimateTokens(value:string) {
 const chinese=[...value].filter(c=>/\p{Script=Han}/u.test(c)).length;
 return chinese+Math.ceil(([...value].length-chinese)/4);
}
export function routerInput(snapshot:RouteSnapshot) {
 const system=snapshot.persona+'\n只为用户亲口保存的约定措辞。到期必须发送；ticket_ids恰好覆盖本批，merge=true。text为120字内一条自然提问，单件约定只问一件事。用户当时的担心不等于事情真的发生；把结果留给对方说。直接开口，不报时，不复述保存过程、不加时间人名或新事实，不含换行列表，不说记下了、提醒、任务、打卡。';
 const card={rules:snapshot.rules,version:snapshot.version,tickets:snapshot.tickets,recent:snapshot.recent.slice(0,6).map(m=>({...m,text:m.text.slice(0,120)}))};
 while(estimateTokens(system+JSON.stringify(card))>3000 && card.recent.some(m=>m.text.length>8))
   card.recent=card.recent.map(m=>({...m,text:m.text.slice(0,Math.max(8,Math.floor(m.text.length*.8)))}));
 if(estimateTokens(system+JSON.stringify(card))>3000) throw new Error('router_input_budget');
 return {system,card};
}
/** 轻量防添事实：识别显式日期、相对时间、常见称呼/姓名形状；不声称通用NER或语义覆盖。 */
export function reviewRoute(raw:unknown,snapshot:RouteSnapshot) {
 const r=routeOutput.parse(raw);
 if(r.ticket_ids.length!==snapshot.tickets.length || new Set(r.ticket_ids).size!==snapshot.tickets.length || !snapshot.tickets.every(t=>r.ticket_ids.includes(t.id)) || (snapshot.tickets.length>1&&!r.merge)) throw new Error('route_tickets');
 if(/[\r\n]|记下了|提醒|任务|打卡|(?:^|\s)(?:[-*•]|\d+[.、])/.test(r.text)) throw new Error('route_wording');
 const known=snapshot.tickets.map(t=>t.goal).concat(snapshot.recent.map(m=>m.text)).join('\n');
 const facts=r.text.match(/\d{4}[-年/]\d{1,2}(?:[-月/]\d{1,2}日?)?|\d{1,2}[:：]\d{2}|(?:今天|明天|后天|昨天|明晚|今晚|下周|周[一二三四五六日天])|(?:早上|上午|中午|下午|晚上)?[一二三四五六七八九十两\d]+[点时](?:半|[一二三四五六七八九十\d]+分)?|(?:小|老)[王李张刘陈赵周吴郑孙]|[张王李刘陈赵周吴郑孙][\p{Script=Han}]{1,2}?(?=说|也|陪|和|去)|\b[A-Z][a-z]{2,}\b/gu)??[];
 if(facts.some(f=>!known.includes(f))) throw new Error('route_new_fact');
 return r.text;
}
export function followupText(items:{goal:string}[],overdue=false) {
 const topics=items.map(t=>t.goal.replace(/^(?:请|再)?(?:问我|提醒我|聊聊)/,'').replace(/[？?。！!]+$/,'').trim());
 if(overdue){
 const budget=Math.max(4,Math.floor((120-34-2*items.length)/items.length));
 const short=topics.map(s=>s.length>budget?s.slice(0,budget)+'…':s);
 return `之前说起${short.join('、')}，我留在这封信里了。想聊的时候，我在。`;
 }
 const budget=Math.max(5,Math.floor((120-5*items.length)/items.length));
 return topics.map((s,i)=>(i?'还有，':'')+(s.length>budget?s.slice(0,budget)+'…':s)+'？').join('');
}
export async function routeFollowup(snapshot:RouteSnapshot):Promise<unknown> {
 const slot=routerSlot(),started=performance.now();let usage=null;
 const {system,card}=routerInput(snapshot);
 try {
 const result=await generateText({model:slot.model,providerOptions:slot.providerOptions,output:Output.object({schema:routeOutput}),maxRetries:0,maxOutputTokens:700,abortSignal:AbortSignal.timeout(15000),system,prompt:JSON.stringify(card)});
 usage=result.usage;return result.output;
 }finally{await recordModelCall({purpose:'route',modelId:slot.modelId,usage,latencyMs:Math.round(performance.now()-started)});}
}
