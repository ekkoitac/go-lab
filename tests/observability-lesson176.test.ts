import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,simulate,traces,transferTraces,winner} from '../src/components/observability-lab/lesson176/model';
test('head sampling drops errors before outcomes; bounded tail keeps B and F but D is late',()=>{
 const s=simulate(defaults,8);assert.equal(s.headErrors,0);assert.equal(s.tailErrors,2);assert.equal(s.late,1);assert.equal(s.tail.find(t=>t.id==='D')?.status,'timeout');assert.equal(winner(s),'tail');assert.equal(s.truthErrors,3);assert.equal(s.completed,6);
});
test('head prefilter losses cannot be recovered by large capacity or long wait',()=>{
 const s=simulate({...defaults,prefilter:true,capacity:6,wait:6},8);assert.equal(s.tailErrors,0);for(const id of ['B','D','F'])assert.equal(s.tail.find(t=>t.id===id)?.status,'head-drop');
});
test('capacity rejection and timeout are separate causes',()=>{
 const tiny=simulate({...defaults,capacity:1,wait:6},8);assert.equal(tiny.tail.find(t=>t.id==='B')?.status,'overflow');assert.equal(tiny.late,0);assert.ok(tiny.peak<=1);
 const enough=simulate({...defaults,capacity:6,wait:4},8);assert.equal(enough.tailErrors,3);assert.equal(enough.late,0);assert.equal(enough.tail.find(t=>t.id==='A')?.status,'budget-drop');
});
test('deadline arrival is accepted, later arrival cannot resurrect expired trace',()=>{
 assert.equal(simulate({...defaults,wait:4},6).tail.find(t=>t.id==='D')?.status,'kept');
 const timed=simulate(defaults,5).tail.find(t=>t.id==='D');assert.equal(timed?.status,'timeout');assert.equal(timed?.late,false);
 assert.equal(simulate(defaults,6).tail.find(t=>t.id==='D')?.late,true);
});
test('deterministic replay supports back and reset without mutation and exposes sample bias',()=>{
 const input=JSON.stringify(traces),config=JSON.stringify(defaults),first=simulate(defaults,1);simulate(defaults,8);assert.deepEqual(simulate(defaults,1),first);assert.ok(simulate(defaults,-1).tail.every(t=>t.status==='pending'));assert.equal(JSON.stringify(traces),input);assert.equal(JSON.stringify(defaults),config);
 const s=simulate(defaults,8);assert.notEqual(s.tailErrors/s.tail.filter(t=>t.status==='kept').length,s.truthErrors/s.completed);
});
test('new transfer inputs require six seconds rather than memorizing baseline four',()=>{
 assert.equal(simulate({...defaults,capacity:6,wait:4},8,transferTraces).tailErrors,2);assert.equal(simulate({...defaults,capacity:6,wait:6},8,transferTraces).tailErrors,3);
});
