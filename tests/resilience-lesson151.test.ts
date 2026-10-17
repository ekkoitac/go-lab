import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline,simulate,allocation} from '../src/components/resilience-lab/lesson151/model';
const last=(c=baseline)=>simulate(c).at(-1)!;
test('151: remaining serial allocation subtracts used and reserve; second stage recalculates',()=>{
 assert.equal(allocation(200,50,20,2),65);assert.equal(allocation(100,90,20,1),0);assert.equal(allocation(100,0,0,0),0);
 const trace=simulate(baseline);assert.equal(trace.find(s=>s.stage==='启动价格')!.budget,70);assert.equal(last().outcome,'success');assert.equal(last().now,190);
});
test('151: timeout terminates serial chain and parent cancellation needs a connected cooperative I/O',()=>{
 const slow={...baseline,inventory:240};const shared=last(slow);assert.equal(shared.now,115);assert.equal(shared.statuses[0],'已取消');assert.equal(shared.statuses[1],'未开始');
 const orphan=last({...slow,policy:'fixed',propagate:false});assert.equal(orphan.now,290);assert.equal(orphan.wasted,90);assert.equal(orphan.signal,false);
 const parent=last({...slow,policy:'fixed'});assert.equal(parent.now,200);assert.equal(parent.signal,true);assert.equal(parent.wasted,0);
 const ignored=last({...slow,respond:false});assert.equal(ignored.now,290);assert.equal(ignored.wasted,175);assert.equal(ignored.statuses[1],'未开始');
});
test('151: independent local deadline still cancels after lost parent deadline',()=>{
 const result=last({...baseline,policy:'fixed',propagate:false,inventory:1500});assert.equal(result.now,1050);assert.equal(result.signal,true);assert.equal(result.active,null);assert.equal(result.wasted,850);
});
test('151: exhausted budgets launch no work; deadline tie is explicitly deadline-first',()=>{
 assert.equal(last({...baseline,used:190}).outcome,'insufficient');assert.equal(last({...baseline,used:200}).outcome,'timeout');
 assert.equal(last({...baseline,inventory:65}).outcome,'timeout');
});
test('151: trace snapshots are independent, reproducible and monotonic',()=>{
 const trace=simulate({...baseline,inventory:240,respond:false});assert.deepEqual(trace,simulate({...baseline,inventory:240,respond:false}));
 for(let i=1;i<trace.length;i++)assert.ok(trace[i].now>=trace[i-1].now);
 assert.equal(trace[0].statuses[0],'未开始');assert.notEqual(trace[0].statuses,trace[1].statuses);
});
