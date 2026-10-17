import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, configure, decode, defaults, initial, inspect, outcome, rewind, strategies } from '../src/components/architecture-lab/lesson113/model';
test('missing preserves old value only when update semantics retain presence', () => {
  assert.equal(outcome(defaults, 'zero').value, '');
  assert.equal(outcome(defaults, 'zero').matches, false);
  assert.equal(outcome(defaults, 'pointer').value, 'Ada');
  assert.equal(outcome(defaults, 'presence').intent, 'keep');
});
test('null and empty string have equal resulting values but distinct intent', () => {
  const config = { ...defaults, payload: '{"name":null}' };
  assert.equal(outcome(config, 'pointer').value, 'Ada');
  assert.equal(outcome(config, 'pointer').matches, false);
  const cleared = outcome(config, 'presence');
  const empty = outcome({ ...config, payload: '{"name":""}' }, 'presence');
  assert.equal(cleared.intent, 'clear'); assert.equal(empty.intent, 'set'); assert.equal(cleared.value, empty.value);
  assert.equal(outcome(config, 'zero').matches, false);
});
test('valid strings are set by all three strategies', () => {
  for (const strategy of strategies) { const result = outcome({ ...defaults, payload: '{"name":"Lin"}' }, strategy); assert.equal(result.value, 'Lin'); assert.equal(result.matches, true); }
});
test('malformed payloads, nonobjects and wrong field types reject without updates', () => {
  for (const payload of ['{', 'null', '[]', '42', '{"name":3}', '{"name":false}', '{"name":{}}']) {
    assert.ok(decode(payload).error);
    for (const strategy of strategies) { const result = outcome({ ...defaults, payload }, strategy); assert.equal(result.intent, 'reject'); assert.equal(result.value, 'Ada'); }
  }
});
test('stages do not write until commit; rewind restores old store', () => {
  let state = initial({ ...defaults, payload: '{"name":"Lin"}' });
  state = advance(advance(state)); assert.equal(inspect(state)[2].stored, 'Ada');
  state = advance(state); assert.equal(inspect(state)[2].stored, 'Lin');
  assert.equal(inspect(rewind(state))[2].stored, 'Ada'); assert.deepEqual(advance(state), state);
});
test('changing input after rewind discards former execution and reset copies config', () => {
  const config = { ...defaults }; const start = initial(config); config.current = 'changed'; assert.equal(start.config.current, 'Ada');
  const changed = configure(rewind(advance(advance(start))), { payload: '{"name":null}' });
  assert.equal(changed.phase, 0); assert.equal(inspect(changed)[2].stored, 'Ada');
  assert.equal(inspect(advance(advance(advance(changed))))[2].intent, 'clear');
  assert.deepEqual(rewind(start), start);
});

