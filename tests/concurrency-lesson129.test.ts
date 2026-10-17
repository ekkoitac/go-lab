import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at, initial, outcome, schedule, step, type Config, type Timing, type Strategy } from '../src/components/concurrency-lab/lesson129/model';
const config: Config = { strategy: 'fields', timing: 'between', variant: 0 };
test('atomic fields permit a mixed pair without unsafe memory accesses', () => {
  const s = at(config, 4);
  assert.equal(outcome(s), 'mixed');
  assert.equal(s.readLimit?.value, 10);
  assert.equal(s.readBurst?.value, 40);
  assert.equal(s.readLimit?.version, 1);
  assert.equal(s.readBurst?.version, 2);
});
test('field stores expose an intermediate state and do not mutate earlier frames', () => {
  const first = at(config, 1);
  const second = step(config, first);
  assert.equal(second.limit.value, 30);
  assert.equal(second.burst.value, 20);
  assert.equal(first.limit.value, 10);
  assert.equal(first.log.length, 1);
  assert.equal(second.readBurst, null);
  assert.equal(outcome(second), null);
});
test('reloading a valid immutable snapshot per field still mixes versions', () => {
  const c: Config = { ...config, strategy: 'reload' };
  const s = at(c, schedule(c).length);
  assert.equal(outcome(s), 'mixed');
  assert.equal(s.held, null);
});
test('one retained snapshot preserves a complete pair for all publication timings and inputs', () => {
  for (const timing of ['before', 'between', 'after'] as Timing[]) for (const variant of [0, 1]) {
    const c: Config = { strategy: 'once', timing, variant };
    const s = at(c, schedule(c).length);
    assert.equal(outcome(s), timing === 'before' ? 'new' : 'old');
    assert.equal(s.readLimit?.version, s.readBurst?.version);
    assert.equal(s.held, timing === 'before' ? 2 : 1);
    assert.equal(s.published, 2);
  }
});
test('before and after schedules cannot demonstrate the interleaving defect', () => {
  for (const strategy of ['fields', 'reload'] as Strategy[]) for (const timing of ['before', 'after'] as Timing[]) {
    const c: Config = { ...config, strategy, timing };
    assert.equal(outcome(at(c, 99)), timing === 'before' ? 'new' : 'old');
  }
});
test('rewind recomputes deterministic state; reset has no reads or prediction', () => {
  assert.deepEqual(at(config, 0), initial(config));
  assert.deepEqual(at(config, 2), step(config, at(config, 1)));
  assert.equal(outcome(initial(config)), null);
  assert.equal('prediction' in initial(config), false);
  const done = at(config, 99);
  assert.equal(step(config, done), done);
});
