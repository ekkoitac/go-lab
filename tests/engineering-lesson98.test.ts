import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialSettings,stateAt,type CopyPolicy} from '../src/components/engineering-lab/lesson98/model';

test('descriptor copying shares the array, so sequential requests leak writes',()=>{
  const acquired=stateAt(initialSettings,1);
  assert.equal(acquired.a,'G'); assert.equal(acquired.globalValue,'stable');
  const mutated=stateAt(initialSettings,2);
  assert.equal(mutated.globalValue,'debug'); assert.equal(mutated.bValue,null);
  assert.equal(stateAt(initialSettings,3).bValue,'debug');
  assert.equal(acquired.globalValue,'stable','replaying cannot mutate prior snapshots');
});
test('copying string elements isolates replacing an element',()=>{
  for(const policy of ['elements','deep'] as CopyPolicy[]){
    const s=stateAt({...initialSettings,policy},3);
    assert.notEqual(s.a,s.global); assert.equal(s.aValue,'debug');
    assert.equal(s.globalValue,'stable'); assert.equal(s.bValue,'stable');
  }
});
test('nested map writes require copying the map; copying only outer elements leaks',()=>{
  const shallow=stateAt({kind:'maps',policy:'elements',mutation:'nested'},3);
  assert.notEqual(shallow.a,shallow.global);
  assert.equal(shallow.arrays.A[0],shallow.arrays.G[0]);
  assert.equal(shallow.bValue,'debug');
  const deep=stateAt({kind:'maps',policy:'deep',mutation:'nested'},3);
  assert.notEqual(deep.arrays.A[0],deep.arrays.G[0]);
  assert.equal(deep.aValue,'debug'); assert.equal(deep.bValue,'stable');
});
test('replacing a map element differs from mutating a shared map',()=>{
  const s=stateAt({kind:'maps',policy:'elements',mutation:'element'},3);
  assert.equal(s.aValue,'debug'); assert.equal(s.bValue,'stable');
  assert.equal(s.maps.M0.mode,'stable'); assert.equal(s.arrays.A[0],'Mnew');
  const shared=stateAt({kind:'maps',policy:'descriptor',mutation:'element'},3);
  assert.equal(shared.bValue,'debug'); assert.equal(shared.maps.M0.mode,'stable');
});
test('read-only boundary rejects all modeled writes without needless cloning',()=>{
  for(const kind of ['strings','maps'] as const) for(const mutation of ['element','nested'] as const){
    const s=stateAt({kind,mutation,policy:'readonly'},3);
    assert.equal(s.blocked,true); assert.equal(s.a,'G'); assert.equal(s.b,'G');
    assert.equal(s.globalValue,'stable'); assert.equal(s.aValue,'stable');
    assert.equal(s.bValue,'stable'); assert.deepEqual(Object.keys(s.arrays),['G']);
  }
});
test('replay restores graph, clamps endpoints and normalizes invalid string operation',()=>{
  const settings={kind:'maps',policy:'elements',mutation:'nested'} as const;
  const initial=stateAt(settings,0), acquired=stateAt(settings,1);
  stateAt(settings,3);
  assert.deepEqual(stateAt(settings,1),acquired); assert.deepEqual(stateAt(settings,-1),initial);
  assert.deepEqual(stateAt(settings,99),stateAt(settings,3));
  assert.equal(stateAt({...initialSettings,mutation:'nested'},2).settings.mutation,'element');
});
