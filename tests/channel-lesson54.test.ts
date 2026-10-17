import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial54,outcome54,transition54} from '../src/components/channel-lessons/model54';

test('close preserves buffered zero and each real value has ok true',()=>{
 const initial=initial54(); let s=transition54(initial,{type:'close'});
 assert.deepEqual(s.queue,[0,5]);assert.equal(outcome54(s),'data0');
 s=transition54(s,{type:'receive'});assert.deepEqual(s.results[0],{value:0,ok:true,processed:true});
 s=transition54(s,{type:'receive'});assert.deepEqual(s.processed,[0,5]);
 s=transition54(s,{type:'receive'});assert.deepEqual(s.results[2],{value:0,ok:false,processed:false});
 s=transition54(s,{type:'receive'});assert.equal(s.results[3]?.ok,false);
 assert.deepEqual(initial.queue,[0,5]);
});
test('range processes buffered zero then ends without an extra loop body',()=>{
 let s=transition54(initial54('range'),{type:'close'});
 for(let i=0;i<3;i++)s=transition54(s,{type:'receive'});
 assert.equal(s.stopped,true);assert.deepEqual(s.processed,[0,5]);assert.equal(transition54(s,{type:'receive'}),s);
});
test('value-only termination loses genuine zero and leaves next message',()=>{
 const s=transition54(transition54(initial54('zero'),{type:'close'}),{type:'receive'});
 assert.equal(s.stopped,true);assert.deepEqual(s.queue,[5]);assert.deepEqual(s.processed,[]);assert.equal(s.results[0]?.ok,true);
});
test('pending empty open receive is woken by send without reissuing receive',()=>{
 const waiting=transition54(initial54('pair',[]),{type:'receive'});
 assert.equal(waiting.waiting,true);assert.deepEqual(waiting.results,[]);assert.equal(transition54(waiting,{type:'receive'}),waiting);
 const awake=transition54(waiting,{type:'send',value:0});
 assert.equal(awake.waiting,false);assert.deepEqual(awake.queue,[]);assert.deepEqual(awake.results,[{value:0,ok:true,processed:true}]);
});
test('close wakes pending range receive and terminates',()=>{
 const waiting=transition54(initial54('range',[]),{type:'receive'});
 const end=transition54(waiting,{type:'close'});assert.equal(end.stopped,true);assert.equal(end.waiting,false);assert.equal(end.results[0]?.ok,false);
});
