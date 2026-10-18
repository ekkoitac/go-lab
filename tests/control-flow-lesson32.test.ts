import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSnapshot,finalOutput,lastStep,parseValues} from '../src/components/control-flow-lab/lesson32/model';
test('32 shared callbacks retain one identity while registrations change its value',()=>{
  const a=captureSnapshot([2,5,9],'shared',1);const b=captureSnapshot([2,5,9],'shared',3);
  assert.equal(a.cells[0].value,2);assert.equal(b.cells[0].value,9);
  assert.equal(new Set(b.callbacks.map(c=>c.cellId)).size,1);assert.deepEqual(b.outputs,[]);
  assert.deepEqual(finalOutput([2,5,9],'shared'),[9,9,9]);
});
test('32 iteration declarations and factory parameters retain independent identities with equal values',()=>{
  for(const mode of ['iteration','parameter'] as const){
    const state=captureSnapshot([4,4,-1],mode,3);
    assert.equal(new Set(state.callbacks.map(c=>c.cellId)).size,3);
    assert.deepEqual(finalOutput([4,4,-1],mode),[4,4,-1]);
  }
});
test('32 loop-end differs from execution and each step executes one callback',()=>{
  assert.equal(captureSnapshot([0,-4],'shared',3).phase,'loop-end');
  assert.deepEqual(captureSnapshot([0,-4],'shared',3).outputs,[]);
  assert.deepEqual(captureSnapshot([0,-4],'shared',4).outputs,[-4]);
  assert.equal(captureSnapshot([0,-4],'shared',5).phase,'done');
});
test('32 replay and rewind reproduce history without mutating previous snapshots',()=>{
  const values=[3,1,7,8];const first=captureSnapshot(values,'shared',1);
  captureSnapshot(values,'shared',lastStep(values));
  assert.deepEqual(captureSnapshot(values,'shared',1),first);assert.equal(first.cells[0].value,3);
  assert.deepEqual(values,[3,1,7,8]);assert.equal(captureSnapshot(values,'shared',-2).step,0);
});
test('32 bounded integer experiments reject ambiguous and invalid input',()=>{
  assert.deepEqual(parseValues('0，-8, 999'),[0,-8,999]);
  for(const input of ['', '1','1,2,3,4,5','2,x','1,1.5','2,1000','1,']) assert.throws(()=>parseValues(input));
});
