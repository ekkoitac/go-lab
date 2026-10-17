import test from 'node:test';
import assert from 'node:assert/strict';
import {completeJob,initialState,isReady,transition as step,type LabState,type Action} from '../src/components/channel-lab/model';
const run=(s:LabState,...actions:Action[])=>actions.reduce(step,s);
const a=(s:LabState,id='p')=>s.actors.find(a=>a.id===id)!;
test('51: both rendezvous orders and same-goroutine dead end; delivery is not business completion',()=>{
  for(const reverse of [false,true]){
    const start=initialState(51),send:Action={type:'send',value:7},receive:Action={type:'receive',actor:'r'};
    const middle=step(start,reverse?receive:send),end=step(middle,reverse?send:receive);
    assert.equal(a(middle,reverse?'r':'p').status,reverse?'receive':'send');
    assert.deepEqual(end.receipts,[{value:7,ok:true}]);assert.equal(a(end).status,'ready');assert.equal(a(end,'r').status,'working');
    assert.equal(a(step(end,{type:'finish',actor:'r'}),'r').status,'ready');assert.equal(start.receipts.length,0);
  }
  const blocked=run(initialState(51,{separate:false}),{type:'send',value:7},{type:'receive'});
  assert.equal(a(blocked).status,'send');assert.equal(blocked.receipts.length,0);
});
test('52: FIFO, bounded buffers, pending send automatically fills freed slot at every capacity',()=>{
  for(let capacity=0;capacity<=5;capacity++){
    let s=initialState(52,{capacity});for(let i=1;i<=capacity+1;i++)s=step(s,{type:'send',value:i});
    assert.equal(s.channels[0].queue.length,capacity);assert.equal(a(s).status,'send');assert.equal(a(s).value,capacity+1);
    s=step(s,{type:'receive',actor:'r'});assert.equal(a(s).status,'ready');assert.deepEqual(s.receipts,[{value:1,ok:true}]);
    assert.deepEqual(s.channels[0].queue,Array.from({length:capacity},(_,i)=>i+2));
  }
});
test('52/53: close wakes blocked sender with panic and never enqueues its value; panic ends the run',()=>{
  const s=run(initialState(52,{capacity:1}),{type:'send',value:1},{type:'send',value:2},{type:'close',actor:'env'});
  assert.equal(a(s).status,'panic');assert.deepEqual(s.channels[0].queue,[1]);assert.equal(step(s,{type:'receive',actor:'r'}),s);
});
test('53: one producer ending cannot authorize close; coordinated shutdown preserves all data',()=>{
  let s=run(initialState(53),{type:'send',actor:'p',value:1},{type:'finish',actor:'p'},{type:'close',actor:'c'});
  assert.equal(s.channels[0].closed,false);
  s=run(s,{type:'send',actor:'b',value:2},{type:'finish',actor:'b'},{type:'close',actor:'c'},{type:'receive',actor:'r'},{type:'receive',actor:'r'},{type:'receive',actor:'r'});
  assert.deepEqual(s.receipts,[{value:1,ok:true},{value:2,ok:true},{value:0,ok:false}]);
  assert.equal(a(step(s,{type:'close',actor:'c'}),'c').status,'panic');
  const early=run(initialState(53),{type:'close',actor:'r'},{type:'send',actor:'b',value:2});assert.equal(a(early,'b').status,'panic');
});
test('54: zero in buffer remains valid even after close; repeated drained reads remain observable',()=>{
  let s=step(initialState(54),{type:'close',actor:'env'});for(let i=0;i<4;i++)s=step(s,{type:'receive',actor:'r'});
  assert.deepEqual(s.receipts,[{value:0,ok:true},{value:7,ok:true},{value:0,ok:false},{value:0,ok:false}]);
  const wake=run(initialState(52,{capacity:0}),{type:'receive',actor:'r'},{type:'close',actor:'env'});
  assert.equal(a(wake,'r').status,'ready');assert.deepEqual(wake.receipts,[{value:0,ok:false}]);
});
test('55: closed remains ready, nil disables future selects, and all-nil requires an exit guard',()=>{
  let s=run(initialState(55),{type:'select',branch:'a'},{type:'select',branch:'a'});assert.equal(s.receipts.length,2);
  s=step(s,{type:'nil',channel:'a'});assert.equal(isReady(s.channels[0]),false);
  s=run(s,{type:'supply',channel:'b',value:9},{type:'select',branch:'b'});assert.deepEqual(s.receipts.at(-1),{value:9,ok:true});
  for(const guard of [false,true]){const end=run(initialState(55,{guard}),{type:'nil',channel:'a'},{type:'nil',channel:'b'},{type:'select'});assert.equal(a(end,'r').status,guard?'done':'receive');}
  const nilRead=run(initialState(55),{type:'nil',channel:'a'},{type:'receive',actor:'r',channel:'a'});assert.equal(a(nilRead,'r').nilWait,true);
  const cannotAdvance=run(nilRead,{type:'supply',channel:'b'},{type:'select',branch:'b'});assert.equal(a(cannotAdvance,'r').nilWait,true);assert.equal(cannotAdvance.receipts.length,0);
});
test('56: either simultaneously-ready branch is legal; unavailable branch never fabricates a result',()=>{
  const start=initialState(56);assert.ok(start.channels.every(isReady));
  assert.deepEqual(step(start,{type:'select',branch:'a'}).receipts,[{value:7,ok:true}]);
  const cancel=step(start,{type:'select',branch:'b'});assert.deepEqual(cancel.receipts,[]);assert.equal(a(cancel,'r').status,'done');assert.match(cancel.label,/取消/);
  start.channels.forEach(c=>{c.queue=[];c.closed=false;});const wait=step(start,{type:'select'});assert.equal(a(wait,'r').status,'receive');
  const resumed=run(wait,{type:'supply',channel:'a',value:8},{type:'select',branch:'a'});assert.deepEqual(resumed.receipts,[{value:8,ok:true}]);
});
test('57: default spins, no-default blocks, data/cancellation wakes without an extra poll',()=>{
  let s=initialState(57);for(let i=0;i<5;i++)s=step(s,{type:'poll'});assert.equal(s.defaults,5);assert.equal(a(s,'r').status,'ready');
  const blocked=step(initialState(57,{withDefault:false}),{type:'poll'});assert.equal(a(blocked,'r').status,'receive');assert.equal(step(blocked,{type:'poll'}).rounds,1);
  const resumed=step(blocked,{type:'send',value:3});assert.equal(a(resumed,'r').status,'ready');assert.deepEqual(resumed.receipts,[{value:3,ok:true}]);
  assert.equal(a(step(blocked,{type:'cancel'}),'r').status,'done');
});
test('58: cancel does not force exit; two tasks must each observe, clean up, and acknowledge',()=>{
  const unaware=run(initialState(58),{type:'cancel'},{type:'work'});assert.equal(a(unaware).status,'working');assert.equal(unaware.work,1);
  let s=step(initialState(58,{cancellable:true}),{type:'cancel'});assert.ok(s.actors.every(a=>a.status==='ready'));
  for(const id of ['p','b']){s=step(s,{type:'work',actor:id});assert.equal(a(s,id).status,'cleanup');s=step(s,{type:'cleanup',actor:id});assert.equal(a(s,id).status,'done');}
});
test('59: cancellation must participate in blocked send; larger buffers only delay the leak',()=>{
  for(const cancellable of [false,true])for(const capacity of [0,2]){
    let s=step(initialState(59,{cancellable,capacity}),{type:'leave',actor:'r'});
    for(let i=0;i<=capacity;i++)s=step(s,{type:'send',value:i+1});assert.equal(a(s).status,'send');
    s=step(s,{type:'cancel'});assert.equal(a(s).status,cancellable?'cleanup':'send');
    if(cancellable){assert.equal(s.channels[0].queue.length,capacity);s=step(s,{type:'cleanup'});assert.equal(a(s).status,'done');}
  }
  const cancelledFirst=run(initialState(59,{cancellable:true}),{type:'cancel'},{type:'send',value:1});assert.equal(a(cancelledFirst).status,'cleanup');
});
test('60: concurrency/queue independent, out-of-order completion, close drains and workers acknowledge exit',()=>{
  let s=initialState(60,{workers:2,capacity:1});
  s=run(s,{type:'submit'},{type:'take',actor:'w0'},{type:'submit'},{type:'take',actor:'w1'},{type:'submit'},{type:'submit'});
  assert.equal(s.peak,2);assert.equal(s.channels[0].queue.length,1);assert.equal(a(s).status,'send');
  s=completeJob(s,'w1');s=step(s,{type:'take',actor:'w1'});assert.equal(a(s).status,'ready');assert.deepEqual(s.channels[0].queue,[4]);
  s=step(s,{type:'close'});s=completeJob(s,'w0');s=step(s,{type:'take',actor:'w0'});s=completeJob(s,'w0');s=completeJob(s,'w1');
  s=run(s,{type:'take',actor:'w0'},{type:'take',actor:'w1'});assert.deepEqual(s.completed,[2,1,4,3]);assert.equal(a(s,'w0').status,'done');assert.equal(a(s,'w1').status,'done');
});
