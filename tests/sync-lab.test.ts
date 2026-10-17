import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,transition,operations,metrics,deadlocked,type Action,type State} from '../src/components/sync-lab/model';
import {guides,replay,routeFor,challenge} from '../src/components/sync-lab/guides';
const run=(id:number,fixed:boolean,actions:Action[],size=2)=>actions.reduce(transition,initial(id,fixed,size));
test('41 startup, durable write, completion receipt and process exit are separate',()=>{
 let s=run(41,false,['a','a']);assert.equal(s.saved,false);assert.equal(s.exited,true);assert.equal(transition(s,'b'),s);
 s=run(41,true,['a','a']);assert.equal(s.waiting,true);assert.equal(s.exited,false);
 s=transition(s,'b');assert.equal(s.saved,true);assert.equal(s.signal,false);
 s=transition(s,'a');assert.equal(s.exited,false);
 s=transition(s,'b');assert.equal(s.signal,true);s=transition(s,'a');assert.equal(s.exited,true);
});
test('42 same work, one or two execution units; cannot schedule finished tasks',()=>{
 for(const size of [1,2,3]){
  const single=run(42,false,routeFor(42,false,size),size),dual=run(42,true,routeFor(42,true,size),size);
  assert.deepEqual(single.pc,dual.pc);assert.equal(single.ticks.length,size*2);assert.equal(dual.ticks.length,size);
  assert.equal(transition(initial(42),'both').ticks.length,0);assert.equal(transition(dual,'both'),dual);
 }
});
test('43 all legal schedules: full lock retains both increments, unlocked admits loss',()=>{
 function outcomes(s:State):number[]{if(s.pc.every(p=>p===3))return [s.x];return operations(s).filter(o=>o.enabled).flatMap(o=>outcomes(transition(s,o.id)));}
 for(const size of [1,2,3]){
  assert.deepEqual(new Set(outcomes(initial(43,true,size))),new Set([2*size]));
  assert.deepEqual(new Set(outcomes(initial(43,false,size))),new Set([size,2*size]));
 }
 const s=run(43,true,['a']);assert.equal(transition(s,'b'),s);
});
test('44 readers observe a partial transfer only when lock scope is split',()=>{
 for(const size of [1,2,3]){
  const bad=run(44,false,['a','read'],size),good=run(44,true,['a','read'],size);
  assert.equal(bad.observed,String(100-size*10));assert.equal(good.observed,'尚未观察');assert.equal(good.waiting,true);
  const end=transition(transition(good,'a'),'read');assert.equal(end.observed,'100');assert.equal(end.waiting,false);
 }
});
test('45 shared data does not make different locks mutually exclusive',()=>{
 const copied=run(45,false,['a','b','read']);assert.deepEqual(copied.owners,[0,1]);assert.equal(copied.observed,'A、B');
 let shared=run(45,true,['a','b','read']);assert.deepEqual(shared.owners,[0,null]);assert.equal(shared.observed,'A');
 shared=transition(shared,'releaseA');shared=transition(shared,'b');assert.deepEqual(shared.owners,[1,null]);
 assert.equal(transition(shared,'releaseA'),shared);shared=transition(shared,'releaseB');assert.deepEqual(shared.owners,[null,null]);
});
test('46 inconsistent order admits a waiting cycle; a blocked acquisition cannot steal a lock',()=>{
 assert.equal(deadlocked(run(46,false,['a','b'])),false);
 const cycle=run(46,false,['a','b','a','b']);assert.equal(deadlocked(cycle),true);assert.deepEqual(cycle.pc,[1,1]);assert.deepEqual(cycle.owners,[0,1]);
 let fixed=run(46,true,['a','b']);assert.equal(deadlocked(fixed),false);assert.deepEqual(fixed.pc,[1,0]);
 fixed=['a','a','b','b','b'].reduce((s,a)=>transition(s,a as Action),fixed);assert.deepEqual(fixed.pc,[3,3]);assert.deepEqual(fixed.owners,[null,null]);
});
test('47 upgrade blocks; releasing and rechecking preserves a concurrent insertion',()=>{
 const blocked=run(47,false,['a','a']);assert.equal(blocked.waiting,true);assert.equal(blocked.count,1);assert.equal(transition(blocked,'a'),blocked);assert.equal(transition(blocked,'inject'),blocked);
 const recheck=run(47,true,['a','a','inject','a','a','a'],3);assert.equal(recheck.x,13);assert.equal(recheck.count,0);assert.equal(recheck.pc[0],5);assert.equal(recheck.owners[0],null);
 assert.equal(run(47,true,['a','a','a','a','a'],3).x,3);
});
test('48 late Add cannot retroactively block a returned Wait; Done count never goes negative',()=>{
 assert.equal(operations(initial(48,true)).find(o=>o.id==='read')!.enabled,false);
 let late=run(48,false,['a','read','b']);assert.equal(late.exited,true);assert.equal(late.count,2);
 const locked=run(48,true,['a','read']);assert.equal(locked.waiting,true);assert.equal(locked.exited,false);
 let end=transition(transition(locked,'b'),'b');assert.equal(end.count,0);assert.equal(end.exited,true);assert.equal(transition(end,'b'),end);
});
test('49 Once scope controls business count and initialization must return before business',()=>{
 for(const size of [1,2,3]){
  const bad=run(49,false,routeFor(49,false,size),size),good=run(49,true,routeFor(49,true,size),size);
  assert.equal(bad.count,1);assert.equal(good.count,1);assert.equal(bad.x,1);assert.equal(good.x,size);
 }
 const pending=run(49,true,['a']);assert.equal(pending.x,0);assert.equal(pending.saved,false);assert.equal(transition(pending,'a'),pending);
});
test('50 atomic fields admit mixed versions, whole lock hides intermediate state',()=>{
 const bad=run(50,false,['a','read'],3),good=run(50,true,['a','read'],3);
 assert.equal(bad.observed,'4 / 10');assert.equal(good.observed,'尚未观察');assert.equal(good.waiting,true);
 assert.equal(transition(transition(good,'a'),'read').observed,'4 / 40');
});
test('all guided routes use legal actions; states and replay histories are immutable',()=>{
 for(let id=41;id<=50;id++)for(const fixed of [false,true])for(const size of [1,2,3]){
  let state=initial(id,fixed,size);const snapshot=JSON.stringify(state);
  for(const action of routeFor(id,fixed,size)){assert.ok(operations(state).some(o=>o.id===action&&o.enabled),id+'/'+action);const old=JSON.stringify(state);const next=transition(state,action);assert.equal(JSON.stringify(state),old);state=next;assert.ok(metrics(state).every(([key,value])=>key&&value));}
  assert.equal(JSON.stringify(initial(id,fixed,size)),snapshot);assert.ok(guides[id].boundary);
 }
});
test('practice answers correspond to executed model evidence, for both conditions',()=>{
 for(let id=41;id<=50;id++)for(const variant of [0,1]){
  const c=challenge(id,variant),s=c.trace.at(-1)!;assert.equal(c.options.filter(x=>x===c.answer).length,1);assert.ok(c.trace.length>1);
  const actual:Record<number,string>={41:s.signal?'有完成回执保证':'没有完成保证',42:String(s.ticks.length),43:String(s.x),44:s.waiting?'等待整体更新完成':s.observed,45:s.owners.includes(1)?'true':'false',46:deadlocked(s)?'形成等待环':'未形成等待环',47:s.waiting?'不能，等待自己的读锁':String(s.x),48:s.waiting?'等待中':'立即返回',49:String(s.x),50:s.waiting?'等整体更新后读取':s.observed};
  assert.equal(c.answer,actual[id],id+' variant '+variant);
 }
 assert.equal(replay(44,true,2,['a','read'])[0].x,60);
});

