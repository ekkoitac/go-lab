import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can52, create52, step52 } from '../src/components/channel-lessons/model52';
test('full buffer preserves waiting send and FIFO when reception releases capacity', () => {
  let s = create52(2);
  s = step52(step52(step52(s, 'send'), 'send'), 'send');
  assert.deepEqual(s.queue, [1, 2]); assert.equal(s.pending, 3); assert.equal(s.sent, 2);
  assert.equal(can52(s, 'send'), false); assert.equal(step52(s, 'send'), s);
  const before = s;
  s = step52(s, 'receive');
  assert.equal(s.processing, 1); assert.deepEqual(s.queue, [2, 3]); assert.equal(s.pending, null); assert.equal(s.sent, 3);
  assert.deepEqual(before.queue, [1, 2]); assert.deepEqual(s.completed, []);
  assert.equal(step52(s, 'receive'), s);
  s = step52(step52(s, 'finish'), 'receive');
  assert.equal(s.processing, 2); assert.deepEqual(s.completed, [1]);
});
test('empty receiver waits and next send delivers directly without pretending processing is complete', () => {
  const waiting = step52(create52(), 'receive');
  assert.equal(waiting.receiverWaiting, true);
  const delivered = step52(waiting, 'send');
  assert.equal(delivered.processing, 1); assert.equal(delivered.outcome, 'handoff');
  assert.deepEqual(delivered.queue, []); assert.deepEqual(delivered.completed, []); assert.equal(delivered.sent, 1);
});
test('larger capacity admits burst but does not complete business work', () => {
  for (const capacity of [1, 2, 3, 4]) {
    let s = create52(capacity);
    for (let i = 0; i < capacity + 1; i++) s = step52(s, 'send');
    assert.equal(s.sent, capacity); assert.equal(s.pending, capacity + 1); assert.equal(s.completed.length, 0);
    while (s.queue.length || s.processing !== null) {
      if (s.processing === null) s = step52(s, 'receive');
      s = step52(s, 'finish');
    }
    assert.deepEqual(s.completed, Array.from({ length: capacity + 1 }, (_, i) => i + 1));
    assert.equal(s.sent, capacity + 1);
  }
});
test('model rejects invalid capacity and no-op completion', () => {
  for (const cap of [0, 5, 1.5, NaN]) assert.throws(() => create52(cap));
  const initial = create52(); assert.equal(step52(initial, 'finish'), initial);
});
