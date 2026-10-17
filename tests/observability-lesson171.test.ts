import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, defaultConfig, payments, snapshot } from '../src/components/observability-lab/lesson171/model';
test('171 mature denominator excludes ineligible and next-window records', () => {
  assert.equal(snapshot(defaultConfig, 4).denominator, 0);
  assert.equal(snapshot(defaultConfig, 5).denominator, 2);
  const state = snapshot(defaultConfig, 6);
  assert.equal(state.denominator, 5); assert.equal(state.good, 2); assert.equal(state.ratio, 0.4); assert.equal(state.acceptedHttpSuccess, 1);
});
test('171 deadline inclusive; late success cannot repair timely SLI', () => {
  assert.equal(snapshot({ ...defaultConfig, slowMinutes: 5 }, 6).good, 3);
  assert.equal(snapshot(defaultConfig, 7).good, 2);
  const a = payments(defaultConfig)[0];
  assert.equal(classify(a, 2, 'good').denominator, 0); assert.equal(classify(a, 5, 'good').good, 1);
});
test('171 rejection changes numerator only; failure and cancellation stay bad', () => {
  const state = snapshot({ ...defaultConfig, rejection: 'bad' }, 6);
  assert.equal(state.denominator, 5); assert.equal(state.good, 1);
  for (const id of ['D', 'G']) assert.equal(state.rows.find(row => row.id === id)?.good, 0);
});
test('171 acceptance determines cohort even when terminal is in next window', () => {
  const rows = payments(defaultConfig);
  assert.equal(classify(rows[0], 7, 'good', [0, 2]).denominator, 1);
  assert.equal(classify(rows[5], 7, 'good', [0, 2]).denominator, 0);
  assert.equal(classify(rows[5], 7, 'good', [2, 4]).denominator, 1);
  assert.equal(classify(rows[4], 7, 'good', [0, 2]).denominator, 0);
});
