import test from 'node:test';
import assert from 'node:assert/strict';
import { cents, inspect, initialConfig } from '../src/components/architecture-lab/lesson105/model.ts';
test('integer rounding distinguishes half cents and exact-cent boundary', () => {
  assert.equal(cents(1005, 'nearest'), 101); assert.equal(cents(1005, 'down'), 100);
  assert.equal(cents(1010, 'nearest'), cents(1010, 'down'));
  assert.equal(cents(0, 'nearest'), 0);
  for (const n of [-1, 1.5, NaN, Infinity, 1000001]) assert.throws(() => cents(n, 'nearest'));
});
test('publishing a library alone does not upgrade consumers; all-rules reuse propagates the wrong rule', () => {
  assert.equal(inspect(initialConfig, 1).settlement, 101);
  assert.equal(inspect(initialConfig, 2).settlement, 100);
  assert.equal(inspect(initialConfig, 2).marketing, 101);
  const result = inspect(initialConfig, 3);
  assert.equal(result.marketing, 100); assert.equal(result.marketingMatches, false); assert.equal(result.upgrades, 2);
});
test('sharing representation permits local rule evolution', () => {
  const result = inspect({ ...initialConfig, strategy: 'representation' }, 3);
  assert.equal(result.marketing, 101); assert.equal(result.settlement, 100);
  assert.equal(result.marketingMatches, true); assert.equal(result.upgrades, 1);
});
test('same output at a boundary does not remove coupling or upgrade cost', () => {
  const result = inspect({ ...initialConfig, mills: 1010 }, 3);
  assert.equal(result.changedMarketing, false); assert.equal(result.marketingUpdated, true); assert.equal(result.upgrades, 2);
});
test('shared owner is required for shared publication, not independent business fixes', () => {
  assert.equal(inspect({ ...initialConfig, owner: false }, 3).blocked, true);
  assert.equal(inspect({ ...initialConfig, owner: false }, 3).upgrades, 0);
  assert.equal(inspect({ ...initialConfig, strategy: 'representation', owner: false }, 3).settlement, 100);
});
test('common validation benefits from one implementation but still requires two consumer upgrades', () => {
  const config = { ...initialConfig, strategy: 'representation' as const, change: 'currency' as const, currency: 'XYZ' as const };
  assert.equal(inspect(config, 2).marketing, 101); assert.equal(inspect(config, 2).settlement, null);
  const result = inspect(config, 3);
  assert.equal(result.marketing, null); assert.equal(result.implementations, 1); assert.equal(result.upgrades, 2);
  assert.equal(inspect({ ...config, strategy: 'local' }, 3).implementations, 2);
  assert.equal(inspect({ ...config, currency: 'CNY' }, 3).marketing, 101);
});
test('phase replay is deterministic and inputs are not mutated', () => {
  const config = { ...initialConfig }; const before = inspect(config, 0);
  inspect(config, 1); assert.deepEqual(inspect(config, 0), before); assert.deepEqual(config, initialConfig);
  assert.throws(() => inspect(config, -1));
});
