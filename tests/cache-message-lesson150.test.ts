import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,events,initial,inspect,receive,step,type Config} from '../src/components/cache-message-lab/lesson150/model';
const cfg=(kind:Config['kind'],rule:Config['rule'],delivery:Config['delivery']='late'):Config=>({kind,rule,delivery});
test('150: arrival overwrite regresses snapshot; business version retains complete v3',()=>{
 const unsafe=cfg('snapshot','arrival');assert.equal(inspect(unsafe,1).amount,0);assert.equal(inspect(unsafe,2).version,2);assert.equal(inspect(unsafe,5).amount,-100);
 const guarded=cfg('snapshot','version');assert.equal(inspect(guarded,1).version,3);assert.equal(inspect(guarded,5).amount,0);assert.deepEqual(inspect(guarded,5).applied,[3]);
});
test('150: equal version snapshot retry is ignored without applying another effect',()=>{
 const c=cfg('snapshot','version'),s=inspect(c,1),duplicate=receive(s,c,events[3]);assert.equal(duplicate.amount,s.amount);assert.deepEqual(duplicate.applied,[3]);assert.match(duplicate.action,/相同版本/);
});
test('150: snapshot gating applied to deltas loses the earlier debit',()=>{
 const c=cfg('delta','version');assert.equal(inspect(c,1).amount,100);assert.equal(inspect(c,5).amount,100);assert.deepEqual(inspect(c,5).applied,[3]);assert.equal(inspect(c,5).version,3);
});
test('150: future delta waits; missing predecessor releases a contiguous sequence once',()=>{
 const c=cfg('delta','contiguous');const waiting=inspect(c,1);assert.equal(waiting.version,1);assert.equal(waiting.amount,0);assert.deepEqual(waiting.buffer,[3]);assert.deepEqual(waiting.applied,[]);
 const repaired=inspect(c,2);assert.equal(repaired.version,3);assert.equal(repaired.amount,0);assert.deepEqual(repaired.buffer,[]);assert.deepEqual(repaired.applied,[2,3]);
 assert.deepEqual(inspect(c,3).applied,[2,3]);assert.equal(inspect(c,3).amount,0);
 const duplicateFuture=receive(waiting,c,events[3]);assert.deepEqual(duplicateFuture.buffer,[3]);assert.equal(duplicateFuture.amount,0);
});
test('150: timeout does not fabricate missing effects and replay repairs only valid contiguous watermark',()=>{
 const correct=cfg('delta','contiguous','missing');const waiting=inspect(correct,4);assert.equal(waiting.version,1);assert.deepEqual(waiting.buffer,[3]);assert.deepEqual(waiting.applied,[]);
 const recovered=inspect(correct,5);assert.equal(recovered.version,3);assert.equal(recovered.amount,0);assert.deepEqual(recovered.applied,[2,3]);assert.deepEqual(recovered.buffer,[]);
 const broken=inspect(cfg('delta','version','missing'),5);assert.equal(broken.amount,100);assert.deepEqual(broken.applied,[3]);
});
test('150: event clocks and arrivals are deliberately different from business order',()=>{
 assert.ok(events[2].version<events[3].version);assert.ok(events[2].eventTime>events[3].eventTime);assert.ok(events[2].arrival>events[3].arrival);
 for(const delivery of ['late','missing'] as const){const s=inspect(cfg('snapshot','version',delivery),5);assert.equal(s.version,3);assert.equal(s.amount,0);}
});
test('150: prediction and reason gate execution; history rewinds without mutation',()=>{
 const t=initial();assert.throws(()=>step(t));assert.throws(()=>step(t,{value:'0',reason:' '}));const p={value:'-100',reason:'old snapshot replaces refund'};const one=step(t,p);p.reason='modified';assert.equal(one.prediction?.reason,'old snapshot replaces refund');assert.deepEqual(back(one),t);const two=step(one);assert.deepEqual(back(two),one);assert.equal(t.phase,0);assert.deepEqual(inspect(defaults,2),inspect(defaults,2));
 let end=one;while(end.phase<5)end=step(end);assert.equal(step(end),end);
});
test('150: invalid stages and contracts are rejected',()=>{
 assert.throws(()=>inspect(defaults,6));assert.throws(()=>inspect(defaults,-1));assert.throws(()=>inspect(defaults,1.1));assert.throws(()=>initial(cfg('snapshot','contiguous')));assert.throws(()=>initial(cfg('delta','arrival')));
});
