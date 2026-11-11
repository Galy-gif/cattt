import { Hono } from 'hono';
import { z } from 'zod';
import { and,eq,sql } from 'drizzle-orm';
import type { Env } from '../api/auth.ts';
import { registerDevice } from './service.ts';
import { db } from '../db/client.ts';
import { devices,pushNotifications,messages,mailboxLetters }  from '../db/schema.ts';
export const deviceRoutes=new Hono<Env>();
deviceRoutes.post('/devices',async c=>{
 const input=z.object({token:z.string().regex(/^[a-fA-F0-9]{32,512}$/),environment:z.enum(['sandbox','production']),topic:z.string().min(1).max(200)}).strict().safeParse(await c.req.json().catch(()=>null));if(!input.success)return c.json({error:{code:'bad_request'}},400);
 try{const d=await registerDevice(c.get('owner').userId,input.data);return c.json({id:d.id});}catch{return c.json({error:{code:'device_invalid'}},400);}
});
deviceRoutes.delete('/devices/:id',async c=>{const id=z.uuid().safeParse(c.req.param('id'));if(!id.success)return c.json({error:{code:'not_found'}},404);const rows=await db.update(devices).set({invalidAt:sql`now()`}).where(and(eq(devices.id,id.data),eq(devices.userId,c.get('owner').userId))).returning();return rows.length?c.json({ok:true}):c.json({error:{code:'not_found'}},404);});

deviceRoutes.get('/notifications/:id',async c=>{
 const parsed=z.uuid().safeParse(c.req.param('id'));if(!parsed.success)return c.json({error:{code:'not_found'}},404);
 const [p]=await db.select().from(pushNotifications).where(and(eq(pushNotifications.id,parsed.data),eq(pushNotifications.catId,c.get('owner').catId)));
 if(!p||p.status==='dropped')return c.json({error:{code:'not_found'}},404);
 if(p.payload.route==='chat'){
  const [m]=await db.select().from(messages).where(and(eq(messages.id,String(p.payload.message_id)),eq(messages.conversationId,c.get('owner').conversationId),eq(messages.contextAllowed,true)));
  if(!m)return c.json({error:{code:'not_found'}},404);
  return c.json({route:'chat',message:{id:m.id,seq:m.seq,role:m.role,text:m.text,status:m.status,client_message_id:m.clientMessageId,diary_entry_id:m.diaryEntryId,turn_id:m.turnId,ticket_id:m.ticketId,context_allowed:m.contextAllowed,remembered:false,boundary:false}});
 }
 const [l]=await db.select().from(mailboxLetters).where(and(eq(mailboxLetters.id,String(p.payload.letter_id)),eq(mailboxLetters.catId,c.get('owner').catId)));
 return l?c.json({route:'mailbox',letter_id:l.id}):c.json({error:{code:'not_found'}},404);
});
