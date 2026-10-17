import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, expiry, initial, peak, simulate, transition } from '../src/components/cache-message-lab/lesson143/model';

test('fixed TTL concentrates all twelve queries at 300 seconds', () => {
  const windows = simulate(defaults);
  assert.equal(windows[0].requests, 12);
  assert.equal(windows[0].overloaded, 8);
  assert.ok(windows.slice(1).every(w => w.requests === 0));
});
test('deterministic jitter conserves keys and requests and stays within allowed age', () => {
  const config = { ...defaults, jitter: true };
  assert.deepEqual(expiry(config), expiry(config));
  assert.ok(expiry(config).every(k => k.time >= 300 && k.time <= 360));
  assert.equal(new Set(expiry(config).map(k => k.key)).size, 12);
  assert.equal(simulate(config).reduce((n, w) => n + w.requests, 0), 12);
  assert.ok(peak(config) < 12);
  assert.equal(peak({ ...config, spread: 0 }), 12);
});
test('jitter cannot split a single hot key but request coalescing can', () => {
  const hot = { ...defaults, hot: true, jitter: true };
  assert.equal(peak(hot), 12);
  const merged = simulate({ ...hot, merge: true });
  assert.equal(peak({ ...hot, merge: true }), 1);
  assert.equal(merged.reduce((n, w) => n + w.merged, 0), 11);
  assert.equal(peak({ ...defaults, merge: true }), 12, 'distinct keys cannot share one query');
});
test('gate bounds database load but admission is not request success', () => {
  const w = simulate({ ...defaults, gate: true, budget: 3 })[0];
  assert.equal(w.admitted, 3); assert.equal(w.rejected, 9); assert.equal(w.overloaded, 0);
  assert.equal(w.queries, w.admitted + w.rejected);
  assert.equal(simulate({ ...defaults, gate: true, budget: 8 })[0].overloaded, 4, 'oversized gate is not safe');
});
test('prediction and rationale precede reveal; rewind is deterministic; edits start new experiment', () => {
  const start = initial();
  assert.equal(transition(start, { type: 'step' }), start);
  let predicted = transition(start, { type: 'predict', value: 'overload' });
  assert.equal(transition(predicted, { type: 'step' }), predicted);
  predicted = transition(predicted, { type: 'reason', value: '12 requests arrive together' });
  const first = transition(predicted, { type: 'step' });
  assert.equal(first.cursor, 0); assert.equal(first.submitted, true);
  assert.equal(transition(first, { type: 'predict', value: 'safe' }), first);
  assert.deepEqual(transition(transition(first, { type: 'back' }), { type: 'step' }), first);
  const changed = transition(first, { type: 'configure', patch: { jitter: true } });
  assert.equal(changed.cursor, -1); assert.equal(changed.prediction, ''); assert.equal(changed.reason, '');
  assert.equal(start.config.jitter, false);
});
