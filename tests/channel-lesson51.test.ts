import {test} from 'node:test';
import assert from 'node:assert/strict';
import {available51,deadlocked51,initial51,step51} from '../src/components/channel-lessons/model51';

test('unbuffered sender waits without placing value into storage; receiver completes handoff',()=>{
  const initial=initial51();const waiting=step51(initial,'send');
  assert.equal(waiting.sender,'waiting');assert.equal(waiting.receiver,'ready');assert.equal(waiting.outcome,'waiting');
  const received=step51(waiting,'receive');assert.equal(received.sender,'sent');assert.equal(received.receiver,'processing');assert.equal(received.confirmation,'unchecked');
  assert.equal(initial.sender,'ready');assert.equal(available51(received,'send'),false);
});
test('receiver may arrive first and also waits until sender arrives',()=>{
  const waiting=step51(initial51(),'receive');assert.equal(waiting.receiver,'waiting');
  const handoff=step51(waiting,'send');assert.equal(handoff.outcome,'handoff');assert.equal(handoff.receiver,'processing');
});
test('same goroutine send blocks subsequent receive and constitutes deadlock in closed model',()=>{
  const s=step51(initial51('same'),'send');assert.equal(deadlocked51(s),true);
  assert.equal(available51(s,'receive'),false);assert.equal(step51(s,'receive').sender,'waiting');
  assert.equal(step51(s,'receive').outcome,'blocked');
});
test('waiting for done after handoff stays blocked until processing; closed done can also be observed later',()=>{
  const handoff=step51(step51(initial51(),'send'),'receive');
  const waiter=step51(handoff,'waitDone');assert.equal(waiter.confirmation,'waiting');assert.equal(waiter.receiver,'processing');
  const end=step51(waiter,'process');assert.equal(end.confirmation,'confirmed');assert.equal(end.receiver,'done');
  const done=step51(handoff,'process');assert.equal(done.confirmation,'unchecked');assert.equal(step51(done,'waitDone').outcome,'confirmed');
});
test('business cannot run before receipt and completed communication cannot repeat',()=>{
  assert.equal(step51(initial51(),'process').outcome,'blocked');
  const s=step51(step51(initial51(),'receive'),'send');
  assert.equal(available51(s,'receive'),false);assert.equal(available51(s,'send'),false);
});
