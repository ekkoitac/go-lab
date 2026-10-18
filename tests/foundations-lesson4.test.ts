import test from 'node:test';
import assert from 'node:assert/strict';
import { code, evaluate, initialInput, trace, type Input } from '../src/components/foundations-lab/lesson4/model';
const check = (patch: Partial<Input>) => evaluate({ ...initialInput, ...patch });
test('4: a small typed int constant does not implicitly adapt to byte', () => {
  assert.equal(check({}).typeAllowed, false);
  assert.equal(check({}).representable, true);
  assert.equal(check({}).accepted, false);
  assert.equal(check({ source: 'untyped' }).accepted, true);
  assert.equal(check({ source: 'byte' }).accepted, true);
  assert.equal(check({ target: 'int' }).accepted, true);
  assert.equal(check({ convert: true }).accepted, true);
});
test('4: untyped and explicitly converted constants must still fit the destination', () => {
  for (const literal of ['-1', '256', '300', '12.5']) {
    assert.equal(check({ source: 'untyped', literal }).accepted, false);
    assert.equal(check({ source: 'untyped', literal, convert: true }).accepted, false);
  }
  for (const literal of ['0', '255', '12.000']) assert.equal(check({ source: 'untyped', literal }).accepted, true);
  assert.equal(check({ source: 'untyped', literal: '300', target: 'uint16' }).accepted, true);
  assert.equal(check({ literal: '300', target: 'uint16', convert: true }).accepted, true);
  assert.equal(check({ literal: '65536', target: 'uint16', convert: true }).accepted, false);
  assert.equal(check({ literal: '65535', target: 'uint16', convert: true }).accepted, true);
});
test('4: invalid declarations cannot be rescued at a later conversion site', () => {
  for (const literal of ['-1', '256', '12.5']) {
    const result = check({ source: 'byte', target: 'uint16', convert: true, literal });
    assert.equal(result.declaration, false);
    assert.equal(result.accepted, false);
  }
  assert.equal(check({ source: 'int', literal: '12.5', convert: true }).declaration, false);
});
test('4: integer constant range is exhaustive around the byte boundary', () => {
  for (let value = -5; value <= 310; value++) {
    const expected = value >= 0 && value <= 255;
    assert.equal(check({ literal: String(value), source: 'untyped' }).accepted, expected);
    assert.equal(check({ literal: String(value), convert: true }).accepted, expected);
  }
});
test('4: trace defers output, stops checks after failure and replays without mutation', () => {
  const input = Object.freeze({ ...initialInput, source: 'untyped' as const, literal: '12.000' });
  const states = trace(input);
  for (const state of states.slice(0, 4)) assert.equal(state.output, null);
  assert.equal(states[4].output, 'len=12');
  assert.equal(trace(initialInput)[3].rangeGate, '未到达');
  states[1].declaration = 'tampered';
  assert.equal(trace(input)[1].declaration, '无类型数值常量');
  assert.equal(trace({ ...initialInput, source: 'byte', literal: '300' })[2].typeGate, '未到达');
  assert.equal(code({ ...initialInput, convert: true }).includes('packet(byte(n))'), true);
});
test('4: unsupported expressions and non-finite input are rejected explicitly', () => {
  for (const literal of ['', 'NaN', 'Infinity', '1e2', '0xff', '1 + 2', '65537', '-65537', '1.0001', '012', '08', '-012']) {
    assert.equal(check({ literal }).validLiteral, false);
    assert.equal(check({ literal }).accepted, false);
  }
});
