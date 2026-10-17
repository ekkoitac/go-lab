import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,back,capacity,defaults,flow,inspect,targetMet} from '../src/components/cache-message-lab/lesson145/model';

test('145 normal 99% hits leave 1000 QPS; outage amplification is 100x',()=>{
  const normal=inspect(defaults,0),outage=inspect(defaults,1);
  assert.equal(normal.cache,99000);assert.equal(normal.online,1000);
  assert.equal(outage.online,100000);assert.equal(outage.online/normal.online,100);
  assert.equal(outage.overloaded,true);assert.equal(outage.rejected,0);
});
test('145 admission applies before source; permitted stale and rejection conserve traffic',()=>{
  const c={...defaults,bounded:true},s=inspect(c,1);
  assert.equal(s.online,2500);assert.equal(s.stale,78000);assert.equal(s.rejected,19500);
  assert.equal(s.cache+s.online+s.stale+s.rejected,c.traffic);assert.equal(targetMet(s),true);
});
test('145 authority reads never use stale even when configured at 100%',()=>{
  const s=inspect({...defaults,bounded:true,business:'authority',stalePercent:100},1);
  assert.equal(s.stale,0);assert.equal(s.rejected,97500);assert.equal(s.online,2500);
});
test('145 a limit above capacity is not protection and low traffic is a counterexample',()=>{
  assert.equal(targetMet(inspect({...defaults,bounded:true,budget:5000},1)),false);
  const low=inspect({...defaults,traffic:100},1);assert.equal(low.online,100);assert.equal(targetMet(low),true);
});
test('145 restoration starts cold and bounded refill raises hits while preserving shared budget',()=>{
  const c={...defaults,bounded:true,warm:100000};
  assert.equal(inspect(c,2).hitPercent,0);
  let prev=0;
  for(let step=2;step<=8;step++){
    const s=inspect(c,step);
    assert.ok(s.dbTotal<=c.budget);assert.ok(s.dbTotal<=capacity);assert.ok(s.filled>=prev);
    assert.equal(s.dbTotal,s.online+s.warm);assert.equal(s.cache+s.online+s.stale+s.rejected,c.traffic);prev=s.filled;
  }
  assert.equal(inspect(c,8).hitPercent,99);assert.equal(inspect(c,8).dbTotal,1000);
});
test('145 unbounded prewarm can overload even when online misses alone fit',()=>{
  const open=flow({...defaults,warm:100000},'recovery',97.5,2,97500);
  assert.equal(open.online,2500);assert.equal(open.warm,1500);assert.equal(open.overloaded,true);
  const safe=flow({...defaults,bounded:true,warm:100000},'recovery',97.5,2,97500);
  assert.equal(safe.online,2500);assert.equal(safe.warm,0);assert.equal(safe.dbTotal,2500);
});
test('145 overload recovery freeze and deterministic backtracking preserve evidence',()=>{
  assert.equal(inspect(defaults,8).filled,0);
  const c={...defaults,bounded:true};const original=inspect(c,3);
  assert.deepEqual(inspect(c,back(advance(3))),original);
  assert.equal(back(0),0);assert.equal(advance(8),8);
});

