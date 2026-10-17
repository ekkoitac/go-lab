import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,initial,inspect,step} from '../src/components/database-lab/lesson131/model';
test('131: replica growth multiplies independent pools while reserve stays global',()=>{
 assert.equal(inspect(defaults,0).total,240);
 assert.equal(inspect(defaults,1).total,420);
 assert.equal(inspect(defaults,2).total,510);
 assert.equal(inspect(defaults,3).total,420);
});
test('131: steady-state safe pool can exceed budget during surge',()=>{
 const c={...defaults,pool:15};
 assert.equal(inspect(c,1).over,0);assert.equal(inspect(c,2).over,45);
 assert.equal(inspect(c,2).safePerPool,12);
 assert.equal(inspect({...c,pool:12},2).over,0);
 assert.equal(inspect({...c,pool:13},2).over,15);
});
test('131: shrinking pools trades capacity ceiling for local waiting, not simulated latency',()=>{
 const larger=inspect({...defaults,pool:15},2),smaller=inspect({...defaults,pool:12},2);
 assert.equal(larger.localWaiting,75);assert.equal(smaller.localWaiting,120);
 assert.equal(inspect({...defaults,demand:0},2).localWaiting,0);
 assert.equal(inspect({...defaults,reserve:240},2).safePerPool,0);
});
test('131: predictions are required, retained immutably, and rewind removes future runs',()=>{
 const start=initial();assert.throws(()=>step(start,{total:420,reason:' '}));
 const prediction={total:420,reason:'12 * 30 + 60'};const first=step(start,prediction);prediction.reason='changed';
 assert.equal(first.runs[0].prediction.reason,'12 * 30 + 60');assert.equal(start.stage,0);
 const second=step(first,{total:510,reason:'15 * 30 + 60'});assert.deepEqual(back(second),first);assert.deepEqual(back(first),start);
 const end=step(second,{total:420,reason:'surge 退出'});assert.equal(step(end,{total:1,reason:'done'}),end);
});
test('131: invalid and unlimited sql.DB sentinel inputs are rejected',()=>{
 for(const patch of [{pool:0},{reserve:241},{replicas:0},{surge:-1},{pool:NaN},{demand:1.5}])assert.throws(()=>initial({...defaults,...patch}));
 assert.throws(()=>inspect(defaults,4));
});
