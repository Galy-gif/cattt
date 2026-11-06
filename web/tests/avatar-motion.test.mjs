import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarMotion, avatarBlink } from '../src/tools/avatar-motion.ts';

test('头像动作回到相同待机姿势，端点速度接近零', () => {
 for (const kind of ['blink','look']) {
  const duration = kind === 'blink' ? .3 : 2.4;
  const start=avatarMotion(kind,0),end=avatarMotion(kind,duration);
  for (const key of ['blink','yaw','pitch','roll']) {
   assert.ok(Math.abs(start[key])<1e-10);
   assert.ok(Math.abs(end[key])<1e-10);
   assert.ok(Math.abs(avatarMotion(kind,.001)[key]-start[key])<.0001);
   assert.ok(Math.abs(avatarMotion(kind,duration-.001)[key]-end[key])<.0001);
  }
 }
});
test('歪头只侧倾一边、停留后回正，不左右摇头', () => {
 assert.equal(avatarBlink(.11),1);
 assert.equal(avatarBlink(-1),0);
 assert.equal(avatarBlink(1),0);
 const values=Array.from({length:721},(_,i)=>avatarMotion('look',i/300));
 assert.ok(values.every(p=>p.yaw===0 && p.roll>=0));
 assert.ok(Math.abs(Math.max(...values.map(p=>p.roll))-8*Math.PI/180)<1e-10);
 assert.equal(avatarMotion('look',.8).roll,avatarMotion('look',1.45).roll);
 for(let i=1;i<values.length;i++) assert.ok(Math.abs(values[i].roll-values[i-1].roll)<.002);
});
