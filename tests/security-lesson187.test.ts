import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline,initial,networkOnly,step,trace,type Input} from '../src/components/security-lab/lesson187/model';
const final=(c:Partial<Input>)=>trace({...baseline,...c}).at(-1)!;
test('187 network location allows the legacy bypass but cannot establish identity',()=>{
 const frames=trace(baseline);assert.equal(networkOnly(baseline),'allowed');assert.equal(frames[1].network,'pass');assert.equal(frames[1].principal,null);assert.equal(frames[1].permission,'waiting');assert.equal(frames.at(-1)!.outcome,'permission');
});
test('187 mTLS authenticates a regular Pod without granting order permissions',()=>{
 const frames=trace(baseline);assert.equal(frames[2].principal,'pod');assert.equal(frames[2].identity,'pass');assert.equal(frames[2].permission,'waiting');assert.equal(frames[2].outcome,'pending');assert.equal(frames[3].permission,'deny');
});
test('187 self-reported service header does not change certificate principal',()=>{
 for(const caller of ['pod','orders','partner'] as const){assert.deepEqual(final({caller,claim:true}).principal,final({caller,claim:false}).principal);assert.equal(final({caller,claim:true}).outcome,final({caller,claim:false}).outcome);}
});
test('187 same identity can reserve inventory but cannot use the administrator API',()=>{
 assert.equal(final({caller:'orders',action:'reserve'}).outcome,'allowed');assert.equal(final({caller:'orders',action:'admin'}).outcome,'permission');assert.equal(final({caller:'orders',action:'admin'}).identity,'pass');
});
test('187 single-way TLS does not authenticate the client even with a claimed identity',()=>{
 const s=final({caller:'orders',tls:'server'});assert.equal(s.outcome,'identity');assert.equal(s.principal,null);assert.equal(s.permission,'waiting');
});
test('187 expired, untrusted, and absent client certificates stop before authorization',()=>{
 for(const certificate of ['expired','untrusted','missing'] as const){const s=final({caller:'orders',certificate});assert.equal(s.outcome,'identity');assert.equal(s.principal,null);assert.equal(s.permission,'waiting');}
});
test('187 network refusal short circuits TLS regardless of credentials',()=>{
 const s=final({network:false,caller:'orders'});assert.equal(s.outcome,'network');assert.equal(s.identity,'waiting');assert.equal(s.permission,'waiting');assert.equal(networkOnly({...baseline,network:false}),'network');
});
test('187 third-party least privilege allows read but not reservation',()=>{
 assert.equal(final({caller:'partner',action:'read'}).outcome,'allowed');assert.equal(final({caller:'partner',action:'reserve'}).outcome,'permission');
});
test('187 deterministic immutable history supports back and replay; terminal steps do nothing',()=>{
 const start=initial(),saved=structuredClone(start),one=step(baseline,start),two=step(baseline,one);assert.deepEqual(start,saved);assert.deepEqual(step(baseline,one),two);const end=final({});assert.equal(step(baseline,end),end);assert.deepEqual(trace(baseline),trace(baseline));
});
test('187 full configuration matrix never executes without all three gates',()=>{
 for(const network of [true,false])for(const caller of ['pod','orders','partner'] as const)for(const tls of ['server','mutual'] as const)for(const certificate of ['valid','expired','untrusted','missing'] as const)for(const action of ['read','reserve','admin'] as const){const s=final({network,caller,tls,certificate,action});if(s.outcome==='allowed'){assert.equal(network,true);assert.equal(tls,'mutual');assert.equal(certificate,'valid');assert.equal(s.network,'pass');assert.equal(s.identity,'pass');assert.equal(s.permission,'pass');assert.notEqual(caller,'pod');assert.notEqual(action,'admin');}}
});
