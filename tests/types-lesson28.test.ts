import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect, initial, repair, dynamicType, comparable, expression, type Value, type Kind, type Config } from '../src/components/types-lab/lesson28/model';
const value = (kind: Kind, a = 1, b = 2): Value => ({ kind, a, b });
const equal = (left: Value, right: Value) => inspect({ operation: 'equal', left, right });
test('slice and nil slice cannot enter map[any] but a fixed array can', () => {
  for (const kind of ['slice', 'nil-slice', 'map'] as const) assert.equal(inspect({ ...initial, left: value(kind) }).outcome, 'panic');
  for (const kind of ['array', 'int', 'string', 'nil'] as const) assert.equal(inspect({ ...initial, left: value(kind) }).outcome, 'stored');
});
test('two interfaces panic only when equal dynamic types are not comparable in this model', () => {
  const all: Kind[] = ['slice', 'nil-slice', 'map', 'array', 'int', 'string', 'nil'];
  for (const left of all) for (const right of all) {
    const a = value(left), b = value(right);
    assert.equal(equal(a, b).outcome === 'panic', dynamicType(a) === dynamicType(b) && !comparable(a), `${left} == ${right}`);
    if (dynamicType(a) !== dynamicType(b)) assert.equal(equal(a, b).outcome, 'false');
  }
});
test('nil slices share []int dynamic type and comparing them still panics', () => {
  assert.equal(equal(value('nil-slice'), value('slice')).outcome, 'panic');
  assert.equal(equal(value('nil-slice'), value('nil-slice')).outcome, 'panic');
});
test('interface nil comparison is always legal and checks whether dynamic type exists', () => {
  for (const kind of ['slice', 'nil-slice', 'map', 'array', 'int', 'string', 'nil'] as const) {
    assert.equal(inspect({ ...initial, operation: 'nil', left: value(kind) }).outcome, kind === 'nil' ? 'true' : 'false');
  }
});
test('arrays compare each element, ints ignore hidden second parameter, strings retain it', () => {
  assert.equal(equal(value('array'), value('array')).outcome, 'true');
  assert.equal(equal(value('array'), value('array', 1, 3)).outcome, 'false');
  assert.equal(equal(value('array'), value('array', 3, 2)).outcome, 'false');
  assert.equal(equal(value('int'), value('int', 1, 99)).outcome, 'true');
  assert.equal(equal(value('string'), value('string', 1, 99)).outcome, 'false');
  assert.equal(equal(value('nil', 99, 99), value('nil')).outcome, 'true');
});
test('repair preserves same pair data and operation without mutating baseline', () => {
  const c: Config = { operation: 'equal', left: value('slice', -3, 5), right: value('slice', -3, 5) };
  const r = repair(c);
  assert.deepEqual(r, { operation: 'equal', left: value('array', -3, 5), right: value('array', -3, 5) });
  assert.equal(c.left.kind, 'slice');
  assert.equal(inspect(c).outcome, 'panic');
  assert.equal(inspect(r).outcome, 'true');
  assert.equal(inspect(repair(initial)).outcome, 'stored');
});
test('repair does not pretend arbitrary nil slices or maps have two elements', () => {
  for (const kind of ['nil-slice', 'map'] as const) {
    const c = { ...initial, left: value(kind) };
    assert.equal(repair(c).left.kind, kind);
    assert.equal(inspect(repair(c)).outcome, 'panic');
  }
});
test('source expressions faithfully distinguish nil interface and typed nil', () => {
  assert.equal(expression(value('nil')), 'nil');
  assert.equal(expression(value('nil-slice')), '[]int(nil)');
  assert.equal(expression(value('array', -2, 4)), '[2]int{-2, 4}');
});
