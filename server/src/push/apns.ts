import { connect } from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';
export type PushRequest={token:string;environment:'sandbox'|'production';topic:string;apnsId:string;payload:Record<string,unknown>};
export type PushResponse={status:number;reason?:string;timestamp?:number};
export type ApnsRequest={origin:string;headers:Record<string,string>;body:string};
export type PushTransport=(request:PushRequest)=>Promise<PushResponse>;
/** 官方HTTP/2 + TLS，不从客户端接收供应商URL。网络中断抛给调用方，保留不可判定状态。 */
export async function apnsHTTP2(input:ApnsRequest):Promise<PushResponse>{
 return new Promise((resolve,reject)=>{
  const client=connect(input.origin);let settled=false;
  const finish=(error?:Error,value?:PushResponse)=>{if(settled)return;settled=true;client.close();if(error)reject(error);else resolve(value!);};
  client.on('error',e=>finish(e));const req=client.request(input.headers);let status=0,body='';
  req.on('response',h=>status=Number(h[':status']));req.setEncoding('utf8');req.on('data',chunk=>{body+=chunk;if(body.length>10000)req.close();});
  req.setTimeout(10000,()=>{req.destroy(new Error('apns_timeout'));});req.on('error',e=>finish(e));req.on('end',()=>{let data:any={};try{data=JSON.parse(body);}catch{}finish(undefined,{status,reason:data.reason,timestamp:data.timestamp});});req.end(input.body);
 });
}
export function createApnsTransport(options:{teamId:string;keyId:string;privateKey:string;request?:(req:ApnsRequest)=>Promise<PushResponse>}):PushTransport{
 const key=importPKCS8(options.privateKey,'ES256');let jwt='',issued=0;
 return async input=>{
  const now=Math.floor(Date.now()/1000);
  // 50分钟更新，遵守Apple不早于20分钟、不晚于60分钟的建议。
  if(!jwt||now-issued>=3000){jwt=await new SignJWT({}).setProtectedHeader({alg:'ES256',kid:options.keyId}).setIssuer(options.teamId).setIssuedAt(now).sign(await key);issued=now;}
  return (options.request??apnsHTTP2)({origin:input.environment==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com',headers:{':method':'POST',':path':'/3/device/'+input.token,authorization:'bearer '+jwt,'apns-topic':input.topic,'apns-id':input.apnsId,'apns-collapse-id':input.apnsId,'apns-push-type':'alert','apns-priority':'10','apns-expiration':'0','content-type':'application/json'},body:JSON.stringify(input.payload)});
 };
}
