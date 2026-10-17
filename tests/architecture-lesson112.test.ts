import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, configure, initial, inspect, rewind, checkContract, project } from '../src/components/architecture-lab/lesson112/model';
const finish = (state = initial()) => advance(advance(advance(state)));
test('112 direct encoding couples newly added domain fields to public output', () => {
  assert.equal(inspect(finish()).contract?.passes, true);
  const state = configure(initial(), { addedRisk: true });
  assert.equal(inspect(state).response, null);
  assert.deepEqual(inspect(advance(state)).routed, ['id', 'name', 'riskScore']);
  assert.equal(inspect(advance(advance(state))).response?.riskScore, 87);
  assert.deepEqual(inspect(finish(state)).contract?.unexpected, ['riskScore']);
});
test('112 DTO protects only with a correct whitelist and preserves chosen values', () => {
  let state = configure(initial(), { strategy: 'dto', addedRisk: true, name: '新姓名' });
  assert.deepEqual(inspect(finish(state)).response, { id: 'U-42', name: '新姓名' });
  assert.equal(inspect(finish(state)).contract?.passes, true);
  state = configure(state, { whitelist: ['id', 'name', 'riskScore'] });
  assert.equal(inspect(finish(state)).contract?.passes, false);
  state = configure(state, { whitelist: ['id'] });
  assert.deepEqual(inspect(finish(state)).contract?.missing, ['name']);
});
test('112 rewind and reconfiguration discard output and old future', () => {
  const state = initial();
  assert.deepEqual(rewind(advance(state)), state);
  const edited = configure(rewind(finish()), { addedRisk: true });
  assert.equal(edited.phase, 0);
  assert.equal(inspect(edited).response, null);
  assert.equal(inspect(finish(edited)).contract?.passes, false);
  assert.deepEqual(initial(state.config), state);
  assert.equal(advance(finish()).phase, 3);
});
test('112 projection ignores absent fields; contract catches extra and missing fields', () => {
  const domain = { sku: '7', price: 99, supplierCost: 35 };
  assert.deepEqual(project(domain, 'dto', ['sku', 'price', 'absent']), { sku: '7', price: 99 });
  assert.deepEqual(checkContract({ sku: '7', supplierCost: 35 }, ['sku', 'price']), { unexpected: ['supplierCost'], missing: ['price'], passes: false });
  const state = initial(); state.config.whitelist.pop();
  assert.deepEqual(initial().config.whitelist, ['id', 'name']);
});
