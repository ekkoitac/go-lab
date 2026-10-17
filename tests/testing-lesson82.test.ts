import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cases, categoryOf, coverage, offset, runTable } from '../src/components/testing-lab/lesson82/model';

test('ordinary page already rejects original formula; first page is not the only failure', () => {
  const ordinary = cases.filter(c => c.id === 'second');
  assert.deepEqual(runTable('original', ordinary).map(c => [c.actual,c.want,c.pass]), [[20,10,false]]);
  assert.equal(runTable('formula', ordinary)[0].pass, true);
});
test('adding ordinary rows increases rows but not input category coverage', () => {
  assert.deepEqual(coverage(cases.slice(0,2)), ['普通页']);
  assert.deepEqual(coverage(cases), ['普通页','第一页','非法页码','非法页大小']);
  assert.deepEqual(categoryOf({page:0,size:0}), ['非法页码','非法页大小']);
});
test('formula-only repair misses invalid page and size; complete repair matches independent cases', () => {
  assert.equal(runTable('complete', cases).every(c => c.pass), true);
  for (const c of cases.filter(c => c.page < 1 || c.size < 1)) assert.equal(runTable('formula', [c])[0].pass,false,c.name);
  assert.equal(offset('complete',1,1),0);
  assert.equal(offset('complete',4,7),21);
  assert.equal(offset('complete',0,0),-1);
});
test('an invalid input can coincidentally pass a formula-only implementation', () => {
  const accidental = {id:'accidental',name:'coincidence',page:0,size:1,want:-1};
  assert.equal(runTable('formula',[accidental])[0].pass,true);
  assert.equal(runTable('formula',[{...accidental,size:2}])[0].pass,false);
});
test('comparison retains independent expected values and never mutates test rows', () => {
  const original = structuredClone(cases);
  const rows = runTable('original',cases);
  rows[0].want = 999;
  assert.deepEqual(cases, original);
  assert.throws(() => offset('complete',1.5,10), RangeError);
  assert.throws(() => offset('original',1001,10), RangeError);
});
