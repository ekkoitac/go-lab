import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, transition, ownership } from '../src/components/concurrency-lab/lesson126/model';

test('false confirmation never creates a queued task; reject preserves caller responsibility', () => {
  const bad = transition(initial('fake'), 'offer');
  assert.equal(bad.result, 'false-success'); assert.deepEqual(bad.queue, ['A']);
  assert.match(ownership(bad), /无人接住/);
  const good = transition(initial('reject'), 'offer');
  assert.equal(good.result, 'rejected'); assert.deepEqual(good.queue, ['A']);
  assert.match(ownership(good), /调用方/);
});
test('capacity recovery alone does not retry rejected work; explicit retry can transfer responsibility', () => {
  const rejected = transition(initial('reject'), 'offer');
  const freed = transition(rejected, 'release');
  assert.equal(freed.result, 'rejected'); assert.deepEqual(freed.queue, []);
  const accepted = transition(transition(freed, 'retry'), 'offer');
  assert.equal(accepted.result, 'accepted'); assert.deepEqual(accepted.queue, ['B']);
  assert.deepEqual(transition(accepted, 'release').completed, ['A', 'B']);
  assert.equal(transition(accepted, 'offer'), accepted);
});
test('waiting hands off only when capacity is released before deadline', () => {
  const waiting = transition(initial('wait', false, 2), 'offer');
  const one = transition(waiting, 'tick'); assert.equal(one.result, 'waiting');
  const accepted = transition(one, 'release'); assert.equal(accepted.result, 'accepted');
  assert.deepEqual(accepted.queue, ['B']); assert.equal(transition(accepted, 'cancel'), accepted);
});
test('deadline or cancellation prevents a later release from silently accepting B', () => {
  const waiting = transition(initial('wait', false, 1), 'offer');
  for (const action of ['tick', 'cancel'] as const) {
    const stop = transition(waiting, action);
    assert.equal(stop.result, action === 'tick' ? 'expired' : 'cancelled');
    const freed = transition(stop, 'release'); assert.deepEqual(freed.queue, []);
    assert.equal(freed.result, stop.result);
    assert.deepEqual(transition(transition(freed, 'retry'), 'offer').queue, ['B']);
  }
});
test('loss is permitted only by explicit business semantics and never claims execution', () => {
  const forbidden = transition(initial('drop'), 'offer'); assert.equal(forbidden.result, 'forbidden');
  const dropped = transition(initial('drop', true), 'offer'); assert.equal(dropped.result, 'dropped');
  assert.deepEqual(dropped.queue, ['A']); assert.match(ownership(dropped), /不再执行/);
  assert.equal(transition(dropped, 'retry'), dropped);
});
test('all policies accept when capacity exists; snapshots stay immutable', () => {
  for (const policy of ['fake', 'reject', 'wait', 'drop'] as const) {
    const start = initial(policy); const free = transition(start, 'release'); const accepted = transition(free, 'offer');
    assert.equal(accepted.result, 'accepted'); assert.deepEqual(accepted.queue, ['B']);
    assert.deepEqual(start.queue, ['A']); assert.deepEqual(start.completed, []); assert.deepEqual(free.queue, []);
  }
  for (const bad of [0, -1, 1.5, 6, NaN]) assert.throws(() => initial('wait', false, bad));
});
