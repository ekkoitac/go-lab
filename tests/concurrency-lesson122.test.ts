import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, at, defaults, finished, initial, run } from '../src/components/concurrency-lab/lesson122/model';

test('shared deadline completes core data and degrades optional recommendation within root budget', () => {
  const state = run(defaults, 'shared');
  assert.equal(state.response, 'ok');
  assert.equal(state.responseAt, 280);
  assert.deepEqual(state.calls.map(c => c.status), ['ok', 'ok', 'timeout']);
  assert.equal(state.calls[2].deadline, 260);
  assert.equal(state.peak, 2);
});
test('renewed local deadline leaves downstream running after client deadline', () => {
  const expired = at(defaults, 'renewed', 15);
  assert.equal(expired.response, 'deadline');
  assert.equal(expired.responseAt, 300);
  assert.equal(expired.calls[2].status, 'running');
  assert.equal(finished(expired), false);
  const final = run(defaults, 'renewed');
  assert.equal(final.calls[2].end, 440);
  assert.equal(final.response, 'deadline', 'late dependency success cannot revive client');
});
test('queue time and concurrency both affect ability to complete required dependencies', () => {
  assert.equal(run({ queue: 120, slots: 1, retry: false }, 'shared').response, 'failed');
  assert.equal(run({ queue: 120, slots: 2, retry: false }, 'shared').response, 'ok');
  assert.equal(run({ queue: 220, slots: 3, retry: false }, 'shared').response, 'failed');
});
test('retry keeps inherited deadline but detached retry renews budget', () => {
  const config = { queue: 80, slots: 2, retry: true };
  const shared = at(config, 'shared', 7).calls[0];
  const renewed = at(config, 'renewed', 7).calls[0];
  assert.equal(shared.attempt, 2);
  assert.equal(shared.start, 140);
  assert.equal(shared.deadline, 280);
  assert.equal(renewed.deadline, 440);
  assert.deepEqual(shared.spans, [{ start: 80, end: 140, retry: false }]);
});
test('no remaining downstream budget prevents any new shared call', () => {
  for (const queue of [280, 300, 320]) {
    const state = run({ queue, slots: 3, retry: false }, 'shared');
    assert.equal(state.response, 'failed');
    assert.equal(state.responseAt, 300);
    assert.equal(state.peak, 0);
    assert.ok(state.calls.every(c => c.attempt === 0 && c.status === 'cancelled'));
  }
});
test('advancing is immutable and timeline replay restores exactly the same state', () => {
  const start = initial(defaults, 'shared');
  const copy = structuredClone(start);
  const next = advance(start);
  assert.deepEqual(start, copy);
  assert.equal(next.now, 20);
  assert.deepEqual(at(defaults, 'shared', 1), next);
  const final = run(defaults, 'shared');
  assert.equal(advance(final), final);
});
test('all queue, slot, and retry choices preserve concurrency and inherited boundaries', () => {
  for (const slots of [1, 2, 3]) for (const queue of [0, 80, 120, 220, 280, 320]) for (const retry of [false, true]) {
    let state = initial({ queue, slots, retry }, 'shared');
    for (let i = 0; i < 50 && !finished(state); i++) {
      assert.ok(state.calls.filter(c => c.status === 'running').length <= slots);
      assert.ok(state.calls.every(c => c.deadline === null || c.deadline <= 280));
      state = advance(state);
    }
    assert.ok(finished(state));
    assert.ok(state.responseAt! <= 300);
    assert.ok(state.calls.every(c => c.end! <= 280));
  }
});
test('completion exactly on child deadline uses documented timeout tie rule', () => {
  const state = run({ queue: 160, slots: 2, retry: false }, 'shared');
  assert.equal(state.calls[1].status, 'timeout');
  assert.equal(state.calls[1].end, 280);
  assert.equal(state.response, 'failed');
});

