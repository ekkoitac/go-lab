import test from 'node:test';
import assert from 'node:assert/strict';
import { baseline, initial, inspect, replay, transition, orders, type Config } from '../src/components/collections-lab/lesson20/model';
test('sorting gives same key order for every illustrated legal iteration order',()=>{
  for(let order=0;order<orders.length;order++) {
    const s=replay({...baseline,order,writer:false},['collect','sort','output']);
    assert.deepEqual(s.rows,['amy:5','max:7','zoe:8']);
    assert.equal(inspect(s).safeProtocol,true);
  }
});
test('sorting and reader-private locks do not protect overlapping writers',()=>{
  for(const protocol of ['none','reader-only'] as const){
    const s=replay({...baseline,protocol},['collect','sort','write','output']);
    assert.equal(s.conflict,true); assert.equal(s.outcome,'unsafe'); assert.equal(s.rows,null);
    assert.equal(inspect(s).outputStableOrder,true);assert.equal(inspect(s).safeProtocol,false);
  }
});
test('shared RWMutex blocks writer until reader releases, without fabricating a write',()=>{
  const config:Config={...baseline,protocol:'shared'};
  const blocked=replay(config,['collect','sort','write']);
  assert.equal(blocked.outcome,'blocked');assert.equal(blocked.map.amy,5);assert.equal(blocked.conflict,false);
  const s=transition(transition(blocked,'output'),'write');
  assert.equal(s.map.amy,9);assert.deepEqual(s.rows,['amy:5','max:7','zoe:8']);
});
test('safe key snapshots do not preserve old values, integer entry copies do',()=>{
  const actions=['collect','release','write','sort','output'] as const;
  const keys=replay({...baseline,protocol:'shared'},[...actions]);
  const entries=replay({...baseline,protocol:'shared',snapshot:'entries'},[...actions]);
  assert.equal(keys.rows?.[0],'amy:9');assert.equal(entries.rows?.[0],'amy:5');
  assert.equal(entries.map.amy,9);assert.equal(entries.values?.amy,5);
  assert.equal(inspect(entries).snapshotConsistent,true);
});
test('no writer permits concurrent read-only; one observed non-overlap is not a protocol proof',()=>{
  assert.equal(inspect(replay({...baseline,writer:false},['collect','output'])).safeProtocol,true);
  const serial=replay(baseline,['collect','release','write','output']);
  assert.equal(serial.conflict,false);assert.equal(inspect(serial).safeProtocol,false);
});
test('history replay rewinds conflicts and states are not mutated',()=>{
  const start=initial();const collect=transition(start,'collect');const unsafe=transition(collect,'write');
  assert.equal(start.keys.length,0);assert.equal(collect.conflict,false);assert.equal(unsafe.conflict,true);
  assert.deepEqual(replay(baseline,['collect']),collect);assert.deepEqual(replay(baseline,[]),start);
  assert.equal(transition(start,'sort'),start);
});
test('sorting after output invalidates stale rows, and conflicts stop all forward actions',()=>{
  const emitted=replay({...baseline,writer:false},['collect','output']);
  assert.deepEqual(emitted.rows,['zoe:8','amy:5','max:7']);
  const sorted=transition(emitted,'sort');
  assert.equal(sorted.rows,null);
  assert.deepEqual(transition(sorted,'output').rows,['amy:5','max:7','zoe:8']);
  const conflict=replay(baseline,['collect','write']);
  for(const action of ['sort','release','output','write'] as const) {
    assert.equal(transition(conflict,action),conflict);
    assert.equal(transition(conflict,action).outcome,'unsafe');
  }
});
