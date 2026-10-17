import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, defaults, initial, pause, rollback, type State } from '../src/components/delivery-lab/lesson195/model';
const run = (start: State) => { let s = start; for (let i = 0; i < 20; i++) { const next = advance(s); if (next === s) break; s = next; } return s; };

test('representative canary pauses on pricing semantics although CPU is healthy', () => {
  const s = run(initial());
  assert.equal(s.phase, 'paused'); assert.equal(s.traffic, 5);
  assert.equal(s.observedError, 8); assert.equal(s.badOrders, 4);
  assert.match(s.note, /CPU 正常/);
});
test('identical defect exposes increasing first-batch harm across canary rolling and blue-green', () => {
  const results = (['canary', 'rolling', 'blueGreen'] as const).map(strategy => run(initial({ ...defaults, strategy, extraCapacity: 100 })));
  assert.deepEqual(results.map(s => s.traffic), [5, 25, 100]);
  assert.deepEqual(results.map(s => s.badOrders), [4, 20, 80]);
});
test('blue-green capacity is checked before real requests are routed', () => {
  const s = run(initial({ ...defaults, strategy: 'blueGreen', extraCapacity: 20 }));
  assert.equal(s.traffic, 0); assert.equal(s.samples, 0); assert.match(s.note, /容量不足/);
});
test('internal-only observations cannot justify expanding traffic', () => {
  const s = run(initial({ ...defaults, representative: false }));
  assert.equal(s.observedError, 0); assert.equal(s.phase, 'paused'); assert.equal(s.traffic, 5); assert.match(s.note, /证据不足/);
});
test('rollback changes future routing without undoing written orders', () => {
  const stopped = run(initial()); const restored = rollback(stopped);
  assert.equal(restored.traffic, 0); assert.equal(restored.badOrders, stopped.badOrders);
  assert.equal(restored.samples, stopped.samples); assert.equal(advance(restored), restored);
});
test('compatible fixed version completes all canary stages; loose threshold admits faulty orders', () => {
  const healthy = run(initial({ ...defaults, pricingBug: false }));
  assert.equal(healthy.phase, 'complete'); assert.equal(healthy.traffic, 100); assert.equal(healthy.badOrders, 0);
  const loose = run(initial({ ...defaults, threshold: 10 }));
  assert.equal(loose.phase, 'complete'); assert.equal(loose.badOrders, 140);
});
test('incompatible storage blocks before exposure and explicit pause holds current traffic', () => {
  const incompatible = run(initial({ ...defaults, compatible: false }));
  assert.equal(incompatible.traffic, 0); assert.match(incompatible.note, /状态不兼容/);
  const routed = advance(advance(initial())); const stopped = pause(routed);
  assert.equal(stopped.traffic, 5); assert.equal(advance(stopped), stopped);
  assert.equal(routed.phase, 'observe'); assert.equal(routed.badOrders, 0);
});
