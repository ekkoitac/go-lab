import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialConfig,inspect,firstFailure,source,values} from '../src/components/testing-lab/lesson89/model';
test('format inspection does not mutate source or repair semantic defects',()=>{
 const c=initialConfig();const before=source(c);
 assert.equal(inspect(c,'format').status,'fail');assert.equal(source(c),before);
 const fixed={...c,formatted:true};assert.equal(inspect(fixed,'format').status,'pass');
 assert.equal(inspect(fixed,'vet').status,'fail');assert.equal(inspect(fixed,'test').status,'fail');
});
test('format verb repair changes static evidence and output but leaves boundary failure',()=>{
 const c={...initialConfig(),formatted:true,verbFixed:true};
 assert.equal(values(c).text,'7');assert.equal(inspect(c,'vet').status,'pass');
 assert.match(inspect(c,'test').detail,/满额断言/);assert.doesNotMatch(inspect(c,'test').detail,/文本断言/);
 assert.equal(firstFailure(c),'test');
});
test('test evidence depends on assertions and exercised input',()=>{
 const c={...initialConfig(),formatted:true,verbFixed:true};
 assert.equal(inspect({...c,assertion:'none'},'test').status,'pass');
 assert.match(inspect({...c,assertion:'none'},'test').detail,/未添加行为断言/);
 assert.equal(inspect({...c,assertion:'output'},'test').status,'pass');
 assert.equal(inspect({...c,input:101},'test').status,'pass');
 assert.equal(inspect(c,'test').status,'fail');
 assert.equal(inspect({...c,boundaryFixed:true},'test').status,'pass');
});
test('disabled tool provides no evidence, and repair makes selected checks pass',()=>{
 const c=initialConfig();assert.equal(inspect({...c,enabled:{format:false,vet:true,test:true}},'format').status,'skipped');
 assert.equal(firstFailure({...c,enabled:{format:false,vet:true,test:true}}),'vet');
 assert.equal(firstFailure({...c,formatted:true,verbFixed:true,boundaryFixed:true}),'none');
});
test('coupon transfer uses its own threshold, same invariant on either side',()=>{
 const c={...initialConfig(50),formatted:true,verbFixed:true};
 assert.equal(values(c).expectedEligible,true);assert.equal(values(c).eligible,false);
 for(const input of [49,50,51]){const fixed={...c,input,boundaryFixed:true};assert.equal(values(fixed).eligible,input>=50);assert.equal(inspect(fixed,'test').status,'pass');}
});

