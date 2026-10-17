import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rawEvents,timeline,edgesFor,relation,duration,snapshot,eventsFor} from '../src/components/observability-lab/lesson179/model';
test('179 clock correction reverses display but does not rewrite evidence or create causality',()=>{
 const before=JSON.stringify(rawEvents);
 assert.ok(timeline(0).findIndex(e=>e.id==='P')<timeline(0).findIndex(e=>e.id==='O'));
 assert.ok(timeline(-3000).findIndex(e=>e.id==='O')<timeline(-3000).findIndex(e=>e.id==='P'));
 assert.deepEqual(snapshot(0,3).edges,snapshot(-3000,3).edges);
 assert.equal(snapshot(-3000,0).orderToPayment,'unknown');
 assert.equal(JSON.stringify(rawEvents),before);
 assert.equal(Object.isFrozen(rawEvents[0]),true);
});
test('179 partial evidence only permits supported reachability; version does not imply preceding cause',()=>{
 assert.equal(snapshot(0,1).orderToPayment,'unknown');
 assert.equal(snapshot(0,2).orderToPayment,'before');
 assert.equal(relation('P','O',edgesFor(['message','parent'])),'after');
 assert.equal(relation('O','P',edgesFor(['message','version'])),'unknown');
 assert.equal(relation('P','R',edgesFor(['message','parent','version'])),'unknown');
 assert.equal(snapshot(0,3).auditToPayment,'unknown');
});
test('179 duplicate delivery differs from a real second side effect',()=>{
 assert.equal(eventsFor(false).filter(e=>e.id==='P'||e.id==='R').every(e=>e.message==='m7'),true);
 assert.equal(snapshot(0,3,false).charges,1);
 assert.equal(snapshot(0,3,true).charges,2);
 assert.equal(eventsFor(false).find(e=>e.id==='R')?.effect,'tx-1');
 assert.equal(eventsFor(true).find(e=>e.id==='R')?.effect,'tx-2');
 assert.equal(rawEvents.find(e=>e.id==='R')?.effect,undefined);
});
test('179 monotonic duration requires same process and a nonnegative local interval',()=>{
 assert.equal(duration(rawEvents[0],rawEvents[1]),200);
 assert.equal(duration(rawEvents[1],rawEvents[2]),null);
 assert.equal(duration(rawEvents[1],rawEvents[0]),null);
});
test('179 boundary inputs clamp evidence and offsets; cycles terminate',()=>{
 assert.equal(snapshot(0,-1).phase,0);
 assert.equal(snapshot(0,100).phase,3);
 assert.equal(snapshot(0,NaN).phase,0);
 assert.deepEqual(timeline(Infinity),timeline(0));
 assert.deepEqual(timeline(-5000),timeline(-4000));
 assert.equal(relation('A','X',[{from:'A',to:'B',why:'test'},{from:'B',to:'A',why:'test'}]),'unknown');
 assert.equal(relation('A','A',[]),'unknown');
});
