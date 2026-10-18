import test from 'node:test';
import assert from 'node:assert/strict';
import { allCandidates, buildTree, initial, resolve, shippingPath } from '../src/components/types-lab/lesson23/model';

test('23: equal shallow depth is ambiguous regardless of declaration order', () => {
  const tree = buildTree(initial);
  assert.equal(resolve(tree, 'o.City').outcome, 'ambiguous');
  tree.children.reverse();
  assert.equal(resolve(tree, 'o.City').outcome, 'ambiguous');
  assert.deepEqual(resolve(tree, 'o.City').candidates.map(c => c.depth), [1, 1]);
});
test('23: a unique shallow candidate wins over a deeper duplicate', () => {
  const tree = buildTree({ ...initial, shipping: 'nested' });
  assert.equal(resolve(tree, 'o.City').selected?.path, 'o.Billing.City');
  assert.equal(resolve(tree, 'o.Envelope.City').selected?.value, '杭州');
  assert.equal(resolve(tree, 'o.Envelope.City').selected?.depth, 1);
});
test('23: outer shadowing preserves explicit access to both inner fields', () => {
  const tree = buildTree({ ...initial, outer: true });
  assert.equal(resolve(tree, 'o.City').selected?.value, '北京');
  assert.equal(resolve(tree, 'o.Billing.City').selected?.value, '上海');
  assert.equal(resolve(tree, 'o.Shipping.City').selected?.value, '杭州');
  assert.equal(allCandidates(tree).length, 3);
});
test('23: removing a branch resolves ambiguity; removing all creates missing selector', () => {
  assert.equal(resolve(buildTree({ ...initial, billing: false }), 'o.City').outcome, 'shipping');
  assert.equal(resolve(buildTree({ ...initial, billing: false, shipping: 'off' }), 'o.City').outcome, 'missing');
});
test('23: Shipping itself can be promoted from Envelope; both explicit paths are valid', () => {
  const config = { ...initial, shipping: 'nested' as const };
  const tree = buildTree(config);
  assert.equal(resolve(tree, 'o.Shipping.City').selected?.value, '杭州');
  assert.equal(resolve(tree, shippingPath(config)).selected?.value, '杭州');
  assert.equal(resolve(tree, 'o.Envelope.Billing.City').outcome, 'missing');
});
test('23: explicit repair changes target without modifying structure or stored values', () => {
  const tree = buildTree(initial);
  const before = structuredClone(tree);
  assert.equal(resolve(tree, 'o.City').outcome, 'ambiguous');
  assert.equal(resolve(tree, shippingPath(initial)).outcome, 'shipping');
  assert.deepEqual(tree, before);
});
test('23: transfer cities do not influence selector rules', () => {
  const tree = buildTree({ ...initial, shipping: 'nested', outer: true }, { outer: '西安', billing: '成都', shipping: '苏州' });
  assert.equal(resolve(tree, 'o.City').selected?.value, '西安');
  assert.equal(resolve(tree, 'o.Envelope.Shipping.City').selected?.value, '苏州');
  assert.equal(resolve(tree, 'other.City').outcome, 'missing');
});

