import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assess,scenarios} from '../src/components/observability-lab/lesson172/model';

test('172 computes request-weighted long window and fivefold slow consumption',()=>{
  const r=assess(scenarios.slow.input);
  assert.equal(r.long.requests,12000);assert.equal(r.long.errors,60);
  assert.ok(Math.abs(r.longBurn!-5)<1e-10);assert.equal(r.route,'task');
  const unequal=assess({slo:.999,previous:{requests:9900,errors:0},recent:{requests:100,errors:10}});
  assert.equal(unequal.longRate,.001);assert.equal(unequal.shortRate,.1);assert.equal(unequal.route,'observe');
});
test('172 requires both windows and suppresses historic paging after recovery',()=>{
  assert.equal(assess(scenarios.fast.input).route,'page');
  const recovered=assess(scenarios.recovered.input);assert.equal(recovered.route,'observe');assert.equal(recovered.longOnly,'page');
});
test('172 low and missing traffic are unknown evidence, not healthy or paging',()=>{
  assert.equal(assess(scenarios.sparse.input).route,'insufficient');
  const idle=assess(scenarios.idle.input);assert.equal(idle.shortRate,null);assert.equal(idle.shortBurn,null);assert.equal(idle.route,'insufficient');
  const empty=assess({slo:.999,previous:{requests:0,errors:0},recent:{requests:0,errors:0}});assert.equal(empty.longBurn,null);
});
test('172 SLO changes meaning and exact thresholds survive floating point',()=>{
  const r=assess({slo:.99,previous:{requests:9000,errors:180},recent:{requests:1000,errors:20}});assert.ok(Math.abs(r.longBurn!-2)<1e-10);assert.equal(r.route,'task');
  assert.equal(assess({slo:.999,previous:{requests:9000,errors:126},recent:{requests:1000,errors:14}}).route,'page');
});
test('172 rejects impossible event counts and invalid SLO without mutation',()=>{
  const original=structuredClone(scenarios.slow.input);assess(original);assert.deepEqual(original,scenarios.slow.input);
  for(const errors of [-1,2.5,1001,NaN])assert.throws(()=>assess({...original,recent:{requests:1000,errors}}));
  for(const slo of [0,1,NaN,Infinity])assert.throws(()=>assess({...original,slo}));
});
