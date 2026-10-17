import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptGap, advance, close, configure, current, defaults, initial, pause, reconnect, rewind } from '../src/components/architecture-lab/lesson119/model';
test('unbounded backlog grows when production exceeds consumption', () => {
  let state = initial({ ...defaults, policy: 'unbounded' });
  for (let i = 0; i < 6; i++) state = advance(state);
  assert.equal(current(state).queue.length, 13); assert.equal(current(state).delivered.length, 5);
});
test('backpressure remains bounded and slows capable upstream', () => {
  let state = pause(initial({ ...defaults, policy: 'backpressure' }));
  for (let i = 0; i < 8; i++) { state = advance(state); assert.ok(current(state).queue.length <= 4); }
  assert.equal(current(state).queue.length, 4); assert.equal(current(state).produced, 0); assert.equal(current(state).throttled, 3);
  state = advance(pause(state)); assert.equal(current(state).delivered.length, 1); assert.equal(current(state).produced, 1);
});
test('disconnect clears queue while preserving confirmed cursor for replay', () => {
  let state = advance(advance(initial()));
  assert.equal(current(state).status, 'disconnected'); assert.deepEqual(current(state).queue, []); assert.equal(current(state).cursor, 1);
  state = reconnect(state); assert.equal(current(state).status, 'connected'); assert.deepEqual(current(state).queue, [2,3,4,5]);
});
test('shrinking a bounded capacity or switching from unbounded never leaves an oversized queue', () => {
  let state = advance(initial()); state = configure(state, { capacity: 1 });
  assert.equal(current(state).status, 'disconnected'); assert.equal(current(state).queue.length, 0);
  let growing = initial({ ...defaults, policy: 'unbounded', consumption: 0 });
  growing = advance(advance(growing)); assert.equal(current(growing).queue.length, 6);
  const bounded = configure(growing, { policy: 'backpressure' });
  assert.ok(current(bounded).queue.length <= current(bounded).config.capacity);
});
test('larger buffer does not increase consumer throughput', () => {
  let small = initial({ ...defaults, policy: 'backpressure', capacity: 2 }), large = initial({ ...defaults, policy: 'backpressure', capacity: 12 });
  for (let i = 0; i < 4; i++) { small = advance(small); large = advance(large); }
  assert.deepEqual(current(small).delivered, current(large).delivered);
});
test('cancel stops subscription resources while independent global log progresses', () => {
  let state = close(advance(initial()), true), before = current(state).nextID;
  state = advance(state);
  assert.equal(current(state).status, 'cancelled'); assert.equal(current(state).queue.length, 0); assert.equal(current(state).fetched, 0);
  assert.ok(current(state).nextID > before); assert.deepEqual(current(state).delivered, []);
});
test('expired cursor reports a gap; only explicit acceptance starts at latest position', () => {
  let state = close(advance(initial()));
  for (let i = 0; i < 5; i++) state = advance(state);
  state = reconnect(state);
  assert.equal(current(state).status, 'gap'); assert.deepEqual(current(state).gap, [1,6]); assert.equal(current(state).cursor, 0);
  state = acceptGap(state); assert.equal(current(state).status, 'connected'); assert.equal(current(state).cursor, 18);
  assert.deepEqual(current(state).acceptedGaps, [[1,18]]);
});
test('replay within retention does not duplicate delivered IDs', () => {
  let state = initial({ ...defaults, production: 1, consumption: 1, capacity: 4 });
  state = advance(advance(state)); assert.deepEqual(current(state).delivered, [1]);
  state = reconnect(close(state)); state = advance(state); assert.deepEqual(current(state).delivered, [1,2]);
});
test('rewind restores exact state and new config cuts off discarded future', () => {
  const start = initial(), first = advance(start), old = advance(first);
  assert.deepEqual(rewind(first), start);
  const branch = configure(rewind(old), { policy: 'backpressure' });
  assert.equal(current(branch).status, 'connected'); assert.equal(current(old).status, 'disconnected');
  assert.equal(branch.history.length, 3); assert.deepEqual(rewind(start), start);
});


