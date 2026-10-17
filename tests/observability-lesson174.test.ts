import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addsSeries, defaultConfig, routeLabel, snapshot, summarize, transferRows } from '../src/components/observability-lab/lesson174/model';
test('174 removing query does not remove dynamic path IDs', () => {
  assert.equal(routeLabel('/orders/7?a=1', 'path'), '/orders/7');
  assert.notEqual(routeLabel('/orders/7?a=1', 'path'), routeLabel('/orders/8?a=1', 'path'));
  assert.equal(routeLabel('/orders/7?a=1', 'template'), '/orders/:id');
});
test('174 finite teaching route classifier sends unknown and nested paths to unmatched', () => {
  for (const path of ['/orders/', '/orders/a/b', '/evil/1', '', '/orders']) assert.equal(routeLabel(path, 'template'), 'unmatched');
  assert.equal(routeLabel('/orders/88?x=/nested', 'template'), '/orders/:id');
});
test('174 query variations add raw series but do not add normalized series', () => {
  assert.equal(addsSeries(defaultConfig, 0), true);
  assert.equal(addsSeries(defaultConfig, 1), false);
  const state = snapshot(defaultConfig, 2);
  assert.equal(state.results.raw.observed, 2);
  assert.equal(state.results.path.observed, 1);
  assert.equal(state.results.template.observed, 1);
});
test('174 actual combinations are distinct from Cartesian upper bound', () => {
  const result = summarize(transferRows, 'template', true, { statuses: 2, tenants: 2 });
  assert.equal(result.observed, 4); assert.equal(result.upper, 8);
  assert.equal(summarize(transferRows, 'template', false, { statuses: 2, tenants: 2 }).observed, 3);
  assert.equal(summarize(transferRows, 'template', false, { statuses: 2, tenants: 2 }).upper, 4);
});
test('174 replay is deterministic and rewind removes only no-longer-observed combinations', () => {
  const end = snapshot(defaultConfig, 100);
  assert.equal(end.cursor, 8); assert.equal(end.results.template.observed, 3);
  assert.equal(snapshot(defaultConfig, 7).results.template.observed, 3);
  assert.equal(snapshot(defaultConfig, 6).results.template.observed, 2);
  assert.equal(snapshot(defaultConfig, 0).results.template.observed, 0);
  assert.equal(snapshot(defaultConfig, 0).results.template.upper, 4);
});
