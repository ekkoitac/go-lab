import test from 'node:test';
import assert from 'node:assert/strict';
import { bits16, inspect, narrow, snapshot } from '../src/components/foundations-lab/lesson3/model';
test('3: integer narrowing preserves low eight bits, including negative two-complement values', () => {
  assert.deepEqual([-32768, -257, -256, -1, 0, 17, 255, 256, 300, 32767].map(narrow), [0, 255, 0, 255, 0, 17, 255, 0, 44, 255]);
  assert.equal(bits16(300), '0000000100101100');
  assert.equal(bits16(-1), '1111111111111111');
});
test('3: before-conversion guard and constant representability prevent a byte being generated', () => {
  for (const n of [-32768, -1, 256, 300, 32767]) {
    assert.equal(inspect({ input: n, policy: 'before' }).output, '拒绝');
    assert.equal(inspect({ input: n, policy: 'before' }).encoded, null);
    assert.equal(inspect({ input: n, policy: 'constant' }).output, '编译错误');
    assert.equal(inspect({ input: n, policy: 'constant' }).encoded, null);
  }
  for (let n = 0; n <= 255; n++) for (const policy of ['direct', 'before', 'after', 'constant'] as const) assert.equal(inspect({ input: n, policy }).output, String(n));
});
test('3: guard after conversion cannot detect lost input information', () => {
  for (const n of [-1, 256, 300]) assert.deepEqual(inspect({ input: n, policy: 'after' }), inspect({ input: n, policy: 'direct' }));
  assert.equal(narrow(273), narrow(17));
  assert.equal(narrow(529), narrow(17));
  assert.equal(inspect({ input: 273, policy: 'before' }).encoded, null);
});
test('3: replay exposes checks then bits then final output, rewind is deterministic', () => {
  const c = { input: 300, policy: 'direct' as const };
  assert.equal(snapshot(c, 0).encoded, null);
  assert.equal(snapshot(c, 1).encoded, null);
  assert.equal(snapshot(c, 2).encoded, 44);
  assert.equal(snapshot(c, 2).output, null);
  assert.equal(snapshot(c, 3).output, '44');
  assert.deepEqual(snapshot(c, 1), snapshot(c, 1));
  assert.equal(snapshot({ ...c, policy: 'before' }, 2).encoded, null);
  assert.equal(snapshot({ ...c, policy: 'before' }, 3).output, '拒绝');
});
test('3: model rejects fractional, nonfinite and out-of-domain inputs', () => {
  for (const n of [NaN, Infinity, -Infinity, 1.5, 32768, -32769]) assert.throws(() => narrow(n), RangeError);
});
