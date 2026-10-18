import test from 'node:test';
import assert from 'node:assert/strict';
import { initialInput, trace, program, resultLabel } from '../src/components/foundations-lab/lesson9/model';
test('9: multi assignment snapshots old values then writes left to right', () => {
  const frames = trace({ ...initialInput, policy: 'multiple' });
  assert.deepEqual(frames.map(s => [s.a, s.b]), [[2, 9], [2, 9], [9, 9], [9, 2]]);
  assert.deepEqual(frames[1].saved, [9, 2]);
  assert.deepEqual(frames[3].saved, [9, 2]);
});
test('9: sequential overwrite loses old x; explicit temporaries preserve it', () => {
  for (let a = -20; a <= 20; a++) for (let b = -20; b <= 20; b++) {
    const sequential = trace({ ...initialInput, a, b }).at(-1)!;
    const multiple = trace({ ...initialInput, a, b, policy: 'multiple' }).at(-1)!;
    const temporary = trace({ ...initialInput, a, b, policy: 'temporary' }).at(-1)!;
    assert.deepEqual([sequential.a, sequential.b], [b, b]);
    assert.deepEqual([multiple.a, multiple.b], [b, a]);
    assert.deepEqual([temporary.a, temporary.b], [b, a]);
  }
});
test('9: x,y=y,x+y uses both old operands even after x is written', () => {
  const input = { ...initialInput, a: 4, b: 6, scenario: 'sum' as const };
  const frames = trace({ ...input, policy: 'multiple' });
  assert.deepEqual(frames[1].saved, [6, 10]);
  assert.deepEqual([frames[2].a, frames[2].b], [6, 6]);
  assert.equal(frames[3].b, 10);
  assert.equal(trace(input).at(-1)!.b, 12);
  assert.equal(trace({ ...input, policy: 'temporary' }).at(-1)!.b, 10);
});
test('9: index is captured before i changes and both destinations remain distinct', () => {
  for (const i of [0, 1]) {
    const input = { ...initialInput, scenario: 'index' as const, i };
    const frames = trace(input);
    assert.deepEqual(frames[1].targets, ['i', `a[${i}]`]);
    assert.equal(frames[2].i, 1);
    assert.deepEqual([frames[2].a, frames[2].b], [2, 9]);
    assert.deepEqual([frames[3].a, frames[3].b], i === 0 ? [7, 9] : [2, 7]);
    assert.equal(resultLabel(input, frames[3]), i === 0 ? 'i=1, a=[7, 9]' : 'i=1, a=[2, 7]');
  }
});
test('9: snapshot replay is independent; boundary and program stay explicit', () => {
  const input = Object.freeze({ ...initialInput, policy: 'multiple' as const });
  const frames = trace(input);
  frames[1].saved[0] = 99;
  frames[1].a = 20;
  assert.equal(frames[2].saved[0], 9);
  assert.equal(trace(input)[1].a, 2);
  assert.match(program(input), /x, y = y, x/);
  assert.match(program({ ...input, scenario: 'index' }), /i, a\[i\] = 1, 7/);
  for (const a of [21, -21, 0.5, NaN, Infinity]) assert.throws(() => trace({ ...input, a }), RangeError);
  assert.throws(() => trace({ ...input, i: 2 }), RangeError);
});
