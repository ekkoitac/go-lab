import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, copiedPointerArray, copyOrder, type Config } from '../src/components/collections-lab/lesson11/model';
const base: Config = { initial: [8,5,2], index: 1, amount: 3, passing: 'value' };
test('array value parameters copy every element and keep original independent', () => {
  const entered = snapshot(base, 1);
  assert.deepEqual(entered.local, [8,5,2]);
  assert.equal(entered.localStorage, 'B');
  const written = snapshot(base, 2);
  assert.deepEqual(written.original, [8,5,2]);
  assert.deepEqual(written.local, [8,2,2]);
  assert.deepEqual(base.initial, [8,5,2]);
  assert.notEqual(written.local, written.original);
});
test('array pointer writes reach original, then parameter leaves scope', () => {
  const config: Config = {...base, passing:'pointer'};
  assert.equal(snapshot(config,1).localStorage,'A');
  assert.deepEqual(snapshot(config,2).original,[8,2,2]);
  assert.deepEqual(snapshot(config,3).original,[8,2,2]);
  assert.equal(snapshot(config,3).local,null);
});
test('rewinding restores exact pre-write values and zero subtraction is legal', () => {
  snapshot({...base,passing:'pointer'},2);
  assert.deepEqual(snapshot({...base,passing:'pointer'},1).original,[8,5,2]);
  assert.deepEqual(snapshot({...base,amount:0},2).local,[8,5,2]);
  assert.throws(() => snapshot({...base,index:3},1));
});
test('copying pointer elements preserves shared objects, but replacing a copied slot is local', () => {
  const write = copiedPointerArray('write');
  assert.equal(write.objects.X,99);
  assert.equal(write.a[0],write.b[0]);
  const replace = copiedPointerArray('replace');
  assert.equal(replace.a[0],'X');
  assert.equal(replace.b[0],'Z');
  assert.equal(replace.objects.X,8);
});
test('copy timing changes copied values and leaves both slots independent', () => {
  assert.deepEqual(copyOrder('copy-first',2),{a:[4,3],b:[4,9],order:'copy-first',step:2});
  assert.deepEqual(copyOrder('edit-first',2),{a:[4,3],b:[4,3],order:'edit-first',step:2});
  assert.deepEqual(copyOrder('copy-first',1).a,[4,9]);
});

