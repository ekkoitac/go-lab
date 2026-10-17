import test from 'node:test';
import assert from 'node:assert/strict';
import { findCycle, initialConfig, inspect } from '../src/components/architecture-lab/lesson103/model';

test('original notification dependency forms a cycle and blocks runtime', () => {
  const model = inspect(initialConfig);
  assert.deepEqual(model.cycle, ['order', 'notification', 'order']);
  assert.equal(model.builds, false);
  assert.deepEqual(model.runtime, []);
});
test('moving minimal data breaks the cycle but retains channel coupling', () => {
  const model = inspect({ ...initialConfig, strategy: 'data' });
  assert.equal(model.builds, true);
  assert.equal(model.independent, false);
  assert.equal(model.fits, false);
  assert.ok(model.edges.some(e => e.from === 'order' && e.to === 'notification'));
});
test('consumer port reverses source dependency without reversing runtime call', () => {
  const model = inspect({ ...initialConfig, strategy: 'port' });
  assert.equal(model.builds, true);
  assert.equal(model.independent, true);
  assert.equal(model.fits, true);
  assert.equal(model.edges.some(e => e.from === 'order' && e.to === 'notification'), false);
  assert.ok(model.edges.some(e => e.from === 'notification' && e.to === 'order'));
  assert.ok(model.runtime.indexOf('order.Place') < model.runtime.indexOf('notification.Send'));
});
test('leaking implementation types through data or port recreates an import cycle', () => {
  for (const strategy of ['data', 'port'] as const) {
    const model = inspect({ ...initialConfig, strategy, payload: 'full' });
    assert.equal(model.builds, false);
    assert.equal(model.cycle[0], model.cycle.at(-1));
    assert.deepEqual(model.runtime, []);
  }
});
test('merging fits the same concept condition, not independent channels', () => {
  const merged = inspect({ ...initialConfig, strategy: 'merge' });
  assert.equal(merged.builds, true);
  assert.equal(merged.fits, false);
  assert.equal(inspect({ ...initialConfig, strategy: 'merge', sameConcept: true }).fits, true);
  assert.equal(inspect({ ...initialConfig, strategy: 'port', sameConcept: true }).fits, false);
});
test('cycle detection handles shared dependencies, disconnected cycles and self loops', () => {
  const edge = (from: string, to: string) => ({ from, to, why: '' });
  assert.deepEqual(findCycle([edge('a', 'b'), edge('a', 'c'), edge('b', 'c')]), []);
  assert.deepEqual(findCycle([edge('a', 'b'), edge('c', 'c')]), ['c', 'c']);
  assert.deepEqual(findCycle([]), []);
});
test('inspection does not mutate input and is deterministic', () => {
  const config = Object.freeze({ ...initialConfig, strategy: 'port' as const });
  assert.deepEqual(inspect(config), inspect(config));
  assert.deepEqual(config, { strategy: 'port', payload: 'minimal', sameConcept: false });
});
