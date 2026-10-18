import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, initial, repair, payloads, targets, handle, type Payload } from '../src/components/types-lab/lesson25/model';
test('single mismatch panics without assigning zero; comma ok produces target zero', () => {
  assert.equal(inspect(initial).outcome, 'panic');
  assert.equal(inspect(initial).value, null);
  assert.equal(inspect(repair(initial)).value, '""');
  assert.equal(inspect(repair(initial)).ok, false);
  assert.equal(initial.form, 'single');
});
test('assertion does not convert float or named integer to int', () => {
  for (const payload of ['float64', 'Version'] as const) {
    assert.equal(inspect({ payload, target:'int', form:'checked' }).ok, false);
    assert.equal(inspect({ payload, target:payload, form:'checked' }).value, '42');
  }
});
test('typed nil assertion succeeds for pointer while nil interface fails', () => {
  const typed = inspect({ payload:'typedNil', target:'*Version', form:'checked' });
  const empty = inspect({ payload:'nil', target:'*Version', form:'checked' });
  assert.equal(typed.value, 'nil');
  assert.equal(empty.value, 'nil');
  assert.equal(typed.ok, true);
  assert.equal(empty.ok, false);
});
test('empty string success differs from failure by ok, not value', () => {
  const success = inspect({ payload:'empty', target:'string', form:'checked' });
  const failure = inspect(repair(initial));
  assert.equal(success.value, failure.value);
  assert.notEqual(success.ok, failure.ok);
});
test('guarded repair satisfies acceptance contract for every represented payload', () => {
  for (const payload of Object.keys(payloads) as Payload[]) assert.equal(handle(payload, 'guard').contract, true);
  assert.equal(handle('int','single').contract, false);
  assert.equal(handle('int','ignore').contract, false);
  assert.equal(handle('empty','guard').accepted, true);
});
test('all concrete targets use exact dynamic identity without mutating source', () => {
  for (const payload of Object.keys(payloads) as Payload[]) for (const target of targets) {
    const safe = inspect({ payload, target, form:'checked' });
    const direct = inspect({ payload, target, form:'single' });
    assert.equal(safe.ok, payloads[payload].type === target);
    assert.equal(safe.source.value, payloads[payload].value);
    assert.equal(direct.outcome === 'panic', !safe.matched);
    if (safe.matched) assert.equal(safe.value, direct.value);
  }
});
