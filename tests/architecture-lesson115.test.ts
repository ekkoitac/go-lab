import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, configure, initial, inspect, rewind, type Config } from '../src/components/architecture-lab/lesson115/model';
const finish = (patch: Partial<Config> = {}) => { let state = configure(initial(), patch); for (let i=0;i<4;i++) state=advance(state); return inspect(state); };
test('115 sentinel identity survives %w while == only sees top-level object', () => {
  assert.equal(finish().response?.status, 500);
  assert.equal(finish({method:'is-as'}).response?.status,404);
  assert.equal(finish({inner:'none',outer:'none'}).response?.status,404);
  assert.equal(finish({cause:'invalid',method:'is-as'}).response?.status,400);
});
test('115 text-only wrapping breaks traversal at either layer', () => {
  for (const patch of [{inner:'text'}, {outer:'text'}] as Partial<Config>[]) {
    const view=finish({...patch,method:'is-as'}); assert.equal(view.response?.status,500); assert.match(view.error.text,/missing/);
    assert.equal(view.nodes.some(n=>n.identity==='ErrMissing'),false);
  }
});
test('115 identical words do not create sentinel identity; strings misclassify and drift',()=>{
  assert.equal(finish({cause:'mimic',method:'is-as'}).response?.status,500);
  assert.equal(finish({cause:'mimic',method:'text'}).response?.status,404);
  assert.equal(finish({localized:true,method:'text'}).response?.status,500);
  assert.equal(finish({localized:true,method:'is-as'}).response?.status,404);
});
test('115 As detects typed quota with structured payload regardless of display language',()=>{
  const view=finish({cause:'quota',localized:true,method:'is-as'});
  assert.equal(view.response?.status,429); assert.match(view.classification!.evidence,/Limit=3/);
  assert.equal(finish({cause:'quota',inner:'text',method:'is-as'}).response?.status,500);
});
test('115 unknown detail stays in diagnostics and never enters public response',()=>{
  const view=finish({cause:'unknown',method:'is-as'});
  assert.match(view.diagnostic!.message,/private-db/);
  assert.doesNotMatch(JSON.stringify(view.response),/SQL|private-db|repository/);
  assert.equal(view.response?.code,'INTERNAL_ERROR');
});
test('115 reversible execution and config changes remove stale response',()=>{
  const start=initial(); assert.deepEqual(rewind(advance(start)),start);
  let end=start; for(let i=0;i<4;i++)end=advance(end);
  assert.equal(inspect(rewind(end)).response,null);
  const changed=configure(rewind(end),{method:'is-as'}); assert.equal(changed.phase,0); assert.equal(inspect(changed).classification,null);
  assert.deepEqual(initial(start.config),start); assert.equal(advance(end).phase,4);
});
