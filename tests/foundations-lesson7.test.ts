import test from 'node:test';
import assert from 'node:assert/strict';
import { initialInput, trace, writeAddress } from '../src/components/foundations-lab/lesson7/model';
test('7: value parameter changes only the independent scalar copy', () => {
  const states = trace(initialInput);
  assert.equal(states[1].local, 50);
  assert.equal(states[2].local, 70);
  assert.equal(states[2].a, 50);
  assert.equal(states.at(-1)!.a, 50);
});
test('7: copying pointer identity reaches original object; rebinding stays local', () => {
  const pointer = trace({ ...initialInput, strategy: 'pointer' });
  assert.equal(pointer[1].localPointer, 'A');
  assert.equal(pointer[2].a, 70);
  const rebound = trace({ ...initialInput, strategy: 'rebind' });
  assert.equal(rebound[2].a, 50);
  assert.equal(rebound[2].b, 500);
  assert.equal(rebound[2].localPointer, 'B');
  assert.equal(rebound[2].callerPointer, 'A');
  assert.equal(rebound[3].a, 50);
  assert.equal(rebound[3].b, 520);
});
test('7: returned value cannot update caller until explicitly assigned', () => {
  const accepted = trace({ ...initialInput, strategy: 'return' });
  assert.equal(accepted[2].local, 70);
  assert.equal(accepted[3].returned, 70);
  assert.equal(accepted[3].a, 50);
  assert.equal(accepted[4].a, 70);
  assert.equal(trace({ ...initialInput, strategy: 'return', receive: false }).at(-1)!.a, 50);
});
test('7: address operations change the selected object and preserve snapshots', () => {
  const initial = Object.freeze({ a: 50, b: 500 });
  const first = writeAddress(initial, 'B', 10);
  const second = writeAddress(first, 'A', 20);
  assert.deepEqual(initial, { a: 50, b: 500 });
  assert.deepEqual(first, { a: 50, b: 510 });
  assert.deepEqual(second, { a: 70, b: 510 });
});
test('7: replay is immutable and zero deposit executes without numeric delta', () => {
  const input = Object.freeze({ ...initialInput, strategy: 'pointer' as const, amount: 0 });
  const first = trace(input);
  assert.equal(first[2].a, 50);
  assert.match(first[2].cause, /充值 0 仍执行/);
  first[2].a = 999;
  assert.equal(first[1].a, 50);
  assert.equal(trace(input)[2].a, 50);
  assert.equal(input.balance, 50);
});
test('7: finite domain guards do not silently invent Go integer behavior', () => {
  for (const balance of [-1, 501, 0.5, NaN, Infinity]) assert.throws(() => trace({ ...initialInput, balance }), RangeError);
  for (const amount of [-1, 101, 0.5, NaN, Infinity]) assert.throws(() => trace({ ...initialInput, amount }), RangeError);
});
