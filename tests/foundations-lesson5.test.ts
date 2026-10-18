import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, evaluate, initialInput, repairs, trace } from '../src/components/foundations-lab/lesson5/model';
test('5: runtime rounding remains visible and tolerance changes comparison only', () => {
  const strict = evaluate(initialInput);
  assert.equal(strict.sum, 0.30000000000000004);
  assert.equal(strict.difference, 5.551115123125783e-17);
  assert.equal(strict.equal, false);
  const approximate = evaluate({ ...initialInput, policy: 'absolute' });
  assert.equal(approximate.sum, strict.sum);
  assert.equal(approximate.equal, true);
  assert.equal(evaluate({ ...initialInput, a: 0.5, b: 0.25, target: 0.75 }).equal, true);
});
test('5: trace separates storage, addition and judgment and replay is deterministic', () => {
  const input = Object.freeze({ ...initialInput });
  const states = trace(input);
  assert.equal(states[0].a, null);
  assert.equal(states[1].a, 0.1);
  assert.equal(states[1].sum, null);
  assert.equal(states[2].sum, 0.1 + 0.2);
  assert.equal(states[2].equal, null);
  assert.equal(states[3].equal, false);
  assert.deepEqual(trace(input), states);
});
test('5: combined budget handles large magnitude and near zero without hiding real deviations', () => {
  for (const item of repairs) assert.equal(compare(item.left, item.right, 1e-9, 1e-8, 'combined').equal, item.expected);
  assert.equal(compare(repairs[0].left, repairs[0].right, 1e-9, 1e-8, 'absolute').equal, false);
  assert.equal(compare(1e-12, 0, 0, 1e-8, 'combined').equal, false);
  assert.equal(compare(2, 1, 1, 0, 'absolute').equal, false);
  assert.equal(compare(2, 1, 1.01, 0, 'absolute').equal, true);
  assert.equal(compare(1, 1, 0, 0, 'combined').equal, true);
});
test('5: special values and invalid budgets never accidentally pass', () => {
  for (const policy of ['exact', 'absolute', 'combined'] as const) {
    assert.equal(compare(NaN, NaN, 1e-9, 1e-9, policy).equal, false);
    assert.equal(compare(Infinity, Infinity, 1e-9, 1e-9, policy).equal, true);
    assert.equal(compare(Infinity, -Infinity, 1e-9, 1e-9, policy).equal, false);
    assert.equal(compare(-0, 0, 0, 0, policy).equal, true);
  }
  for (const tolerance of [-1, NaN, Infinity]) assert.throws(() => compare(1, 2, tolerance, 0, 'absolute'), RangeError);
  assert.throws(() => evaluate({ ...initialInput, scale: 0 }), RangeError);
  assert.throws(() => evaluate({ ...initialInput, a: NaN }), RangeError);
  assert.throws(() => evaluate({ ...initialInput, a: 1e308, scale: 1e9 }), RangeError);
});
