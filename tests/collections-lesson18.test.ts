import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, transition, snapshot, encode, accepts } from '../src/components/collections-lab/lesson18/model';
test('nil and nonnil empty share length but differ in nil identity and JSON',()=>{
  const nil=snapshot(baseline); const empty=snapshot(transition(baseline,'empty'));
  assert.equal(nil.len,empty.len);assert.equal(nil.rangeCount,0);assert.equal(empty.rangeCount,0);
  assert.equal(nil.isNil,true);assert.equal(empty.isNil,false);
  assert.equal(encode(nil.items),'null');assert.equal(encode(empty.items),'[]');
});
test('append accepts nil and empty and does not mutate previous snapshots',()=>{
  for(const start of [baseline,transition(baseline,'empty')]){
    const added=transition(start,'append');assert.deepEqual(added.items,[7]);assert.equal(snapshot(added).isNil,false);assert.equal(start.items?.length??0,0);
  }
});
test('truncating nil preserves nil while truncating populated slice stays nonnil',()=>{
  assert.equal(transition(baseline,'truncate').items,null);
  const result=transition(transition(baseline,'append'),'truncate');
  assert.deepEqual(result.items,[]);assert.equal(encode(result.items),'[]');
});
test('clear zeroes elements without changing length and preserves nil',()=>{
  const start={...baseline,items:[4,8]}; const cleared=transition(start,'clear');
  assert.deepEqual(cleared.items,[0,0]);assert.equal(snapshot(cleared).len,2);assert.deepEqual(start.items,[4,8]);
  assert.equal(transition(baseline,'clear').items,null);assert.deepEqual(transition({...baseline,items:[]},'clear').items,[]);
});
test('boundary normalization repairs array contract while preserving source and populated values',()=>{
  const failed=transition(baseline,'encode');assert.equal(snapshot(failed).accepted,false);
  const repaired=transition(transition(failed,'normalize'),'encode');assert.equal(repaired.wire,'[]');assert.equal(repaired.items,null);assert.equal(snapshot(repaired).accepted,true);
  assert.equal(encode([4,8],true),'[4,8]');assert.equal(accepts('null','nullable'),true);
});
test('changing source or normalization invalidates previously encoded wire',()=>{
  const sent=transition(baseline,'encode');
  for(const action of ['nil','empty','append','truncate','clear','normalize'] as const)assert.equal(transition(sent,action).wire,null);
  assert.equal(sent.wire,'null');
});
test('array contract rejects non-array JSON values and malformed input',()=>{
  for(const wire of ['{}','7','"text"','false','broken']){assert.equal(accepts(wire,'array'),false);assert.equal(accepts(wire,'nullable'),false);}
  assert.equal(accepts('[]','array'),true);
});
