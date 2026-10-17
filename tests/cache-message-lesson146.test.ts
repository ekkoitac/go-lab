import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,initial,inspect,outcome,step,type Config,type Scheme,type Incident} from '../src/components/cache-message-lab/lesson146/model';
const run=(scheme:Scheme,incident:Incident,key:Config['key']='event')=>inspect({scheme,incident,key},7);
test('146: independent commits expose opposite crash failures',()=>{
 const marked=inspect({scheme:'mark-first',incident:'crash',key:'event'},3);assert.equal(marked.points,0);assert.deepEqual(marked.inbox,['payment-e1']);assert.equal(run('mark-first','crash').points,0);assert.equal(run('mark-first','crash').skipped,true);
 const added=inspect(defaults,3);assert.equal(added.points,10);assert.deepEqual(added.inbox,[]);assert.equal(run('effect-first','crash').points,20);
});
test('146: atomic pending writes disappear together on crash and retry commits once',()=>{
 const c:Config={scheme:'transaction',incident:'crash',key:'event'};const pending=inspect(c,2);assert.equal(pending.pending,true);assert.equal(pending.points,0);assert.deepEqual(pending.inbox,[]);
 const crashed=inspect(c,3);assert.equal(crashed.pending,false);assert.equal(crashed.points,0);assert.deepEqual(crashed.inbox,[]);
 const final=inspect(c,7);assert.equal(final.points,10);assert.deepEqual(final.inbox,['payment-e1']);assert.equal(final.pending,false);
});
test('146: stable id deduplicates successful deliveries but delivery id defeats unique inbox',()=>{
 const stable=run('transaction','none');assert.equal(stable.points,10);assert.equal(stable.eventId,'payment-e1');assert.equal(stable.deliveryId,'delivery-2');assert.equal(stable.skipped,true);
 const wrong=run('transaction','none','delivery');assert.equal(wrong.points,20);assert.deepEqual(wrong.inbox,['delivery-1','delivery-2']);assert.equal(wrong.eventId,stable.eventId);
});
test('146: memory is per process and not durable; persisted inbox survives restart and another worker',()=>{
 assert.equal(run('memory','none').points,10);
 for(const incident of ['restart','other'] as const){assert.equal(run('memory',incident).points,20);assert.equal(run('transaction',incident).points,10);}
 const other=run('memory','other');assert.deepEqual(other.seenA,['payment-e1']);assert.deepEqual(other.seenB,['payment-e1']);assert.equal(other.active,'B');
 const restart=inspect({scheme:'memory',incident:'restart',key:'event'},4);assert.deepEqual(restart.seenA,[]);assert.equal(restart.points,10);
});
test('146: removing expired inbox cannot reverse already committed points',()=>{
 const c:Config={scheme:'transaction',incident:'expiry',key:'event'};const expired=inspect(c,4);assert.equal(expired.time,8);assert.equal(expired.points,10);assert.deepEqual(expired.inbox,[]);assert.equal(inspect(c,7).points,20);
});
test('146: complete matrix preserves nonnegative whole effects and unique records',()=>{
 const expected:Record<Scheme,number[]>={memory:[10,10,20,20,20],'mark-first':[10,0,10,10,20],'effect-first':[10,20,10,10,20],transaction:[10,10,10,10,20]};
 const incidents:Incident[]=['none','crash','restart','other','expiry'];
 for(const [scheme,points] of Object.entries(expected)){incidents.forEach((incident,i)=>{const s=run(scheme as Scheme,incident);assert.equal(s.points,points[i],`${scheme}/${incident}`);assert.equal(new Set(s.inbox).size,s.inbox.length);});}
});
test('146: prediction required before execution; rewind and reset are deterministic',()=>{
 const start=initial();assert.throws(()=>step(start));assert.throws(()=>step(start,{value:'20',reason:' '}));const p={value:'20' as const,reason:'effect committed before marker'};const first=step(start,p);p.reason='changed';assert.equal(first.prediction?.reason,'effect committed before marker');assert.deepEqual(back(first),start);const second=step(first);assert.deepEqual(back(second),first);assert.deepEqual(inspect(defaults,7),inspect(defaults,7));assert.equal(outcome(inspect(defaults,6)),'pending');assert.equal(outcome(inspect(defaults,7)),'20');assert.equal(start.phase,0);
});
test('146: invalid model values fail explicitly',()=>{assert.throws(()=>inspect(defaults,8));assert.throws(()=>inspect(defaults,-1));assert.throws(()=>inspect(defaults,1.1));assert.throws(()=>initial({...defaults,key:'unknown' as Config['key']}));});
