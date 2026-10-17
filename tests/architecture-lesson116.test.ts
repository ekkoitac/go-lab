import test from 'node:test';
import assert from 'node:assert/strict';
import { act, advance, current, initial, inspect, rewind } from '../src/components/architecture-lab/lesson116/model';
test('static data returns identical unique pages', () => {
  let state = initial(); state = advance(advance(advance(state)));
  assert.deepEqual(inspect(state, 'offset').seen, [1,2,3,4,5,6]);
  assert.deepEqual(inspect(state, 'key').seen, [1,2,3,4,5,6]);
  assert.deepEqual(inspect(state, 'offset').duplicates, []);
});
test('front insertion preserves boundaries and causes offset duplicate', () => {
  const read = advance(initial()), inserted = act(read, 'insert');
  assert.equal(current(inserted).offset, 2); assert.equal(current(inserted).cursor, 2);
  assert.deepEqual(current(inserted).offsetPages, [[1,2]]);
  const state = advance(inserted);
  assert.deepEqual(inspect(state, 'offset').lastPage, [2,3]);
  assert.deepEqual(inspect(state, 'key').lastPage, [3,4]);
  assert.deepEqual(inspect(state, 'offset').duplicates, [2]);
  assert.deepEqual(inspect(state, 'key').behindNew, [0]);
  assert.deepEqual(inspect(state, 'key').skipped, []);
});
test('front deletion causes offset omission, stable key still finds the next original record', () => {
  const state = advance(act(advance(initial()), 'delete'));
  assert.deepEqual(inspect(state, 'offset').lastPage, [4,5]);
  assert.deepEqual(inspect(state, 'offset').skipped, [3]);
  assert.deepEqual(inspect(state, 'key').lastPage, [3,4]);
});
test('appended rows enter subsequent cursor pages: keyset is not a snapshot', () => {
  let state = act(advance(initial([1,2,3,4])), 'append');
  state = advance(advance(state)); assert.deepEqual(inspect(state, 'key').seen, [1,2,3,4,5]);
  assert.equal(state.baseline.includes(5), false);
});
test('deleting unread rows loses their visibility for both strategies', () => {
  const state = act(initial(), 'delete');
  assert.deepEqual(inspect(state, 'key').deletedUnread, [1]);
  assert.deepEqual(inspect(advance(state), 'key').lastPage, [2,3]);
});
test('rewind is exact and a new action branches without future mutations', () => {
  const first = advance(initial()), inserted = act(first, 'insert');
  assert.deepEqual(rewind(inserted), first);
  const fork = act(rewind(inserted), 'delete');
  assert.deepEqual(current(fork).records, [2,3,4,5,6]); assert.equal(current(fork).frontAdded, false);
  assert.deepEqual(current(inserted).records, [0,1,2,3,4,5,6]);
  assert.deepEqual(rewind(initial()), initial());
});
test('empty pages keep the key boundary, appends use new unique IDs, insertion only once', () => {
  let state = advance(initial([1])); state = advance(state); assert.equal(current(state).cursor, 1);
  state = act(act(state, 'delete'), 'append'); assert.deepEqual(current(state).records, [2]);
  assert.deepEqual(inspect(advance(state), 'key').lastPage, [2]);
  const inserted = act(initial(), 'insert'); assert.deepEqual(act(inserted, 'insert'), inserted);
});

test('empty initial list accepts a finite front record and can read it', () => {
  const state = advance(act(initial([]), 'insert'));
  assert.deepEqual(current(state).records, [0]);
  assert.deepEqual(inspect(state, 'key').lastPage, [0]);
});
