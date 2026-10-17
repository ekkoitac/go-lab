import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialConfig, observe } from '../src/components/engineering-lab/lesson99/model';

test('99 identical error text does not imply an unwrap relationship', () => {
  const textOnly = observe({ ...initialConfig, wrap: 'v' }, 2);
  const wrapped = observe({ ...initialConfig, wrap: 'w' }, 2);
  assert.equal(textOnly.text, wrapped.text);
  assert.equal(textOnly.isTimeout, false);
  assert.equal(wrapped.isTimeout, true);
  assert.equal(textOnly.errorChain.length, 1);
  assert.equal(wrapped.errorChain.length, 2);
});

test('99 labels change series cardinality while preserving event total', () => {
  for (let requests = 2; requests <= 8; requests++) {
    const grouped = observe({ ...initialConfig, requests, labels: 'stage' }, 3);
    const perOrder = observe({ ...initialConfig, requests, labels: 'order' }, 3);
    assert.equal(grouped.series.length, 1);
    assert.equal(perOrder.series.length, requests);
    assert.equal(grouped.series.reduce((n, s) => n + s.count, 0), requests);
    assert.equal(perOrder.series.reduce((n, s) => n + s.count, 0), requests);
  }
});

test('99 changing trace bottleneck leaves aggregate errors and wrapping intact', () => {
  const inventory = observe(initialConfig, 4);
  const payment = observe({ ...initialConfig, slow: 'payment' }, 4);
  assert.deepEqual(inventory.series, payment.series);
  assert.equal(inventory.isTimeout, payment.isTimeout);
  assert.equal(inventory.spans[1].duration, 90);
  assert.equal(payment.spans[2].duration, 90);
  for (const snapshot of [inventory, payment]) {
    assert.equal(snapshot.spans[2].start, snapshot.spans[1].start + snapshot.spans[1].duration);
    assert.ok(snapshot.spans[2].start + snapshot.spans[2].duration <= snapshot.spans[0].duration);
  }
});

test('99 replay is deterministic and earlier phases do not expose later signals', () => {
  const config = { ...initialConfig };
  observe(config, 4);
  assert.deepEqual(config, initialConfig);
  assert.equal(observe(config, 0).text, '');
  assert.equal(observe(config, 1).isTimeout, null);
  assert.deepEqual(observe(config, 2).series, []);
  assert.deepEqual(observe(config, 3).spans, []);
  assert.deepEqual(observe(config, 4), observe(config, 99));
});
