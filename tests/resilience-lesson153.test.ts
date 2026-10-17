import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back, finish, initial, inspect, repair, step} from '../src/components/resilience-lab/lesson153/model';
test('153 nested attempts multiply and restart inner budget at each parent', () => {
 const s=finish({attempts:[3,3,3],successAt:0});assert.equal(s.count,27);assert.equal(s.gatewayCalls,3);assert.equal(s.serviceCalls,9);assert.equal(s.succeeded,false);
 assert.deepEqual(s.tree[3],{gateway:1,service:2,client:1,ordinal:4});assert.deepEqual(s.tree[9],{gateway:2,service:1,client:1,ordinal:10});
});
test('153 successful leaves return through all parents and skip remaining work', () => {
 const s=finish({attempts:[3,3,3],successAt:5});assert.equal(s.count,5);assert.equal(s.upperBound,27);assert.equal(s.succeeded,true);assert.equal(s.gatewayCalls,1);assert.equal(s.serviceCalls,2);
 let t=initial({attempts:[3,3,3],successAt:2});for(let i=0;i<8;i++)t=step(t);assert.equal(t.cursor,2);assert.equal(inspect(back(t)).count,1);assert.equal(inspect(back(t)).succeeded,false);
});
test('153 one retry owner limits work but can exhaust before recovery', () => {
 const c={attempts:[3,3,3] as [number,number,number],successAt:5};const s=finish(repair(c));assert.equal(s.upperBound,3);assert.equal(s.count,3);assert.equal(s.succeeded,false);assert.equal(finish(repair({...c,successAt:2})).count,2);assert.equal(finish(repair({...c,successAt:2})).succeeded,true);
});
test('153 rewind reconstructs exact prefix and alternative parameters reset', () => {
 let t=initial();for(let i=0;i<4;i++)t=step(t);const prior=inspect(back(t));assert.equal(prior.count,3);assert.equal(prior.serviceCalls,1);assert.match(inspect(t).note,/客户端预算耗尽/);assert.equal(inspect(initial({attempts:[2,3,2],successAt:0})).count,0);assert.equal(finish({attempts:[2,3,2],successAt:0}).count,12);assert.equal(back(initial()).cursor,0);
});
