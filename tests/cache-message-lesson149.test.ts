import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,events,finalState,initial,inspect,result,step,type Config,type Route,type Workers,type Workload} from '../src/components/cache-message-lab/lesson149/model';
const safe:Config={route:'order',workers:'serial',guard:true,workload:'balanced'};
test('149: stable key routing plus serial workers preserves per-order completion and allows concurrency',()=>{
 const s=finalState(safe);assert.equal(s.tick,4);assert.equal(s.peakConcurrency,2);assert.equal(s.violations,0);assert.deepEqual(s.versions,{A:2,B:2});assert.equal(result(s),'ordered');
 for(const order of ['A','B'])assert.deepEqual(s.completed.filter(e=>e.order===order).map(e=>[e.version,e.tick]),[[1,3],[2,4]]);
 const global=finalState({...safe,route:'global'});assert.equal(global.tick,8);assert.equal(global.peakConcurrency,1);assert.deepEqual(global.versions,s.versions);
});
test('149: FIFO dispatch does not promise completion order under asynchronous workers',()=>{
 const atOne=inspect(defaults,1);assert.deepEqual(atOne.completed.map(e=>e.id),['A-v2','B-v2']);assert.deepEqual(atOne.running.flat().map(e=>[e.event.id,e.remaining]),[['A-v1',2],['B-v1',2]]);assert.deepEqual(atOne.versions,{A:2,B:2});
 const s=finalState(defaults);assert.equal(result(s),'unordered');assert.deepEqual(s.versions,{A:1,B:1});assert.equal(s.completed.at(-1)?.after,1);assert.equal(s.tick,3);
});
test('149: splitting one key across serial queues permits payment to overtake creation',()=>{
 const c:Config={...safe,route:'round-robin',guard:false};assert.deepEqual(events(c).map(e=>e.partition),[0,1,0,1]);const s=finalState(c);assert.equal(s.completed[0].id,'A-v2');assert.equal(s.completed[1].id,'B-v2');assert.equal(result(s),'unordered');assert.deepEqual(s.versions,{A:1,B:1});
});
test('149: version guard refuses a missing predecessor but retains unresolved event identities',()=>{
 const c={...defaults,guard:true};const first=inspect(c,1);assert.deepEqual(first.versions,{A:0,B:0});assert.deepEqual(first.rejected,['A-v2','B-v2']);const s=finalState(c);assert.equal(result(s),'blocked');assert.deepEqual(s.versions,{A:1,B:1});assert.deepEqual(s.rejected,['A-v2','B-v2']);assert.equal(s.completed.filter(e=>!e.accepted).length,2);
 assert.equal(result(finalState({...c,workers:'serial'})),'ordered');
});
test('149: hot order cannot use a second partition without breaking the stable-key boundary',()=>{
 const c:Config={...safe,workload:'hot'};assert.deepEqual(events(c).map(e=>e.partition),[0,0,0,0]);const s=finalState(c);assert.equal(s.tick,6);assert.equal(s.peakConcurrency,1);assert.deepEqual(s.versions,{A:4,B:0});assert.equal(finalState({...c,route:'global'}).tick,6);
});
test('149: queued, running and completed records conserve event identity in every configuration',()=>{
 for(const route of ['global','order','round-robin'] as Route[])for(const workers of ['serial','parallel'] as Workers[])for(const workload of ['balanced','hot'] as Workload[])for(const guard of [false,true]){
  const c={route,workers,workload,guard};const expected=events(c).map(e=>e.id).sort();
  for(let phase=0;phase<=12;phase++){const s=inspect(c,phase);const ids=[...s.queues.flat().map(e=>e.id),...s.running.flat().map(e=>e.event.id),...s.completed.map(e=>e.id)].sort();assert.deepEqual(ids,expected);assert.equal(new Set(ids).size,4);assert.ok(s.running.every(r=>r.length<=(workers==='serial'?1:2)));if(guard)assert.ok(s.completed.filter(e=>e.accepted).every(e=>e.after===e.before+1));}
  assert.equal(finalState(c).done,true);assert.equal(finalState(c).completed.length,4);
 }
});
test('149: prediction is immutable and independent of physical simulation; rewind restores exact preceding frame',()=>{
 const start=initial(safe);assert.throws(()=>step(start));assert.throws(()=>step(start,{value:'ordered',reason:' '}));const prediction={value:'ordered' as const,reason:'two independent serial chains'};const one=step(start,prediction);prediction.reason='mutated';assert.equal(one.prediction?.reason,'two independent serial chains');assert.deepEqual(back(one),start);const two=step(one);assert.deepEqual(back(two),one);assert.deepEqual(inspect(one.config,one.phase),inspect(safe,1));assert.equal(start.phase,0);assert.equal(start.prediction,undefined);
 let current=one;while(!inspect(current.config,current.phase).done)current=step(current);assert.equal(step(current),current);assert.deepEqual(initial(safe),start);
});
test('149: invalid inputs fail explicitly',()=>{for(const phase of [-1,13,1.5])assert.throws(()=>inspect(safe,phase));assert.throws(()=>initial({...safe,route:'invalid' as Route}));});
