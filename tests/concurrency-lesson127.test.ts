import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, step, run, consistent } from '../src/components/concurrency-lab/lesson127/model';

test('complete copy preserves old reader while new readers use the published version', () => {
  const s = run('deep');
  assert.deepEqual(s.old, { root: 'R1', versionSeen: 1, backendSeen: 'blue' });
  assert.deepEqual(s.fresh, { root: 'R2', versionSeen: 2, backendSeen: 'green' });
  assert.equal(consistent(s.old), true); assert.equal(consistent(s.fresh), true);
});
test('shallow copy keeps shared nested identity and corrupts old reads before publication', () => {
  const s = run('shallow', 3);
  assert.equal(s.published, 'R1'); assert.equal(s.roots.R1.nested, s.roots.R2.nested);
  assert.equal(s.old!.backendSeen, 'green'); assert.equal(consistent(s.old), false);
});
test('in-place update can mix earlier header read with later nested data', () => {
  const s = run('inplace'); assert.equal(s.old!.versionSeen, 1); assert.equal(s.old!.backendSeen, 'green');
  assert.equal(consistent(s.old), false); assert.equal(s.published, 'R1');
});
test('private complete copy never mutates published object during construction', () => {
  const s = run('deep', 3); assert.equal(s.published, 'R1'); assert.equal(s.nested.N1, 'blue'); assert.equal(s.nested.N2, 'green');
});
test('old memory is retained through publication and released only after old reader finishes', () => {
  const held = run('deep'); assert.ok(held.roots.R1); assert.ok(held.nested.N1);
  const released = step(held); assert.equal(released.old, null); assert.equal(released.roots.R1, undefined); assert.equal(released.nested.N1, undefined); assert.equal(released.nested.N2, 'green');
});
test('shared nested object remains reachable after old outer object is released', () => {
  const s = run('shallow', 6); assert.equal(s.roots.R1, undefined); assert.equal(s.roots.R2.nested, 'N1'); assert.equal(s.nested.N1, 'green');
});
test('transitions preserve earlier states for exact rewind and completed model is stable', () => {
  const before = initial('deep'); const encoded = JSON.stringify(before); const after = step(before);
  assert.equal(JSON.stringify(before), encoded); assert.equal(before.old, null); assert.ok(after.old);
  const final = run('deep', 6); assert.equal(step(final), final);
});
