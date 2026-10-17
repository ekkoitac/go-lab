import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, initial, meanInFlight, metrics, predictionOutcome, run, step } from '../src/components/operations-lab/lesson169/model';

test('169: seconds conversion and steady mean relationship', () => {
  assert.equal(meanInFlight(1000, 50), 50);
  assert.equal(meanInFlight(1000, 200), 200);
  assert.equal(meanInFlight(800, 100), 80);
});
test('169: service completions occur after full service duration and history remains immutable', () => {
  const start = initial();
  const next = step(start, defaults);
  assert.equal(next.active.length, 10);
  assert.equal(next.timeMs, 10);
  assert.equal(start.active.length, 0);
  assert.equal(run(defaults, 5).completed, 0);
  assert.equal(run(defaults, 6).completed, 10);
  assert.equal(run(defaults, 6).active.length, 50);
});
test('169: finite window boundary prevents naive equality with completion sample metrics', () => {
  const state = run(defaults, 100);
  const m = metrics(state);
  assert.equal(state.completed, 950);
  assert.equal(m.completedW, 50);
  assert.equal(m.averageL, 48.5);
  assert.equal(m.throughput, 950);
  assert.equal(m.unfinished, 50);
  assert.notEqual(m.averageL, meanInFlight(m.throughput, m.completedW));
});
test('169: constrained queue grows and waiting increases residence while capacity remains bounded', () => {
  const config = { ...defaults, capacity: 20 };
  const a = run(config, 50);
  const b = run(config, 100);
  assert.ok(b.queue.length > a.queue.length);
  assert.ok(metrics(b).completedW > defaults.serviceMs);
  assert.equal(b.active.length, 20);
  assert.equal(b.rejected, 0);
  assert.equal(predictionOutcome(config), 'grow');
});
test('169: admission rejects excess requests without queueing and conserves counts', () => {
  const config = { ...defaults, capacity: 20, admission: 'reject' as const };
  const state = run(config, 100);
  assert.equal(state.queue.length, 0);
  assert.ok(state.rejected > 0);
  assert.equal(metrics(state).completedW, 50);
  assert.equal(state.arrivals, state.completed + state.rejected + state.active.length);
  assert.equal(predictionOutcome(config), 'reject');
});
test('169: conservation and deterministic rewind hold across configurations', () => {
  for (const qps of [100, 1000, 2000]) for (const capacity of [10, 50, 200]) for (const admission of ['queue', 'reject'] as const) {
    const config = { ...defaults, qps, capacity, admission };
    const state = run(config, 100);
    assert.equal(state.arrivals, state.completed + state.rejected + state.active.length + state.queue.length);
    assert.ok(state.active.length <= capacity);
    assert.deepEqual(step(run(config, 99), config), state);
  }
});
test('169: adequate capacity gives no persistent queue in this deterministic model', () => {
  const state = run(defaults, 100);
  assert.equal(state.queue.length, 0);
  assert.equal(state.rejected, 0);
  assert.equal(predictionOutcome(defaults), 'clear');
});
