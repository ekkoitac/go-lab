import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aliasExample, baseline, defaults, frame, protocol, validate, type Config} from '../src/components/delivery-lab/lesson197/model';

test('197 shared write exposes a mixed version before validation',()=>{
 const state=frame({...defaults,limit:7,burst:8},1);
 assert.deepEqual([state.current.limit,state.current.burst],[7,4]);
 assert.equal(state.halfUpdated,true);
 assert.equal(state.current.version,1);
 assert.equal(state.requestA.limit,7);
});
test('197 rejecting a bad shared update does not roll back the poisoned object',()=>{
 const state=frame(defaults,5);
 assert.equal(state.accepted,false);
 assert.equal(state.validation,'rejected');
 assert.equal(state.current.limit,-1);
 assert.equal(state.requestA.limit,-1);
 assert.equal(state.requestB?.limit,-1);
});
test('197 rejected private candidate preserves the complete old snapshot',()=>{
 for(const patch of [{limit:-1},{limit:7,burst:4},{parseError:true},{limit:101}]) {
  const config:Config={...defaults,strategy:'snapshot',...patch};
  for(let step=0;step<=5;step++) {
   const state=frame(config,step);
   assert.deepEqual(state.current,baseline());
   assert.deepEqual(state.requestA,baseline());
  }
  assert.equal(frame(config,5).accepted,false);
 }
});
test('197 valid snapshot becomes visible only at atomic publication and keeps old request stable',()=>{
 const config:Config={...defaults,strategy:'snapshot',limit:7,burst:8};
 for(let step=0;step<=3;step++) assert.deepEqual(frame(config,step).current,baseline());
 const state=frame(config,5);
 assert.equal(state.current.version,2);
 assert.deepEqual([state.current.limit,state.current.burst],[7,8]);
 assert.deepEqual(state.requestA,baseline());
 assert.deepEqual(state.requestB,state.current);
});
test('197 atomic config publication cannot switch connection resources',()=>{
 const config:Config={...defaults,strategy:'snapshot',limit:7,burst:8};
 const state=frame(config,5);
 assert.equal(state.current.endpoint,'db-b');
 assert.equal(state.resource,'db-a');
 assert.equal(state.resourceMatches,false);
 assert.equal(frame(config,5,true).resource,'db-b');
 assert.equal(frame({...config,limit:-1},5,true).resource,'db-a');
});
test('197 rewind reconstructs values without retaining candidate mutations',()=>{
 const config:Config={...defaults,limit:7,burst:8};
 frame(config,5);
 assert.deepEqual(frame(config,0).current,baseline());
 assert.deepEqual([frame(config,1).current.limit,frame(config,1).current.burst],[7,4]);
 assert.equal(frame(config,99).stage,5);
 assert.equal(frame(config,-1).stage,0);
});
test('197 field validation includes integer bounds and cross-field rule',()=>{
 assert.deepEqual(validate({limit:1,burst:1}),[]);
 assert.deepEqual(validate({limit:100,burst:100}),[]);
 for (const value of [{limit:0,burst:4},{limit:1.5,burst:4},{limit:2,burst:101},{limit:4,burst:2}]) assert.ok(validate(value).length>0);
});
test('197 nested map alias remains shared after shallow copy but not deep copy',()=>{
 assert.deepEqual(aliasExample(false,9),{old:9,next:9,shared:true});
 assert.deepEqual(aliasExample(true,9),{old:2,next:9,shared:false});
});
test('197 protocol enforces parse validate publish and invalidates stale validation',()=>{
 assert.equal(protocol(['publish','parse','publish'],false).current,2);
 assert.equal(protocol(['parse','validate','publish'],false).current,7);
 assert.equal(protocol(['parse','validate','publish'],true).current,2);
 assert.equal(protocol(['parse','validate','parse','publish'],false).current,2);
});
