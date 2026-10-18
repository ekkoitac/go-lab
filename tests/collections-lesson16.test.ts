import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, copyCount, snapshot, overlap, pointerCopy } from '../src/components/collections-lab/lesson16/model';
test('zero destination length copies nothing regardless of reserved capacity', () => {
  for (const capacity of [0,3,8]) {
    const s = snapshot({...baseline,capacity},1);
    assert.equal(s.returned,0);
    assert.deepEqual(s.dst,[]);
    assert.equal(s.dstLength,0);
  }
});
test('copy is bounded by both lengths, preserves suffix and never changes length', () => {
  const short = snapshot({srcLength:5,dstLength:2,capacity:7},3);
  assert.deepEqual(short.dst,[3,6]);
  assert.equal(short.returned,2);
  assert.deepEqual(short.storage,[3,6,0,0,0,0,0]);
  const long = snapshot({srcLength:2,dstLength:5,capacity:8},3);
  assert.deepEqual(long.dst,[3,6,0,0,0]);
  assert.equal(long.dstLength,5);
  assert.equal(long.returned,2);
});
test('step, edit and rewind preserve independent integer storage', () => {
  const config = {srcLength:3,dstLength:3,capacity:4};
  assert.deepEqual(snapshot(config,1).dst,[3,0,0]);
  assert.equal(snapshot(config,3).returned,null);
  assert.deepEqual(snapshot(config,5).dst,[99,6,9]);
  assert.deepEqual(snapshot(config,5).src,[3,6,9]);
  assert.deepEqual(snapshot(config,4).dst,[3,6,9]);
  assert.deepEqual(snapshot(config,0).dst,[0,0,0]);
  const emptySource = snapshot({srcLength:0,dstLength:2,capacity:3},2);
  assert.equal(emptySource.returned,0);
  assert.deepEqual(emptySource.dst,[99,0]);
});
test('overlapping copy uses original source values in both directions', () => {
  assert.deepEqual(overlap('right',3).array,[2,2,4,6]);
  assert.deepEqual(overlap('left',3).array,[4,6,8,8]);
  assert.deepEqual(overlap('right',1).array,[2,2,6,8]);
  assert.deepEqual(overlap('right',0).array,[2,4,6,8]);
});
test('copying pointer slots shares objects while replacing slot stays local', () => {
  assert.equal(pointerCopy('edit').objects.X,99);
  assert.deepEqual(pointerCopy('edit').src,pointerCopy('edit').dst);
  assert.deepEqual(pointerCopy('replace').src,['X','Y']);
  assert.deepEqual(pointerCopy('replace').dst,['Z','Y']);
  assert.equal(pointerCopy('replace').objects.X,3);
});
test('invalid lengths and impossible destination descriptors are rejected', () => {
  assert.throws(() => copyCount(-1,2));
  assert.throws(() => copyCount(1.5,2));
  assert.throws(() => snapshot({srcLength:3,dstLength:4,capacity:3},0));
  assert.throws(() => snapshot(baseline,2));
});
