import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,back,crashScenario,createTimeline,initial,metrics,nextPhase,transition} from '../src/components/database-lab/lesson135/model';
test('135: direct commit then crash leaves an order but no recoverable event',()=>{
  const result=crashScenario('direct',false);
  assert.equal(result.order,true);assert.equal(result.event,'absent');assert.equal(result.deliveries,0);assert.equal(result.effects,0);assert.equal(nextPhase(result),'idle');
});
test('135: Outbox atomically records order and event, then recovers after commit crash',()=>{
  const start=initial();const committed=transition(start,'step');
  assert.equal(committed.order,true);assert.equal(committed.event,'pending');assert.equal(start.order,false);assert.equal(start.event,'absent');
  const down=transition(committed,'crash');assert.equal(down.event,'pending');assert.equal(transition(down,'step'),down);
  const result=crashScenario('outbox',false);assert.equal(result.deliveries,1);assert.equal(result.effects,1);assert.equal(result.event,'sent');
});
test('135: crash after publish repeats the same event; consumer dedup is a separate protection',()=>{
  const safe=crashScenario('outbox',true,true);assert.equal(safe.deliveries,2);assert.equal(safe.effects,1);assert.equal(safe.skipped,1);assert.equal(safe.consumed,2);assert.deepEqual(safe.processed,['E-1']);
  const unsafe=crashScenario('outbox',true,false);assert.equal(unsafe.deliveries,2);assert.equal(unsafe.effects,2);assert.equal(unsafe.skipped,0);
  const direct=crashScenario('direct',true,true);assert.equal(direct.deliveries,1);assert.equal(direct.effects,1,'broker message survives process crash even when direct send intent does not');
});
test('135: publishing alone does not clear backlog, marking sent is not consumption',()=>{
  let s=transition(initial(),'step');s=transition(s,'wait');s=transition(s,'wait');assert.deepEqual(metrics(s),{backlog:1,oldestAge:2,brokerPending:0});
  s=transition(s,'step');assert.equal(metrics(s).backlog,1);assert.equal(s.effects,0);assert.equal(s.broker.length,1);
  s=transition(s,'step');assert.equal(metrics(s).backlog,0);assert.equal(metrics(s).oldestAge,0);assert.equal(s.effects,0);assert.equal(nextPhase(s),'consume');
});
test('135: repeated relay crashes may produce more than two copies; no exactly-once claim',()=>{
  let s=transition(initial(),'step');for(let i=0;i<4;i++){s=transition(s,'step');s=transition(transition(s,'crash'),'restart');}
  while(nextPhase(s)!=='idle')s=transition(s,'step');
  assert.equal(s.deliveries,5);assert.equal(s.effects,1);assert.equal(s.skipped,4);
});
test('135: prediction reason is required; back restores the complete previous snapshot',()=>{
  const t=createTimeline();assert.equal(apply(t,'step'),t);assert.equal(apply(t,'step',{deliveries:0,effects:0,reason:'   '}),t);
  const stepped=apply(t,'step',{deliveries:1,effects:1,reason:'我以为提交和发送是一个步骤'});assert.equal(stepped.runs[0]?.actual,'commit');assert.equal(stepped.runs[0]?.prediction.deliveries,1);assert.equal(stepped.runs[0]?.actualDeliveries,0);assert.equal(stepped.runs[0]?.actualEffects,0);assert.deepEqual(back(stepped),t);
  const crashed=apply(stepped,'crash');assert.deepEqual(back(crashed),stepped);assert.equal(crashed.states.at(-1)?.running,false);assert.equal(stepped.states.at(-1)?.running,true);
});
test('135: consumer idempotency keeps effect and dedup evidence together',()=>{
  let s=initial();for(let i=0;i<4;i++)s=transition(s,'step');assert.equal(s.effects,1);assert.deepEqual(s.processed,['E-1']);assert.equal(s.broker.length,0);
  const snapshot=JSON.stringify(s);transition(s,'wait');assert.equal(JSON.stringify(s),snapshot,'transition cannot mutate prior snapshots');
});