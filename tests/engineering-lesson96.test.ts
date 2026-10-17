import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceLeak,expectedOutcome,initialLeakState,rescueLeak,type Protection} from '../src/components/engineering-lab/lesson96/model';
const reachSend=(protection:Protection,consumerLeaves=true)=>advanceLeak(advanceLeak(initialLeakState({protection,consumerLeaves})));
test('cancel after the precheck cannot unblock an ordinary send',()=>{
 for(const protection of ['none','precheck'] as const){const before=reachSend(protection);const blocked=advanceLeak(before);assert.equal(before.cancelled,true);assert.equal(before.done,false);assert.equal(blocked.phase,'blocked');assert.equal(blocked.delivered,false);assert.equal(advanceLeak(blocked),blocked);assert.equal(expectedOutcome(blocked),'blocked');}
});
test('select observes cancellation at send, but done needs a separate return',()=>{
 const cancelled=reachSend('select');const returning=advanceLeak(cancelled);assert.equal(returning.selected,'cancel');assert.equal(returning.done,false);assert.equal(returning.delivered,false);const done=advanceLeak(returning);assert.equal(done.done,true);assert.equal(advanceLeak(done),done);assert.equal(cancelled.selected,null,'input stays immutable');
});
test('both ready select cases are legal and cancel has no priority',()=>{
 const both=reachSend('select',false);assert.equal(expectedOutcome(both),'either');assert.equal(advanceLeak(both,0).selected,'send');assert.equal(advanceLeak(both,.99).selected,'cancel');assert.equal(advanceLeak(both,0).delivered,true);assert.equal(advanceLeak(both,.99).delivered,false);
});
test('cleanup uses a receiver rather than pretending cancellation fixed the send',()=>{
 const blocked=advanceLeak(reachSend('precheck'));const rescued=rescueLeak(blocked);assert.equal(rescued.rescued,true);assert.equal(rescued.delivered,true);assert.equal(rescued.done,false);assert.equal(rescued.protection,'precheck');assert.equal(advanceLeak(rescued).done,true);assert.equal(rescueLeak(reachSend('select')).rescued,false);
});
test('ordinary send can finish with a receiver despite an ignored cancellation',()=>{
 const state=advanceLeak(reachSend('none',false));assert.equal(state.selected,'send');assert.equal(state.done,false);assert.equal(expectedOutcome(state),'send');
});
