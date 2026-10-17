import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryComparison, couponEligible, inspectShipping, specificationFee } from '../src/components/testing-lab/lesson81/model';

test('81: independent contract catches the exact threshold that a copied oracle misses', () => {
  const result = inspectShipping(100, 'buggy');
  assert.equal(result.actual, 10);
  assert.equal(result.specExpected, 0);
  assert.equal(result.copiedExpected, 10);
  assert.equal(result.copiedPass, true);
  assert.equal(result.specPass, false);
  assert.equal(result.outcome, 'spec-fails');
});
test('81: neighboring passing cases cannot establish the inclusive boundary', () => {
  assert.deepEqual(boundaryComparison('buggy').map(r => [r.amount, r.actual, r.specExpected, r.specPass]), [[99,10,10,true], [100,10,0,false], [101,0,0,true]]);
});
test('81: repair changes the boundary output while preserving both neighbors', () => {
  assert.deepEqual(boundaryComparison('fixed').map(r => [r.amount, r.actual, r.specPass]), [[99,10,true], [100,0,true], [101,0,true]]);
  for (let amount = 0; amount <= 200; amount++) {
    const result = inspectShipping(amount, 'fixed');
    assert.equal(result.specPass, true);
  }
});
test('81: specification has a declared integer domain and independent extremes', () => {
  assert.equal(specificationFee(0), 10);
  assert.equal(specificationFee(200), 0);
  for (const amount of [-1, 201, 99.5, NaN, Infinity]) assert.throws(() => specificationFee(amount), RangeError);
});
test('81: transfer uses a new inclusive coupon threshold', () => {
  assert.deepEqual([49, 50, 51, 80].map(couponEligible), [false, true, true, true]);
  assert.throws(() => couponEligible(-1), RangeError);
});
