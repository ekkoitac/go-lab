import assert from 'node:assert/strict';
import test from 'node:test';
import { advance, completed, defaults, initial, inspect, rewind } from '../src/components/architecture-lab/lesson107/model.ts';

test('107 entry conversion preserves business result across HTTP, message and fake', () => {
  for (const entry of ['http', 'message', 'fake'] as const) {
    const result = completed({ ...defaults, entry });
    assert.equal(result.outcome, 'success');
    assert.equal(result.recordAmount, 40);
    assert.equal(result.ackCalls, entry === 'message' ? 1 : 0);
  }
});
test('107 invalid amounts never touch persistence or broker ack, including numeric edges', () => {
  for (const amount of [0, -1, 101, NaN, Infinity]) {
    const result = completed({ ...defaults, amount });
    assert.equal(result.outcome, 'invalid');
    assert.equal(result.saveCalls, 0);
    assert.equal(result.ackCalls, 0);
  }
  assert.equal(completed({ ...defaults, amount: 100 }).outcome, 'success');
});
test('107 storage failure prevents confirmation while ack failure preserves committed record', () => {
  const storage = completed({ ...defaults, storageOk: false });
  assert.equal(storage.outcome, 'storage');
  assert.equal(storage.committed, false);
  assert.equal(storage.ackCalls, 0);
  const ack = completed({ ...defaults, ackOk: false });
  assert.equal(ack.outcome, 'ack');
  assert.equal(ack.committed, true);
  assert.equal(ack.ackCalls, 1);
  assert.equal(ack.acknowledged, false);
});
test('107 fake ports isolate external frameworks only after the core is separated', () => {
  assert.equal(completed({ ...defaults, entry: 'fake', design: 'coupled' }).outcome, 'blocked');
  assert.equal(completed({ ...defaults, entry: 'fake', design: 'ports' }).outcome, 'success');
  for (const design of ['coupled', 'ports'] as const) {
    assert.equal(completed({ ...defaults, design, storageOk: false }).outcome, 'storage');
  }
});
test('107 step ordering and rewind are deterministic; ack only follows saved state', () => {
  const start = initial();
  const one = advance(start);
  assert.equal(inspect(one).command?.amount, 40);
  assert.equal(inspect(one).valid, null);
  const two = advance(one);
  assert.equal(inspect(two).saveCalls, 0);
  const three = advance(two);
  assert.equal(inspect(three).committed, true);
  assert.equal(inspect(three).ackCalls, 0);
  const four = advance(three);
  assert.equal(inspect(four).acknowledged, true);
  assert.deepEqual(rewind(four), three);
  assert.deepEqual(advance(rewind(four)), four);
  assert.deepEqual(advance(four), four);
  assert.deepEqual(rewind(start), start);
});
