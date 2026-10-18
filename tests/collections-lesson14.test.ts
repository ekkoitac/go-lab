import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, originalChanged, shared, transition, values } from '../src/components/collections-lab/lesson14/model';
test('14: sufficient capacity reuses storage without updating the original length', () => {
  const start = initial(4), appended = transition(start, { kind: 'append', value: 30 });
  assert.equal(shared(appended), true); assert.equal(appended.a.length, 2); assert.equal(appended.b.length, 3);
  assert.deepEqual(values(appended, 'a'), [10, 20]); assert.equal(appended.arrays.A[2], 30);
  assert.deepEqual(values(transition(appended, { kind: 'write', index: 0, value: 99 }), 'a'), [99, 20]);
  assert.equal(start.arrays.A[2], 0);
});
test('14: insufficient capacity allocates and isolates later writes', () => {
  const appended = transition(initial(2), { kind: 'append', value: 30 });
  assert.equal(shared(appended), false); assert.ok(appended.b.capacity >= appended.b.length);
  const written = transition(appended, { kind: 'write', index: 0, value: 99 });
  assert.deepEqual(values(written, 'a'), [10, 20]); assert.deepEqual(values(written, 'b'), [99, 20, 30]);
});
test('14: full slice only limits capacity; writes before append remain shared', () => {
  const limited = transition(initial(4), { kind: 'limit' });
  assert.equal(limited.b.capacity, 2); assert.equal(limited.a.capacity, 4); assert.equal(shared(limited), true);
  const edited = transition(limited, { kind: 'write', index: 0, value: 99 });
  const appended = transition(edited, { kind: 'append', value: 30 });
  const later = transition(appended, { kind: 'write', index: 0, value: 7 });
  assert.equal(shared(appended), false); assert.deepEqual(values(later, 'a'), [99, 20]);
  assert.deepEqual(values(later, 'b'), [7, 20, 30]);
});
test('14: explicit independent copy isolates immediately and preserves history', () => {
  const start = initial(6), copied = transition(start, { kind: 'copy' });
  assert.equal(shared(copied), false);
  const after = transition(copied, { kind: 'write', index: 0, value: 99 });
  assert.equal(originalChanged(copied, after), false); assert.deepEqual(values(start, 'a'), [10, 20]);
});
test('14: a new appended slot is outside original length; same-value writes change no visible values', () => {
  const state = transition(initial(4), { kind: 'append', value: 30 });
  assert.equal(originalChanged(state, transition(state, { kind: 'write', index: 2, value: 80 })), false);
  assert.equal(originalChanged(state, transition(state, { kind: 'write', index: 0, value: 10 })), false);
  assert.throws(() => transition(state, { kind: 'write', index: 3, value: 0 }), RangeError);
});
test('14: transfer scenario exposes limit-before-append contamination', () => {
  for (const [strategy, expected] of [['limit', 60], ['copy', 8], ['none', 70]] as const) {
    let state = initial(5, [4, 8, 12]);
    if (strategy !== 'none') state = transition(state, { kind: strategy });
    state = transition(state, { kind: 'write', index: 1, value: 60 });
    state = transition(state, { kind: 'append', value: 16 });
    state = transition(state, { kind: 'write', index: 1, value: 70 });
    assert.equal(values(state, 'a')[1], expected);
  }
});
test('14: invalid capacity, values and out-of-range writes are rejected', () => {
  for (const cap of [1, 13, 2.5, NaN]) assert.throws(() => initial(cap), RangeError);
  assert.throws(() => transition(initial(), { kind: 'append', value: Infinity }), RangeError);
  assert.throws(() => transition(initial(), { kind: 'write', index: -1, value: 0 }), RangeError);
  let state = initial(); while (state.b.length < 12) state = transition(state, { kind: 'append', value: 1 });
  assert.throws(() => transition(state, { kind: 'append', value: 1 }), RangeError);
});
