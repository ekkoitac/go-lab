import test from 'node:test';
import assert from 'node:assert/strict';
import {applyQuota,compareActions,initialQuota,running,type Action} from '../src/components/security-lab/lesson189/model';
test('189 noisy tenant cannot consume B capacity under dual quota',()=>{
 const actions:Action[]=[...Array.from({length:4},()=>({type:'submit' as const,tenant:'A' as const})),{type:'submit',tenant:'B'}];
 const result=compareActions(actions);
 assert.equal(running(result.global,'A').length,4);assert.equal(running(result.global,'B').length,0);
 assert.equal(running(result.dual,'A').length,2);assert.equal(running(result.dual,'B').length,1);
 assert.equal(result.dual.jobs[2].status,'rejected');assert.equal(running(result.dual).length,3);
});
test('189 rejected reservation and invalid releases cannot leak or underflow quota',()=>{
 let state=initialQuota('dual');for(const tenant of ['A','A','B','B'] as const)state=applyQuota(state,{type:'submit',tenant});
 assert.equal(running(state).length,4);
 state=applyQuota(state,{type:'submit',tenant:'A'});assert.equal(running(state).length,4);
 state=applyQuota(state,{type:'complete',id:5});assert.equal(running(state).length,4);
 state=applyQuota(state,{type:'cancel',id:1});assert.equal(running(state).length,3);
 state=applyQuota(state,{type:'complete',id:1});assert.equal(running(state).length,3);
 state=applyQuota(state,{type:'submit',tenant:'A'});assert.equal(running(state).length,4);
 state=applyQuota(state,{type:'complete',id:999});assert.equal(running(state).length,4);
});
test('189 replay supports rewind branching without mutating a previous snapshot',()=>{
 const actions:Action[]=[{type:'submit',tenant:'A'},{type:'submit',tenant:'A'},{type:'submit',tenant:'A'}];
 const before=compareActions(actions);const snapshot=JSON.stringify(before);
 const branch=compareActions([...actions.slice(0,2),{type:'submit',tenant:'B'}]);
 assert.equal(running(branch.dual,'B').length,1);assert.equal(JSON.stringify(before),snapshot);
 assert.equal(running(compareActions([]).dual).length,0);
});
test('189 arbitrary finite command sequences preserve both bounds and independent counts',()=>{
 let seed=189;let state=initialQuota('dual');
 for(let i=0;i<1500;i++){
  seed=(seed*1664525+1013904223)>>>0;
  const action:Action=seed%3===0?{type:'submit',tenant:seed%2===0?'A':'B'}:{type:seed%3===1?'complete':'cancel',id:(seed%Math.max(1,state.tick))+1};
  const next=applyQuota(state,action);
  assert.ok(running(next).length<=4);assert.ok(running(next,'A').length<=2);assert.ok(running(next,'B').length<=2);
  assert.equal(running(next).length,running(next,'A').length+running(next,'B').length);
  assert.equal(new Set(next.jobs.map(j=>j.id)).size,next.jobs.length);state=next;
 }
});
