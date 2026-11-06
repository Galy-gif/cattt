import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BowlPour} from '../src/yard/bowl-pour.ts';
test('恢复已有满盆不重播；空到满只播一次且水位随水流上升',()=>{
 const pour=new BowlPour();assert.equal(pour.level,1);pour.setFull(true);assert(!pour.active);
 pour.setFull(false);assert.equal(pour.level,0);pour.setFull(true);assert(pour.active);
 pour.update(.3);assert.equal(pour.level,0);pour.update(.8);const middle=pour.level;assert(middle>0&&middle<1);
 pour.setFull(true);assert.equal(pour.level,middle);pour.update(2);assert(!pour.active);assert.equal(pour.level,1);assert(!pour.root.visible);
});
test('空盆取消水流；减少动态直接呈现最终水位',()=>{
 const pour=new BowlPour();pour.setFull(false);pour.setFull(true);pour.update(.7);pour.setFull(false);pour.update(0);assert(!pour.root.visible);assert.equal(pour.level,0);
 pour.setFull(true);pour.update(0,true);assert(!pour.root.visible);assert.equal(pour.level,1);
});
