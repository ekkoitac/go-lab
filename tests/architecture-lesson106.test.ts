import test from 'node:test';
import assert from 'node:assert/strict';
import { initialConfig, inspect, type Layout } from '../src/components/architecture-lab/lesson106/model.ts';

test('106: workspace can hide an unpublished dependency from local builds', () => {
  assert.equal(inspect(initialConfig, 2).local, true);
  assert.equal(inspect(initialConfig, 4).clean, false);
  assert.match(inspect(initialConfig, 4).reason, /v1.0.0/);
  assert.equal(inspect({ ...initialConfig, workspace:false }, 2).local, false);
});
test('106: both publishing and consumer upgrade are required', () => {
  for (const layout of ['multi','repos'] as Layout[]) {
    for (const publish of [false,true]) for (const upgrade of [false,true]) {
      assert.equal(inspect({ ...initialConfig,layout,publish,upgrade },4).clean,publish && upgrade);
    }
  }
});
test('106: single module keeps three commands without separate domain version', () => {
  const result=inspect({ ...initialConfig,layout:'single',workspace:false },4);
  assert.equal(result.commands,3); assert.equal(result.modules,1); assert.equal(result.repositories,1);
  assert.equal(result.clean,true); assert.equal(result.local,true);
});
test('106: repository split changes ownership topology, not version resolution', () => {
  const multi=inspect(initialConfig,4), repos=inspect({ ...initialConfig,layout:'repos' },4);
  assert.equal(multi.repositories,1); assert.equal(repos.repositories,4);
  assert.equal(multi.modules,repos.modules); assert.equal(multi.clean,repos.clean);
});
test('106: publication happens only at its phase and rewind removes it', () => {
  const config={ ...initialConfig,publish:true,upgrade:true };
  assert.equal(inspect(config,2).published,'v1.0.0');
  assert.equal(inspect(config,3).published,'v1.1.0');
  assert.equal(inspect(config,3).clean,null);
  assert.equal(inspect(config,2).required,'v1.0.0');
  assert.deepEqual(inspect(config,0),inspect(config,-4));
  assert.deepEqual(inspect(config,4),inspect(config,20));
  assert.equal(inspect(config,Number.NaN).phase,0);
});
