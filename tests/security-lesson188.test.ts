import test from 'node:test';
import assert from 'node:assert/strict';
import {assess, back, configure, createState, exposure, initialConfig, step} from '../src/components/security-lab/lesson188/model';

test('188 matching checksum does not remove reachable vulnerability', () => {
  const result = assess(initialConfig);
  assert.equal(initialConfig.checksum, true);
  assert.equal(result.exposure, 'reachable');
  assert.equal(result.decision, 'block');
});
test('188 changing edges and build tags changes exposure, incomplete evidence stays unknown', () => {
  assert.equal(exposure({...initialConfig, callEdge: false}), 'unreachable');
  assert.equal(exposure({...initialConfig, productionTag: false, scanTag: false}), 'unreachable');
  assert.equal(exposure({...initialConfig, scanTag: false}), 'unknown');
  assert.equal(exposure({...initialConfig, buildEvidence: false, callEdge: false}), 'unknown');
  assert.equal(exposure({...initialConfig, version: '1.1'}), 'no-known');
});
test('188 unknown publisher and missing review prevent release even for fixed version', () => {
  const repaired = {...initialConfig, version: '1.1' as const, review: true, tests: true, rollback: true};
  assert.equal(assess(repaired).decision, 'conditional');
  for (const field of ['review', 'tests', 'rollback', 'buildEvidence'] as const) assert.equal(assess({...repaired, [field]: false}).decision, 'hold');
  assert.equal(assess({...repaired, source: 'unverified'}).decision, 'hold');
  assert.equal(assess({...repaired, checksum: false}).decision, 'block');
});
test('188 prediction and explanation gate execution; history restores branch and evidence', () => {
  const empty = createState();
  assert.equal(step(empty), empty);
  assert.equal(step({...empty, prediction: 'reachable'}).phase, 0);
  const predicted = {...empty, prediction: 'reachable' as const, reason: 'production reaches Decode'};
  const first = step(predicted);
  assert.equal(first.phase, 1);
  assert.deepEqual(back(first), predicted);
  const changed = configure(first, {callEdge: false});
  assert.equal(changed.phase, 0);
  assert.equal(changed.prediction, '');
  assert.equal(changed.reason, '');
  assert.equal(changed.config.callEdge, false);
  assert.deepEqual(back(changed), first);
  const final = step(step(first));
  assert.equal(final.phase, 3);
  assert.equal(step(final), final);
  assert.deepEqual(createState().config, initialConfig);
});
