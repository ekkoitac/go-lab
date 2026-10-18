import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline,codeLines,returnSnapshot,validateConfig,type Config} from '../src/components/control-flow-lab/lesson36/model';
test('36 return n copies before defer for anonymous but names the result for named',()=>{
  assert.equal(returnSnapshot(baseline,'anonymous',3).caller,1);
  assert.equal(returnSnapshot(baseline,'named',3).caller,2);
  assert.equal(returnSnapshot(baseline,'anonymous',2).local,2);
  assert.equal(returnSnapshot(baseline,'anonymous',2).result,1);
});
test('36 explicit return expression replaces named n before deferred multiplication',()=>{
  const c:Config={initial:2,returnKind:'literal',literal:7,operation:'multiply',operand:3};
  const anonymous=returnSnapshot(c,'anonymous',1);const named=returnSnapshot(c,'named',1);
  assert.equal(anonymous.local,2);assert.equal(named.local,7);
  assert.equal(anonymous.result,7);assert.equal(named.result,7);
  assert.equal(returnSnapshot(c,'anonymous',2).local,6);
  assert.equal(returnSnapshot(c,'named',2).local,21);
  assert.equal(returnSnapshot(c,'anonymous',3).caller,7);
  assert.equal(returnSnapshot(c,'named',3).caller,21);
});
test('36 assignment and defer stages do not deliver to caller early',()=>{
  for(const mode of ['anonymous','named'] as const){
    for(const step of [0,1,2])assert.equal(returnSnapshot(baseline,mode,step).caller,null);
    assert.equal(returnSnapshot(baseline,mode,1).expression,1);
  }
});
test('36 zero, negatives and identity operations preserve causal semantics',()=>{
  const c:Config={initial:-3,returnKind:'literal',literal:0,operation:'add',operand:-2};
  assert.equal(returnSnapshot(c,'anonymous',3).caller,0);
  assert.equal(returnSnapshot(c,'named',3).caller,-2);
  assert.equal(returnSnapshot({...c,operand:0},'named',2).result,0);
});
test('36 replay reconstructs past return slots and never mutates inputs',()=>{
  const c={...baseline};const before=returnSnapshot(c,'named',1);
  returnSnapshot(c,'named',3);assert.deepEqual(returnSnapshot(c,'named',1),before);
  assert.deepEqual(c,baseline);assert.equal(returnSnapshot(c,'named',-2).step,0);
  assert.equal(returnSnapshot(c,'named',99).step,3);
});
test('36 rejects invalid operands and code reflects selected expression and operation',()=>{
  for(const n of [NaN,Infinity,100,1.5])assert.throws(()=>validateConfig({...baseline,operand:n}));
  const lines=codeLines({...baseline,returnKind:'literal',literal:8,operation:'multiply',operand:2},'named');
  assert.ok(lines.includes('  return 8'));assert.ok(lines.includes('  defer func() { n *= 2 }()'));
  assert.equal(lines[0],'func value() (n int) {');
});
