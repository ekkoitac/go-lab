import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseline,observe,canReveal,contractResult,offsetLabel} from '../src/components/testing-lab/lesson84/model';

test('84: nanosecond boundary distinguishes Before from not After only at equality',()=>{
 const results=[-1,0,1].map(offset=>observe({...baseline,offset}));
 assert.deepEqual(results.map(v=>v.before),[true,false,false]);
 assert.deepEqual(results.map(v=>v.notAfter),[true,true,false]);
 assert.deepEqual(results.map(v=>v.pass),[true,false,true]);
 assert.ok([-1,0,1].every(offset=>observe({...baseline,offset,rule:'before'}).pass));
});
test('84: fixed injected time survives scheduling delay; live input crosses boundary',()=>{
 const config={...baseline,offset:-1,delay:2,rule:'before' as const};
 assert.equal(observe(config).sampledOffset,-1);
 assert.equal(observe(config).actual,true);
 assert.equal(observe({...config,source:'live'}).sampledOffset,1);
 assert.equal(observe({...config,source:'live'}).actual,false);
 assert.deepEqual(config,{...baseline,offset:-1,delay:2,rule:'before'});
});
test('84: contract change needs different expected value at expiry',()=>{
 assert.equal(contractResult(0,true),true);
 assert.equal(contractResult(0,false),false);
 assert.equal(contractResult(-1,true),true);
 assert.equal(contractResult(1,true),false);
});
test('84: reveal requires both prediction and nonblank explanation',()=>{
 assert.equal(canReveal('true','相等属于非 After'),true);
 assert.equal(canReveal('false','  '),false);
 assert.equal(canReveal('','有理由'),false);
 assert.equal(canReveal('maybe','有理由'),false);
});
test('84: numerical model rejects precision loss and impossible negative delay',()=>{
 assert.throws(()=>observe({...baseline,delay:-1}));
 assert.throws(()=>observe({...baseline,offset:0.1}));
 assert.throws(()=>observe({...baseline,source:'live',offset:Number.MAX_SAFE_INTEGER,delay:1}));
 assert.equal(offsetLabel(0),'恰好到期（0 ns）');
});
