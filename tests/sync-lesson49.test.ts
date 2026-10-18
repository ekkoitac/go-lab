import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,runAll} from '../src/components/sync-lab/lesson49/model';
test('Once scope determines business counts for the same concurrent requests',()=>{
  for(const count of [2,3,4,5])for(const duration of [1,2,3]) {
    const inside=runAll('inside',count,duration),outside=runAll('outside',count,duration);
    assert.equal(inside.initCount,1);assert.equal(outside.initCount,1);
    assert.equal(inside.operations,1);assert.equal(outside.operations,count);
    assert.ok(inside.requests.every(p=>p==='done'));assert.ok(outside.requests.every(p=>p==='done'));
  }
});
test('concurrent Do must wait until initialization returns',()=>{
  let s=transition(initialState('outside'),{type:'request',id:1});
  s=transition(s,{type:'request',id:0});assert.equal(s.requests[0],'waiting');
  s=transition(s,{type:'initialize'});s=transition(s,{type:'request',id:0});
  assert.equal(s.requests[0],'waiting');assert.equal(s.operations,0);assert.equal(s.once,'running');
  s=transition(s,{type:'initialize'});assert.equal(s.once,'done');assert.equal(s.initCount,1);
  s=transition(s,{type:'request',id:0});assert.equal(s.requests[0],'business');assert.equal(s.operations,0);
  s=transition(s,{type:'request',id:0});assert.equal(s.operations,1);
});
test('late callers skip initialization and completed requests cannot process twice',()=>{
  let s=initialState('outside',2,1);s=transition(s,{type:'request',id:0});s=transition(s,{type:'initialize'});
  s=transition(s,{type:'request',id:1});assert.equal(s.requests[1],'business');
  s=transition(s,{type:'request',id:1});const done=s;
  assert.equal(transition(s,{type:'request',id:1}),done);assert.equal(transition(s,{type:'initialize'}),done);assert.equal(s.initCount,1);
});
test('transitions preserve snapshots for rewind and alternate scheduling',()=>{
  const start=initialState('inside',3,2),snapshot=JSON.stringify(start);
  const first=transition(start,{type:'request',id:2});
  assert.equal(JSON.stringify(start),snapshot);assert.equal(first.owner,2);
  assert.equal(transition(start,{type:'request',id:0}).owner,0);
  assert.equal(transition(start,{type:'request',id:99}),start);
});
