import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, initialModel, originalChanged, repairedComparison } from '../src/components/types-lab/lesson22/model';

test('22: struct field copies separate integers but share the slice backing store', () => {
  const start = initialModel();
  const qty = applyAction(start, 'quantity');
  assert.equal(qty.original.qty, 2);
  assert.equal(qty.draft.qty, 3);
  assert.equal(originalChanged(start, qty), false);
  const edited = applyAction(qty, 'element');
  assert.equal(edited.arrays[edited.original.tags][0], 'SALE');
  assert.equal(edited.draft.tags, edited.original.tags);
  assert.equal(originalChanged(qty, edited), true);
  assert.deepEqual(start, initialModel(), 'history snapshots remain immutable');
});
test('22: rebinding a descriptor does not rebind the original descriptor', () => {
  const result = applyAction(applyAction(initialModel(), 'rebind'), 'element');
  assert.equal(result.original.tags, 'A');
  assert.notEqual(result.draft.tags, result.original.tags);
  assert.equal(result.arrays[result.original.tags][0], 'VIP');
  assert.equal(result.arrays[result.draft.tags][0], 'SALE');
});
test('22: copying labels before editing isolates exactly the mutable field', () => {
  const start = initialModel(7, 'NEWUSER');
  const cloned = applyAction(start, 'clone');
  assert.equal(cloned.arrays[cloned.draft.tags][0], 'NEWUSER');
  const result = applyAction(cloned, 'element');
  assert.equal(result.original.qty, 7);
  assert.equal(result.arrays[result.original.tags][0], 'NEWUSER');
  assert.equal(result.arrays[result.draft.tags][0], 'SALE');
});
test('22: cloning after mutation cannot repair already changed original data', () => {
  const result = applyAction(applyAction(initialModel(), 'element'), 'clone');
  assert.notEqual(result.original.tags, result.draft.tags);
  assert.equal(result.arrays[result.original.tags][0], 'SALE');
  assert.equal(result.arrays[result.draft.tags][0], 'SALE');
});
test('22: comparison branches preserve the same starting point', () => {
  const start = initialModel();
  const { unchanged, isolated } = repairedComparison(start, 'element');
  assert.equal(unchanged.arrays[unchanged.original.tags][0], 'SALE');
  assert.equal(isolated.arrays[isolated.original.tags][0], 'VIP');
  assert.equal(isolated.arrays[isolated.draft.tags][0], 'SALE');
  assert.deepEqual(start, initialModel());
});
test('22: writing the existing value is an action without an observable value delta', () => {
  const start = initialModel(2, 'SALE');
  assert.equal(originalChanged(start, applyAction(start, 'element')), false);
  const first = applyAction(start, 'clone');
  const second = applyAction(first, 'clone');
  assert.notEqual(first.draft.tags, second.draft.tags);
  assert.equal(second.original.tags, 'A');
});
