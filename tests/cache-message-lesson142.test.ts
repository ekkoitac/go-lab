import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,apply,next,run,stale,type Guard} from '../src/components/cache-message-lab/lesson142/model';
test('delete before commit allows concurrent reader to refill old data',()=>{
 const s=run({scenario:'delete-first'});
 assert.equal(s.db,2);assert.equal(s.reader,1);assert.equal(s.cache,1);assert.equal(stale(s),true);
});
test('commit then invalidate does not cancel an old in-flight read',()=>{
 const s=run({scenario:'late-fill'});
 assert.equal(s.cache,1);assert.equal(s.db,2);
 assert.equal(run({scenario:'double-delete'}).cache,1);
});
test('existing-value comparison protects a populated v2 but cannot protect empty cache',()=>{
 const guarded=run({scenario:'late-fill',guard:'present'},['read','commit','delete','fresh','fill']);
 assert.equal(guarded.cache,2);assert.equal(guarded.rejected,1);
 const empty=run({scenario:'late-fill',guard:'present'});
 assert.equal(empty.cache,1);assert.equal(empty.rejected,0);
});
test('retained invalidation floor rejects late data even when cache is empty',()=>{
 const s=run({scenario:'late-fill',guard:'floor'});
 assert.equal(s.floor,2);assert.equal(s.cache,null);assert.equal(s.rejected,1);
 assert.equal(run({scenario:'double-delete',guard:'floor'}).cache,null);
 // An invalidation before commit only knows v1, not the future v2.
 const early=run({scenario:'delete-first',guard:'floor'});
 assert.equal(early.floor,1);assert.equal(early.cache,1);
});
test('deletion failure retains stale value and retry responsibility until explicit retry',()=>{
 const before=run({scenario:'delete-failure'},['commit','fail']);
 assert.equal(before.cache,1);assert.equal(before.retry,true);assert.equal(stale(before),true);
 const retried=apply(before,'retry');
 assert.equal(retried.retry,false);assert.equal(retried.cache,null);
 const fresh=apply(retried,'fresh');assert.equal(fresh.cache,2);
});
test('TTL expiration is explicit, and late refill gets a new TTL period',()=>{
 const start=run({ttl:2},['delete','read','commit','fresh','wait']);
 assert.equal(start.time,2);assert.equal(start.cache,null);
 const delayed=apply(start,'fill');assert.equal(delayed.cache,1);assert.equal(delayed.expires,4);
 const expired=apply(delayed,'wait');assert.equal(expired.cache,null);assert.equal(expired.time,4);
 assert.equal(apply(expired,'fresh').cache,2);
});
test('pure steps preserve snapshots for exact undo and completed scenario is stable',()=>{
 const first=initial();const second=next(first);assert.equal(first.cache,1);assert.equal(first.log.length,1);
 assert.equal(second.cache,null);assert.equal(second.log.length,2);
 const last=run({});assert.equal(next(last),last);
 const empty=apply(initial(),'fill');assert.equal(empty.cache,1);assert.equal(empty.rejected,0);
});
test('changed versions and read ordering produce computed transfer results',()=>{
 for(const guard of ['none','present','floor'] as Guard[]){
 const s=run({scenario:'late-fill',base:7,guard});assert.equal(s.db,8);assert.equal(s.reader,7);
 assert.equal(s.cache,guard==='floor'?null:7);
 }
 const s=run({},['delete','commit','read','fill']);assert.equal(s.cache,2);assert.equal(stale(s),false);
});
