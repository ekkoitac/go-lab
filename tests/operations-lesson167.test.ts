import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, executeOrder, initialState, logical, nextState, run, secret } from '../src/components/operations-lab/lesson167/model';

test('167: Reset clears logical bytes without erasing storage or capacity', () => {
  const before = run(defaults, 5);
  const after = nextState(before, defaults);
  assert.equal(before.objects[0].length, secret.length);
  assert.equal(after.objects[0].length, 0);
  assert.equal(logical(after.objects[0]), '');
  assert.equal(after.objects[0].storage, secret);
  assert.equal(after.objects[0].capacity, 16);
  assert.equal(before.objects[0].length, secret.length, 'prior frame must remain immutable');
});

test('167: reuse without Reset leaks previous logical contents', () => {
  assert.equal(run({ ...defaults, reset: false }).output, secret + 'tenantB');
  assert.equal(run(defaults).output, 'tenantB');
});
test('167: pool eviction and independent Get miss both allocate fresh objects', () => {
  for (const config of [{ ...defaults, discard: true }, { ...defaults, reuse: false }]) {
    const state = run({ ...config, reset: false });
    assert.equal(state.allocations, 2);
    assert.equal(state.b, 2);
    assert.equal(state.output, 'tenantB');
  }
  assert.equal(run({ ...defaults, reuse: false }).pool, 1, 'an existing pool item need not be returned');
});
test('167: Put ends A borrowing; stale alias corrupts B only on shared identity', () => {
  const put = run({ ...defaults, alias: true }, 3);
  assert.equal(put.a, null);
  assert.equal(put.alias, put.pool);
  assert.equal(run({ ...defaults, alias: true }).output, 'tenantB!');
  const miss = run({ ...defaults, alias: true, discard: true });
  assert.equal(miss.output, 'tenantB');
  assert.equal(miss.hazard, true, 'lucky miss must not hide ownership misuse');
});
test('167: capacity admission excludes oversized objects without promising reclamation', () => {
  const config = { ...defaults, capacity: 128 };
  const put = run(config, 3);
  assert.equal(put.pool, null);
  assert.equal(put.objects[0].owner, 'discarded');
  assert.equal(run(config).allocations, 2);
  assert.equal(run({ ...config, maxCapacity: 256 }).allocations, 1);
});
test('167: frames can be replayed and terminal state is stable', () => {
  assert.deepEqual(run(defaults, 0), initialState());
  const state = run(defaults);
  assert.equal(nextState(state, defaults), state);
  assert.deepEqual(run(defaults, 6), run(defaults, 6));
});

test('167: learner order changes actual final buffer and captures read before Reset', () => {
  const wrong = executeOrder(['Get', 'Write', 'Reset', 'Put']);
  assert.equal(wrong.error, null);
  assert.equal(wrong.state.output, secret + 'tenantB');
  assert.equal(wrong.state.objects[0].length, 0);
  assert.equal(wrong.state.b, null);
  assert.equal(wrong.state.pool, 1);
  const correct = executeOrder(['Get', 'Reset', 'Write', 'Put']);
  assert.equal(correct.state.output, 'tenantB');
  assert.equal(correct.state.objects[0].length, 7);
  assert.match(executeOrder(['Get', 'Put', 'Reset', 'Write']).error!, /Put/);
  assert.match(executeOrder(['Reset', 'Get', 'Write', 'Put']).error!, /先 Get/);
});
