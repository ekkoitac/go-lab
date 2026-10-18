import test from 'node:test';
import assert from 'node:assert/strict';
import {initial, inspect, repair, toggle, probe, switchCode, type Config} from '../src/components/types-lab/lesson26/model';
test('unknown bool has an observable empty success before default repair',()=>{
  assert.equal(inspect(initial).route,'无匹配');
  assert.equal(inspect(initial).output,'""');
  const fixed=repair(initial);
  assert.equal(inspect(fixed).route,'default');
  assert.equal(inspect(fixed).output,'unsupported bool');
  assert.equal(fixed.input,initial.input);
  assert.equal(initial.fallback,false);
});
test('default repair preserves all supported payload outcomes',()=>{
  for(const input of ['int','string'] as const){
    const c={...initial,input,text:'not-an-email'};
    assert.deepEqual(inspect(repair(c)),inspect(c));
  }
});
test('nil interface and typed nil use distinct case branches',()=>{
  const c:Config={...initial,branches:['nil','*User'],fallback:true};
  const empty=inspect({...c,input:'nil'});
  const typed=inspect({...c,input:'typedNil'});
  assert.equal(empty.route,'nil');assert.equal(empty.dynamicType,null);assert.equal(empty.staticType,'any');
  assert.equal(typed.route,'*User');assert.equal(typed.staticType,'*User');
  assert.equal(inspect({...c,input:'typedNil',branches:['nil']}).route,'default');
  assert.match(probe({...c,input:'typedNil'},'nil').explanation,/true/);
  assert.match(probe({...c,input:'typedNil',branches:['nil']},'nil').explanation,/false/);
});
test('multi-type case retains any and does not permit integer-specific addition',()=>{
  const c:Config={...initial,input:'int'};
  assert.equal(probe(c,'add').allowed,true);
  assert.equal(inspect({...c,grouped:true}).staticType,'any');
  assert.equal(probe({...c,grouped:true},'add').allowed,false);
  assert.equal(inspect({...c,grouped:true}).route,'int, string');
  assert.equal(probe({...c,input:'string'},'length').allowed,true);
  assert.equal(probe({...c,input:'string'},'nil').allowed,false);
});
test('routing uses type identity, not numeric appearance or business validity',()=>{
  assert.equal(inspect({...initial,input:'float64',fallback:true}).status,'明确拒绝');
  assert.equal(inspect({...initial,input:'string',text:''}).output,'label:');
  assert.equal(inspect({...initial,input:'string',text:'bad email'}).route,'string');
});
test('adding or removing a branch changes real routing and never mutates the old model',()=>{
  const c:Config={...initial,input:'typedNil'};
  const added=toggle(c,'*User');
  assert.equal(inspect(added).status,'支持');
  assert.equal(inspect(toggle(added,'*User')).status,'空成功');
  assert.deepEqual(c.branches,['int','string']);
  assert.match(switchCode(repair(initial)),/default:/);
  assert.doesNotMatch(switchCode(initial),/default:/);
});
test('all supported configurations use at most one matching route with explicit fallback',()=>{
  const branches=['int','string','nil','*User'] as const;
  for(let mask=0;mask<16;mask++) for(const input of ['int','string','bool','float64','nil','typedNil'] as const) for(const grouped of [true,false]){
    const c:Config={...initial,input,grouped,branches:branches.filter((_,i)=>mask&(1<<i)),fallback:true};
    const r=inspect(c);
    assert.notEqual(r.route,'无匹配');
    assert.ok(r.route==='default'||r.cases.includes(r.route));
    assert.equal(new Set(r.cases).size,r.cases.length);
    if(grouped) assert.equal(r.cases.filter(x=>x==='int'||x==='string').length,0);
  }
});
