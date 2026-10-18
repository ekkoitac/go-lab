import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, methodSet, repair, sources } from '../src/components/types-lab/lesson21/model';
test('addressable local direct call does not extend its interface method set', () => {
  assert.equal(inspect({source:'local', route:'direct'}).implicitAddress, true);
  assert.equal(inspect({source:'local', route:'direct'}).after, 1);
  assert.equal(inspect({source:'local', route:'interface'}).outcome, 'compile-error');
  assert.deepEqual(methodSet(false), ['Read']);
  assert.deepEqual(methodSet(true), ['Read', 'Inc']);
});
test('map values cannot be implicitly addressed, pointers need no implicit address', () => {
  for (const route of ['direct', 'interface'] as const) {
    assert.equal(inspect({source:'map-value', route}).after, 0);
    for (const source of ['pointer', 'map-pointer'] as const) {
      const result = inspect({source, route});
      assert.equal(result.allowed, true);
      assert.equal(result.implicitAddress, false);
      assert.equal(result.after, 1);
    }
  }
});
test('copy and writeback works only with direct call; repair preserves the route', () => {
  const direct = inspect({source:'copy-back', route:'direct'});
  assert.equal(direct.after, 1);
  assert.match(direct.code, /m\["x"\] = tmp/);
  assert.equal(inspect({source:'copy-back', route:'interface'}).allowed, false);
  for (const source of sources) {
    for (const route of ['direct', 'interface'] as const) {
      const fixed = repair({source:source.id, route});
      assert.equal(fixed.route, route);
      assert.equal(inspect(fixed).after, 1);
    }
  }
});
