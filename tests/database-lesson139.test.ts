import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,duplicates,missingKeys,type ImportState} from '../src/components/database-lab/lesson139/model';
const steps=(s:ImportState,n:number)=>{for(let i=0;i<n;i++)s=transition(s,'step');return s;};
const recover=(s:ImportState)=>transition(transition(s,'crash'),'restart');
test('same input: finite batch exposes a committed prefix while big transaction still holds drafts',()=>{
 const start=initialState(); const s=steps(start,4);
 assert.deepEqual(s.lanes[0].draft,[1,2,3,4]);assert.deepEqual(s.lanes[0].persisted,[]);
 assert.deepEqual(s.lanes[1].persisted,[1,2,3]);assert.equal(s.lanes[1].checkpoint,3);
 assert.equal(s.lanes[1].read,3);assert.equal(start.lanes[0].read,0);
});
test('atomic checkpoints stay behind reads and recover from committed position after any crash',()=>{
 for(const batch of [2,3,4])for(let at=0;at<13;at++){
  const before=steps(initialState(batch),at); const crashed=transition(before,'crash');
  for(let i=0;i<2;i++){assert.deepEqual(crashed.lanes[i].draft,[]);assert.deepEqual(crashed.lanes[i].persisted,before.lanes[i].persisted);assert.equal(crashed.lanes[i].checkpoint,before.lanes[i].checkpoint);}
  const resumed=transition(crashed,'restart');for(const l of resumed.lanes)assert.equal(l.read,l.checkpoint);
  const done=steps(resumed,30);for(const l of done.lanes){assert.equal(l.phase,'done');assert.deepEqual(l.persisted,[1,2,3,4,5,6,7,8]);assert.equal(l.checkpoint,8);assert.equal(l.peak<=l.batch,true);}
 }
});
test('checkpoint-first skips data and business-key idempotence cannot repair omissions',()=>{
 const gap=steps(initialState(3,'checkpoint-first'),4);assert.equal(gap.lanes[1].checkpoint,3);assert.deepEqual(gap.lanes[1].persisted,[]);
 const done=steps(recover(gap),30);assert.deepEqual(done.lanes[1].persisted,[4,5,6,7,8]);assert.deepEqual(missingKeys(done,done.lanes[1]),[1,2,3]);
});
test('data-first replays a stale checkpoint: stable key prevents duplicate rows, fresh identities do not',()=>{
 for(const idempotent of [true,false]){
  const gap=steps(initialState(3,'data-first',idempotent),4);assert.equal(gap.lanes[1].checkpoint,0);assert.deepEqual(gap.lanes[1].persisted,[1,2,3]);
  const done=steps(recover(gap),30);assert.equal(done.lanes[1].replayed,3);assert.equal(duplicates(done.lanes[1]),idempotent?0:3);assert.equal(new Set(done.lanes[1].persisted).size,8);
 }
});
test('a crash after atomic commit retains the prefix; the final short batch is committed too',()=>{
 const s=steps(recover(steps(initialState(3),4)),30);assert.equal(s.lanes[1].commits,3);assert.equal(s.lanes[1].peak,3);assert.equal(s.lanes[0].commits,1);assert.equal(s.lanes[0].peak,8);
 const done=steps(initialState(2,'atomic',true,5),20);assert.deepEqual(done.lanes[1].persisted,[1,2,3,4,5]);assert.equal(done.lanes[1].commits,3);
});
test('crashed and finished lanes cannot accidentally advance',()=>{
 const crashed=transition(steps(initialState(),2),'crash');assert.deepEqual(transition(crashed,'step'),crashed);
 const done=steps(initialState(),30);assert.deepEqual(transition(done,'step'),done);assert.deepEqual(transition(done,'restart'),done);
});
