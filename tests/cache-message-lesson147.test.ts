import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,initial,inspect,step,type Config} from '../src/components/cache-message-lab/lesson147/model';
const run=(order:Config['order'],incident:Config['incident'],idempotent=true)=>inspect({order,incident,idempotent},7);
test('147: early acknowledged failed commit loses recovery basis',()=>{
 const c:Config={order:'early',incident:'dbfail',idempotent:true};
 const acked=inspect(c,2);assert.equal(acked.ackReceived,1);assert.equal(acked.unacked,false);assert.equal(acked.coupons,0);
 const failed=inspect(c,3);assert.equal(failed.coupons,0);assert.equal(failed.inbox,false);
 const closed=inspect(c,5);assert.equal(closed.queued,false);assert.equal(closed.unacked,false);
 const final=inspect(c,7);assert.equal(final.coupons,0);assert.equal(final.deliveries,1);assert.equal(final.retried,false);
});
test('147: failed commit retains unacked responsibility until connection-close requeue',()=>{
 const c:Config={order:'after',incident:'dbfail',idempotent:true};
 const failed=inspect(c,4);assert.equal(failed.ackSent,0);assert.equal(failed.unacked,true);assert.equal(failed.queued,false);assert.equal(failed.coupons,0);
 const closed=inspect(c,5);assert.equal(closed.queued,true);assert.equal(closed.unacked,false);
 const final=inspect(c,7);assert.equal(final.coupons,1);assert.equal(final.deliveries,2);assert.equal(final.ackReceived,1);assert.equal(final.inbox,true);
});
test('147: sending an ack does not prove broker received it',()=>{
 for(const order of ['early','after'] as const){const c:Config={order,incident:'acklost',idempotent:true};const lost=inspect(c,4);assert.equal(lost.ackSent,1);assert.equal(lost.ackReceived,0);assert.equal(lost.unacked,true);assert.equal(lost.queued,false);assert.equal(lost.coupons,1);assert.equal(inspect(c,5).queued,true);const final=inspect(c,7);assert.equal(final.ackSent,2);assert.equal(final.ackReceived,1);assert.equal(final.deliveries,2);assert.equal(final.skipped,true);assert.equal(final.coupons,1);}
});
test('147: late ack crash preserves effect but requires dedup on redelivery',()=>{
 const c:Config={order:'after',incident:'crash',idempotent:false};const crashed=inspect(c,4);assert.equal(crashed.connection,'closed');assert.equal(crashed.coupons,1);assert.equal(crashed.unacked,true);assert.equal(crashed.ackSent,0);
 assert.equal(inspect(c,5).coupons,1);assert.equal(inspect(c,7).coupons,2);assert.equal(run('after','crash',true).coupons,1);assert.equal(run('after','crash',true).skipped,true);
 assert.equal(run('early','crash',false).coupons,1);assert.equal(run('early','crash',false).retried,false);
});
test('147: full matrix distinguishes loss and duplicate boundaries',()=>{
 const expected={early:{none:1,dbfail:0,crash:1,acklost:2},after:{none:1,dbfail:1,crash:2,acklost:2}};
 for(const order of ['early','after'] as const)for(const incident of ['none','dbfail','crash','acklost'] as const)for(const idempotent of [false,true]){
 const s=run(order,incident,idempotent);const unprotected=expected[order][incident];assert.equal(s.coupons,idempotent?Math.min(1,unprotected):unprotected,`${order}/${incident}/${idempotent}`);assert.equal(s.unacked,false);assert.equal(s.queued,false);assert.ok(s.ackReceived<=s.ackSent);assert.equal(s.inbox,idempotent&&s.coupons>0);
 }
});
test('147: every intermediate state obeys broker and durable effect invariants',()=>{
 for(const order of ['early','after'] as const)for(const incident of ['none','dbfail','crash','acklost'] as const)for(const idempotent of [false,true]){let previous=0;for(let phase=0;phase<=7;phase++){const s=inspect({order,incident,idempotent},phase);assert.equal(s.queued&&s.unacked,false);assert.ok(s.coupons>=previous);assert.ok(s.coupons<=2);assert.ok(s.ackReceived<=s.ackSent);assert.ok(!s.inbox||s.coupons>=1);previous=s.coupons;}}
});
test('147: capture prediction separately; deterministic replay, rewind and reset',()=>{
 const t=initial();assert.throws(()=>step(t));assert.throws(()=>step(t,{value:'0',reason:' '}));const p:Parameters<typeof step>[1]={value:'0',reason:'ack removes recovery before commit'};const first=step(t,p);p.reason='changed';assert.equal(first.prediction?.reason,'ack removes recovery before commit');assert.deepEqual(back(first),t);assert.deepEqual(back(step(first)),first);assert.equal(t.phase,0);assert.equal(t.prediction,null);assert.deepEqual(inspect(defaults,3),inspect(defaults,3));assert.deepEqual(initial(t.config),t);let done=first;for(let i=0;i<10;i++)done=step(done);assert.equal(done.phase,7);assert.deepEqual(step(done),done);
});
test('147: reject invalid configuration and timeline phase',()=>{assert.throws(()=>inspect(defaults,-1));assert.throws(()=>inspect(defaults,8));assert.throws(()=>inspect(defaults,1.5));assert.throws(()=>initial({...defaults,incident:'unknown' as Config['incident']}));assert.throws(()=>initial({...defaults,idempotent:'yes' as unknown as boolean}));});
