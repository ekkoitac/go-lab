import test from 'node:test';
import assert from 'node:assert/strict';
import { envelope, initial, inspect, repair, contractCases, type Config } from '../src/components/types-lab/lesson24/model';
test('typed nil keeps dynamic type and differs from nil interface', () => {
  assert.deepEqual(envelope(initial), { type:'*Problem', value:'nil' });
  assert.equal(inspect(initial).isNil, false);
  assert.deepEqual(envelope(repair(initial)), { type:null, value:null });
  assert.equal(inspect(repair(initial)).isNil, true);
});
test('nil receiver is safe until a method dereferences it', () => {
  assert.equal(inspect(initial).call, 'returned');
  assert.equal(inspect({...initial, method:'dereference'}).call, 'panic');
  assert.equal(inspect({...initial, source:'problem', method:'dereference'}).output, '磁盘已满');
  assert.equal(inspect({...repair(initial), method:'dereference'}).call, 'skipped');
});
test('repair returns nil only for absence and preserves a real error', () => {
  const cases = contractCases(repair(initial));
  assert.deepEqual(cases.map(r => r.contract), [true, true]);
  assert.equal(cases[1].slots.type, '*Problem');
  assert.equal(cases[1].slots.value, 'object');
  assert.equal(inspect({...initial, source:'problem', policy:'discard'}).contract, false);
});
test('all reachable configurations produce legal paired slots and immutable repairs', () => {
  for (const source of ['empty','problem'] as const) for (const policy of ['pointer','guard','discard'] as const) for (const method of ['constant','dereference'] as const) {
    const c: Config = {source,policy,method};
    const slots = envelope(c);
    if (slots.type === null) assert.equal(slots.value, null);
    else assert.ok(slots.value === 'nil' || slots.value === 'object');
    const fixed = repair(c);
    assert.equal(fixed.source, c.source);
    assert.equal(fixed.method, c.method);
    assert.equal(c.policy, policy);
    assert.equal(inspect(fixed).contract, true);
  }
});
