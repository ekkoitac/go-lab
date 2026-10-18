import {test} from 'node:test';
import assert from 'node:assert/strict';
import {challenge,initialState,interrupted,result,run,transition,type Action,type State} from '../src/components/sync-lab/lesson50/model';

test('separate atomic fields admit new version with old limit',()=>{
  const state=run('fields',interrupted);
  assert.deepEqual(state.observed,{version:2,limit:10});
  assert.equal(result(state),'mixed');
  assert.deepEqual(state.shared,{version:2,limit:20});
});
test('a reader can also splice old version with new limit',()=>{
  const state=run('fields',['reader','reader','writer','writer','writer','writer','reader']);
  assert.deepEqual(state.observed,{version:1,limit:20});assert.equal(result(state),'mixed');
});
test('same mutex blocks reading halfway through update and allows whole new snapshot',()=>{
  const half=run('mutex',['writer','writer']);
  const blocked=transition(half,'reader');
  assert.equal(blocked.reader,0);assert.deepEqual(blocked.observed,{});
  const done=['writer','writer','reader','reader','reader','reader'].reduce((s,a)=>transition(s,a as Action),blocked);
  assert.equal(done.owner,null);assert.equal(result(done),'new');
});
test('reader lock also prevents writers from changing fields between loads',()=>{
  const state=run('mutex',['reader','reader','writer','reader','reader']);
  assert.equal(state.writer,0);assert.equal(result(state),'old');assert.equal(state.owner,null);
});
test('immutable pointer capture retains the old object across new publication',()=>{
  const state=run('snapshot',['reader','reader','writer','writer','writer','writer','reader','reader']);
  assert.equal(state.published,'new');assert.equal(state.captured,'old');
  assert.deepEqual(state.observed,{version:1,limit:10});assert.equal(result(state),'old');
  assert.deepEqual(state.objects.new,{version:2,limit:20});
});
test('private construction cannot expose partial snapshot',()=>{
  const state=run('snapshot',['writer','writer','reader','reader','reader'],50);
  assert.deepEqual(state.draft,{version:2,limit:10});
  assert.deepEqual(state.shared,{version:1,limit:10});assert.equal(result(state),'old');
});
test('publication followed by mutation breaks immutable object constraint',()=>{
  const valid=challenge('snapshot',false),invalid=challenge('snapshot',true);
  assert.equal(result(valid),'new');assert.equal(result(invalid),'mixed');
  assert.deepEqual(invalid.observed,{version:2,limit:40});assert.equal(invalid.unsafe,true);
});
test('transition preserves previous state for rewind and branching',()=>{
  const start=initialState('snapshot'),serialized=JSON.stringify(start);
  const mid=transition(transition(start,'writer'),'writer');
  assert.equal(JSON.stringify(start),serialized);assert.equal(mid.draft.version,2);
  assert.equal(start.draft.version,1);assert.equal(transition(start,'mutate'),start);
});
test('all interleavings preserve a whole pair with mutex or immutable publication',()=>{
  for(const strategy of ['mutex','snapshot'] as const){
    let complete=0;
    function walk(s:State,remaining:number){
      if(s.writer===4&&s.reader===4){assert.notEqual(result(s),'mixed');complete++;return;}
      if(!remaining)return;
      for(const actor of ['writer','reader'] as const){
        const n=transition(s,actor);
        if(n[actor]!==s[actor])walk(n,remaining-1);
      }
    }
    walk(initialState(strategy),8);assert.ok(complete>0);
  }
});

