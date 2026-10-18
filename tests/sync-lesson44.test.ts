import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,observation,runSchedule,step} from '../src/components/sync-lab/lesson44/model';
test('44: split lock exposes incomplete transfer without an unlocked access',()=>{
 const s=runSchedule('split',10,['debit','observe']);
 assert.equal(s.a+s.b,90);assert.equal(s.observed?.total,90);assert.equal(s.locked,false);
 const done=step(s,'credit');assert.equal(done.a+done.b,100);assert.equal(done.observed?.total,90,'old externally observed snapshot does not silently change');
 assert.equal(step(done,'observe').observed?.total,100);
});
test('44: whole lock hides temporary broken invariant until release',()=>{
 const start=initialState('whole',20);const internal=step(start,'debit');
 assert.equal(internal.a+internal.b,80);assert.equal(observation(internal),'blocked');
 const waiting=step(internal,'observe');assert.equal(waiting.observed,null);assert.equal(waiting.reads,0);assert.equal(waiting.blocked,1);
 const final=step(step(waiting,'credit'),'observe');assert.equal(final.observed?.total,100);assert.equal(final.locked,false);
 assert.equal(start.a,60,'transition preserves prior state for rewind');
});
test('44: all observer insertion points preserve invariant under common whole lock',()=>{
 for(const amount of [1,7,30,60])for(const position of [0,1,2]){
  const actions:('debit'|'credit'|'observe')[]=['debit','credit'];actions.splice(position,0,'observe');
  const result=runSchedule('whole',amount,actions);assert.ok(result.observed===null||result.observed.total===100);
 }
});
test('44: cannot credit before debit or repeat transfer steps',()=>{
 const start=initialState();assert.equal(step(start,'credit'),start);const debited=step(start,'debit');assert.equal(step(debited,'debit'),debited);
 const done=step(debited,'credit');assert.equal(step(done,'credit'),done);
});
test('44: changing amounts reproduces exact shortfall and supports new context',()=>{
 for(const n of [7,13,9])assert.equal(runSchedule('split',n,['debit','observe'],45,35).observed?.total,80-n);
 assert.throws(()=>initialState('split',61));assert.throws(()=>initialState('whole',0));
});
