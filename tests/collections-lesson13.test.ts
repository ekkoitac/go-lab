import test from 'node:test';
import assert from 'node:assert/strict';
import { address, initial, originalChanged, transition, values } from '../src/components/collections-lab/lesson13/model';
test('13: slice-local index resolves to the shared array offset', () => {
  const start = transition(initial(), { kind: 'window', low: 2, high: 4 });
  assert.deepEqual(address(start, 'sale', 1), { array: 'A', slot: 3 });
  const after = transition(start, { kind: 'write', target: 'sale', index: 1, value: 7 });
  assert.deepEqual(values(after, 'prices'), [100, 200, 300, 7]);
  assert.deepEqual(values(after, 'sale'), [300, 7]);
  assert.deepEqual(values(start, 'prices'), [100, 200, 300, 400]);
  assert.equal(originalChanged(start, after), true);
});
test('13: allocating and copying isolates writes in both directions', () => {
  const copy = transition(initial(), { kind: 'copy' });
  const written = transition(copy, { kind: 'write', target: 'sale', index: 0, value: 99 });
  assert.deepEqual(values(written, 'prices'), [100, 200, 300, 400]);
  assert.deepEqual(values(written, 'sale'), [99, 300, 400]);
  const original = transition(written, { kind: 'write', target: 'prices', index: 2, value: 1 });
  assert.deepEqual(values(original, 'sale'), [99, 300, 400]);
  assert.equal(originalChanged(copy, written), false);
});
test('13: descriptor changes preserve original length, cap is not len', () => {
  const state = transition(initial(), { kind: 'window', low: 1, high: 2 });
  assert.deepEqual(state.sale, { array: 'A', offset: 1, length: 1, capacity: 3 });
  assert.equal(state.prices.length, 4);
  assert.throws(() => address(state, 'sale', 1), RangeError);
  const assignment = transition(state, { kind: 'assign' });
  assert.deepEqual(assignment.sale, assignment.prices);
  assert.notEqual(assignment.sale, assignment.prices);
});
test('13: empty windows are legal but not indexable; invalid bounds are rejected', () => {
  const empty = transition(initial(), { kind: 'window', low: 4, high: 4 });
  assert.deepEqual(values(empty, 'sale'), []);
  assert.throws(() => transition(empty, { kind: 'write', target: 'sale', index: 0, value: 1 }), RangeError);
  assert.deepEqual(values(transition(empty, { kind: 'copy' }), 'sale'), []);
  for (const [low, high] of [[-1, 2], [3, 2], [0, 5], [0.5, 2], [0, NaN]]) assert.throws(() => transition(initial(), { kind: 'window', low, high }), RangeError);
});
test('13: writing the current value changes no values even with shared storage', () => {
  const start = initial();
  const after = transition(start, { kind: 'write', target: 'sale', index: 0, value: 200 });
  assert.equal(originalChanged(start, after), false);
  assert.match(after.last, /与原值相同/);
  assert.throws(() => transition(start, { kind: 'write', target: 'sale', index: 0, value: Infinity }), RangeError);
});
test('13: copying after contamination does not restore historic values', () => {
  let state = transition(initial(), { kind: 'write', target: 'sale', index: 0, value: 99 });
  state = transition(state, { kind: 'copy' });
  state = transition(state, { kind: 'write', target: 'sale', index: 0, value: 50 });
  assert.equal(state.arrays.A[1], 99);
  assert.equal(state.arrays.B[0], 50);
});
test('13: new sensor scenario separates local index from the original index', () => {
  const state = transition(initial([8, 16, 24, 32]), { kind: 'window', low: 2, high: 4 });
  assert.equal(transition(state, { kind: 'write', target: 'sale', index: 1, value: 7 }).arrays.A[3], 7);
  assert.equal(transition(transition(state, { kind: 'copy' }), { kind: 'write', target: 'sale', index: 1, value: 7 }).arrays.A[3], 32);
});
