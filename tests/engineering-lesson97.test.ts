import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance, at, baseline, initial} from '../src/components/engineering-lab/lesson97/model';

test('internal construction ignores the caller choice and accepts using 99',()=>{
  for(const provider of ['fake','remote'] as const){const end=at({...baseline,provider},3);assert.equal(end.actual,'warehouse');assert.equal(end.count,99);assert.equal(end.result,'accepted');}
});
test('injection changes the actual method target and business result with the rule held fixed',()=>{
  const fake=at({...baseline,design:'injected'},3);const warehouse=at({...baseline,design:'injected',provider:'warehouse'},3);
  assert.equal(fake.actual,'fake');assert.equal(fake.count,3);assert.equal(fake.result,'rejected');assert.equal(warehouse.result,'accepted');
  assert.equal(at({...baseline,design:'injected',quantity:3},3).result,'accepted','equality is enough inventory');
});
test('unneeded wide interface blocks incompatible implementations before runtime calls',()=>{
  const blocked=advance(initial({...baseline,design:'injected',contract:'wide'}));assert.equal(blocked.result,'blocked');assert.equal(blocked.actual,null);assert.equal(blocked.count,null);
  assert.equal(at({...baseline,design:'injected',contract:'wide',provider:'warehouse'},3).result,'accepted');
});
test('step boundaries expose binding before count and result; replay is deterministic',()=>{
  const start=initial({...baseline,design:'injected'});const bound=advance(start);const read=advance(bound);const end=advance(read);
  assert.equal(start.actual,null);assert.equal(bound.actual,'fake');assert.equal(bound.count,null);assert.equal(read.count,3);assert.equal(read.result,null);
  assert.deepEqual(at(start,2),read);assert.equal(advance(end),end);
});
