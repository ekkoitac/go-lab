import test from 'node:test';
import assert from 'node:assert/strict';
import { expression, initialInput, safetyCases, skipsRight, trace, type Input } from '../src/components/foundations-lab/lesson10/model';
test('10: dangerous left access panics before a guard can run', () => {
  for (const operator of ['&&', '||'] as const) {
    const states = trace({ ...initialInput, operator });
    assert.equal(states[1].left, 'panic'); assert.equal(states[1].calls, 1);
    assert.equal(states[3].result, 'panic'); assert.equal(states[3].right, null);
  }
});
test('10: each operator has a different safe empty-list guard', () => {
  for (const operator of ['&&', '||'] as const) {
    const input: Input = { ...initialInput, operator, order: 'guard-first', guard: operator === '&&' ? 'nonempty' : 'empty' };
    const states = trace(input); assert.equal(states[3].result, operator === '||');
    assert.equal(states[3].right, 'skipped'); assert.equal(states[3].calls, 0);
    assert.equal(trace({ ...input, guard: operator === '&&' ? 'empty' : 'nonempty' })[3].result, 'panic');
    for (const item of safetyCases(input)) assert.equal(item.result, item.expected);
  }
});
test('10: all combinations obey left-to-right boolean semantics and call counts', () => {
  for (const operator of ['&&', '||'] as const) for (const order of ['guard-first', 'read-first'] as const) for (const guard of ['nonempty', 'empty'] as const) for (const value of [-1, 0, 3]) {
    const input: Input = { operator, order, guard, items: [value] };
    const states = trace(input); const guarded = guard === 'nonempty'; const read = value > 0;
    const left = order === 'read-first' ? read : guarded;
    assert.equal(states[3].result, operator === '&&' ? guarded && read : guarded || read);
    assert.equal(states[3].calls, order === 'read-first' || !skipsRight(operator, left) ? 1 : 0);
    assert.equal(states[0].calls, 0); assert.equal(states[2].right === 'skipped', skipsRight(operator, left));
  }
});
test('10: replay preserves prior snapshots, inputs, and unsafe expression order', () => {
  const input = { ...initialInput, items: [3] }; const before = JSON.stringify(input);
  const states = trace(input); states[3].calls = 100;
  assert.equal(states[0].calls, 0); assert.equal(trace(input)[3].calls, 1); assert.equal(JSON.stringify(input), before);
  assert.equal(expression(initialInput), 'readPositive(items) && len(items) > 0');
});
