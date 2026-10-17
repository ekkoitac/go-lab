import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costs, defaults, predictionMatches, snapshot } from '../src/components/engineering-lab/lesson91/model';
test('optimizing small and large components has different end-to-end gains', () => {
  assert.equal(costs(defaults).total, 95);
  assert.equal(costs({ ...defaults, target: 'network' }).total, 55);
  assert.equal(costs({ ...defaults, cpu: 70, target: 'network' }).total, 85);
});
test('unchanged component bounds the gain even with a huge speedup', () => {
  const result = costs({ cpu: 10, target: 'cpu', speedup: 1_000_000 });
  assert.equal(result.after.network, 90);
  assert.ok(result.total > 90 && result.total < 90.001);
  assert.equal(result.unaffected, 90);
});
test('zero share cannot improve and factor one preserves total', () => {
  assert.equal(costs({ cpu: 0, target: 'cpu', speedup: 10 }).total, 100);
  assert.equal(costs({ ...defaults, speedup: 1 }).total, 100);
  assert.equal(costs({ cpu: 100, target: 'cpu', speedup: 2 }).total, 50);
});
test('replay restores baseline and result appears only at the execution step', () => {
  assert.equal(snapshot(defaults, 1).total, 100);
  assert.equal(snapshot(defaults, 1).revealed, false);
  assert.equal(snapshot(defaults, 2).total, 95);
  assert.equal(snapshot(defaults, 3).verified, true);
  assert.equal(snapshot(defaults, 0).total, 100);
});
test('invalid measurements and blank predictions cannot silently pass', () => {
  assert.throws(() => costs({ ...defaults, cpu: 101 }));
  assert.throws(() => costs({ ...defaults, speedup: 0 }));
  assert.throws(() => costs({ ...defaults, cpu: Number.NaN }));
  assert.equal(predictionMatches('', 0), false);
  assert.equal(predictionMatches('95', 95), true);
  assert.equal(predictionMatches('50', 95), false);
});
