import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, configureReader, configureWriter, counts, evaluate, initial, publish, retry, rewind, type LabState } from '../src/components/architecture-lab/lesson114/model';
function deliverAll(state: LabState) { while (counts(state).queued) state = advance(state); return state; }
test('114 writer-first new enum parses but all legacy readers accumulate retries', () => {
  const state = deliverAll(publish(initial()));
  assert.deepEqual(counts(state), { queued: 0, retry: 3, held: 0, done: 0 });
  assert.ok(state.current.deliveries.every(item => item.attempts === 1));
  assert.equal(evaluate(state.current.readers[0], state.current.events[0]).parses, true);
  assert.ok(state.current.deliveries.every(item => item.action === '未执行业务动作'));
});
test('114 repeating unchanged event increases attempts without repairing semantics', () => {
  const state = deliverAll(publish(initial())); const repeated = retry(state, 'billing');
  assert.equal(repeated.current.deliveries[0].attempts, 2);
  assert.equal(repeated.current.deliveries[0].status, 'retry');
  assert.deepEqual(repeated.current.events, state.current.events);
  assert.equal(state.current.deliveries[0].attempts, 1);
});
test('114 safe unknown state preserves work and signals isolation rather than business success', () => {
  let state = deliverAll(publish(initial())); state = configureReader(state, 'billing', 'safe');
  assert.equal(state.current.deliveries[0].status, 'retry');
  state = retry(state, 'billing');
  assert.equal(state.current.deliveries[0].status, 'held');
  assert.equal(counts(state).done, 0);
  assert.match(state.current.deliveries[0].action, /暂停业务动作/);
  state = configureReader(state, 'billing', 'v2'); state = retry(state, 'billing');
  assert.equal(state.current.deliveries[0].status, 'done');
  assert.equal(state.current.deliveries[0].action, '暂缓结算');
  assert.equal(counts(state).retry, 2);
});
test('114 optional fields are compatible only for tolerant readers', () => {
  let state = configureWriter(initial(), { newState: false, extraField: true });
  state = configureReader(state, 'billing', 'legacy', true);
  state = deliverAll(publish(state));
  assert.equal(counts(state).done, 2); assert.equal(counts(state).retry, 1);
  assert.equal(evaluate(state.current.readers[0], state.current.events[0]).parses, false);
  state = configureReader(state, 'billing', 'legacy', false);
  state = retry(state, 'billing');
  assert.equal(counts(state).done, 3);
});
test('114 all readers upgraded first have explicitly different reviewing business actions', () => {
  let state = configureWriter(initial(), { newState: false });
  for (const reader of state.current.readers) state = configureReader(state, reader.id, 'v2');
  state = configureWriter(state, { newState: true }); state = deliverAll(publish(state));
  assert.equal(counts(state).done, 3);
  assert.deepEqual(state.current.deliveries.map(item => item.action), ['暂缓结算', '暂缓发货', '计入审核中']);
});
test('114 disabling writer new state cannot rewrite existing queue and publishing grows independent backlog', () => {
  let state = publish(initial()); state = configureWriter(state, { newState: false }); state = publish(state);
  assert.equal(state.current.events[0].status, 'reviewing'); assert.equal(state.current.events[1].status, 'paid');
  state = deliverAll(state); assert.equal(counts(state).retry, 3); assert.equal(counts(state).done, 3);
});
test('114 complete rewind restores exact history and editing after rewind drops future outcome', () => {
  const start = initial(); const next = advance(start); assert.deepEqual(rewind(next), start);
  const delivered = advance(next); assert.deepEqual(rewind(delivered), next);
  const branch = configureReader(rewind(delivered), 'billing', 'v2');
  const repaired = advance(branch); assert.equal(repaired.current.deliveries[0].status, 'done');
  assert.equal(repaired.current.deliveries[0].attempts, 1);
  assert.equal(delivered.current.deliveries[0].status, 'retry');
  assert.deepEqual(rewind(rewind(repaired)), next);
});
test('114 retry cannot replay completed business work or invent pending work', () => {
  const start = initial(); assert.equal(retry(start, 'billing'), start);
  const done = deliverAll(publish(configureWriter(start, { newState: false })));
  assert.equal(retry(done, 'billing'), done);
});
