import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, initialPool, nextPool, poolAt, sourceFor } from '../src/components/engineering-lab/lesson95/model';
test('Pool empty fallback is nil without New and a new object with New', () => {
  const nil = poolAt(3, defaultConfig);
  assert.equal(nil.source, 'nil'); assert.equal(nil.owner, 'none'); assert.equal(nil.allocations, 1);
  const fresh = poolAt(3, { ...defaultConfig, hasNew: true });
  assert.equal(fresh.source, 'new'); assert.equal(fresh.id, 'buffer-2'); assert.equal(fresh.content, ''); assert.equal(fresh.allocations, 2);
});
test('selected reuse trace transfers ownership without implicit reset', () => {
  const config = { ...defaultConfig, discard: false };
  const put = poolAt(1, config); assert.equal(put.owner, 'pool'); assert.equal(put.content, 'A:订单;');
  const get = poolAt(3, config); assert.equal(get.owner, 'B'); assert.equal(get.pool, null); assert.equal(get.id, 'buffer-1'); assert.equal(get.allocations, 1);
  assert.equal(poolAt(4, config).content, 'A:订单;B:响应;');
  assert.equal(poolAt(4, { ...config, resetOnPut: true }).content, 'B:响应;');
});
test('post-Put alias write is invalid in every branch but only affects B when sharing', () => {
  for (const discard of [false, true]) {
    const s = poolAt(5, { ...defaultConfig, hasNew: true, resetOnPut: true, staleWrite: true, discard });
    assert.equal(s.violation, true); assert.equal(s.content, discard ? 'B:响应;' : 'B:响应;A:越权;');
  }
});
test('replay is deterministic, immutable and terminal steps do not mutate', () => {
  const start = initialPool(); const put = nextPool(start, defaultConfig);
  assert.equal(start.step, 0); assert.equal(start.owner, 'A'); assert.equal(put.step, 1);
  const end = poolAt(5, defaultConfig); assert.equal(nextPool(end, defaultConfig), end);
  assert.deepEqual(poolAt(3, defaultConfig), poolAt(3, defaultConfig));
  assert.equal(poolAt(-1, defaultConfig).step, 0); assert.equal(poolAt(99, defaultConfig).step, 5);
});
test('source predictions match all controlled branches without pretending Put guarantees reuse', () => {
  for (const discard of [true, false]) for (const hasNew of [true, false]) {
    const config = { ...defaultConfig, discard, hasNew };
    assert.equal(sourceFor(config), poolAt(3, config).source);
  }
});
