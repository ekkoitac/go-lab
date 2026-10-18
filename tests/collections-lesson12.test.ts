import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDescriptor as d, operate, validDescriptor, storage } from '../src/components/collections-lab/lesson12/model';
test('12: index uses length, not capacity, and preserves descriptor on panic', () => {
  assert.equal(operate(d,{kind:'index',index:1}).value,66);
  const failed=operate(d,{kind:'index',index:2});
  assert.equal(failed.ok,false); assert.deepEqual(failed.descriptor,d);
  for(const index of [-1,4,NaN,0.5]) assert.equal(operate(d,{kind:'index',index}).ok,false);
});
test('12: reslicing may extend beyond len without allocating or initializing', () => {
  const before=[...storage]; const extended=operate(d,{kind:'reslice',low:0,high:4});
  assert.equal(extended.ok,true); assert.deepEqual(extended.descriptor,{start:0,length:4,capacity:4});
  assert.equal(operate(extended.descriptor,{kind:'index',index:2}).value,0);
  assert.deepEqual(storage,before); assert.deepEqual(d,{start:0,length:2,capacity:4});
});
test('12: moved origin reduces capacity and maps relative index to backing', () => {
  const moved=operate(d,{kind:'reslice',low:1,high:3}).descriptor;
  assert.deepEqual(moved,{start:1,length:2,capacity:3});
  assert.equal(operate(moved,{kind:'index',index:0}).value,66);
  assert.deepEqual(operate(moved,{kind:'reslice',low:3,high:3}).descriptor,{start:4,length:0,capacity:0});
});
test('12: invalid bounds cannot enlarge capacity or mutate storage', () => {
  for(const [low,high] of [[0,5],[3,2],[-1,2],[0,2.5],[NaN,2]]) {
    const r=operate(d,{kind:'reslice',low,high}); assert.equal(r.ok,false); assert.deepEqual(r.descriptor,d);
  }
  assert.equal(validDescriptor({start:6,length:0,capacity:0}),true);
  for(const invalid of [{start:3,length:1,capacity:4},{start:0,length:5,capacity:4},{start:-1,length:0,capacity:0}]) {
    assert.equal(validDescriptor(invalid),false);assert.throws(()=>operate(invalid,{kind:'index',index:0}),RangeError);
  }
});
