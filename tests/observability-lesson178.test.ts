import test from 'node:test';
import assert from 'node:assert/strict';
import { initialConfig, route, result, estimateCost, profileFits, comparison } from '../src/components/observability-lab/lesson178/model';
test('178 network separation, authorization and audit are independent boundaries', () => {
  assert.equal(result(initialConfig), 'allow');
  assert.equal(result({ ...initialConfig, gate: 'split' }), 'deny');
  assert.equal(result({ ...initialConfig, gate: 'internal', origin: 'internal' }), 'allow');
  const denied = route({ ...initialConfig, gate: 'guarded', origin: 'internal' });
  assert.equal(denied.at(-1)?.outcome, 'deny'); assert.match(denied.at(-1)!.detail, /审计/);
  assert.equal(result({ ...initialConfig, gate: 'guarded', origin: 'internal', authorized: true }), 'allow');
  assert.equal(result({ ...initialConfig, gate: 'guarded', authorized: true }), 'deny');
});
test('178 collection budget boundaries and CPU exclusivity', () => {
  assert.equal(result({ ...initialConfig, budget: 30 }), 'allow');
  assert.equal(result({ ...initialConfig, budget: 29 }), 'deny');
  assert.equal(result({ ...initialConfig, seconds: 31 }), 'deny');
  assert.equal(result({ ...initialConfig, concurrent: 2 }), 'deny');
  assert.equal(result({ ...initialConfig, seconds: 0 }), 'deny');
  assert.equal(result({ ...initialConfig, concurrent: Number.NaN }), 'deny');
  assert.equal(result({ ...initialConfig, concurrent: 1.5 }), 'deny');
  assert.equal(route({ ...initialConfig, budget: 0 }).every(h => h.cost === 0), true);
});
test('178 heap and goroutine snapshots use profile-specific costs', () => {
  assert.equal(estimateCost({ ...initialConfig, profile: 'heap', concurrent: 2 }), 24);
  assert.equal(estimateCost({ ...initialConfig, profile: 'goroutine', concurrent: 2 }), 12);
  assert.equal(result({ ...initialConfig, profile: 'heap', seconds: 60, concurrent: 2 }), 'allow');
  assert.equal(profileFits({ ...initialConfig, symptom: 'waiting', profile: 'cpu' }), false);
  assert.equal(profileFits({ ...initialConfig, symptom: 'waiting', profile: 'goroutine' }), true);
  assert.equal(profileFits({ ...initialConfig, symptom: 'memory', profile: 'heap' }), true);
});
test('178 comparison rejects confounded loads and mismatched evidence', () => {
  assert.match(comparison({ ...initialConfig, sameLoad: false }), /不能直接归因/);
  assert.match(comparison({ ...initialConfig, profile: 'heap' }), /不能替代/);
  assert.match(comparison(initialConfig), /相同 100 请求/);
  assert.deepEqual(initialConfig, { gate: 'public', origin: 'public', authorized: false, profile: 'cpu', symptom: 'cpu', seconds: 30, concurrent: 1, budget: 60, sameLoad: true });
});
