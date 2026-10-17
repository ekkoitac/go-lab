import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance,initial,outcome,rss,runRounds,type Config} from '../src/components/operations-lab/lesson163/model';

test('163 GC collects temporary objects while resident pages and RSS stay unchanged',()=>{
  const c:Config={workload:'churn',allocation:300};
  const loaded=advance(initial(),c,'load');
  assert.equal(loaded.garbage,300);assert.equal(loaded.idle,300);
  const collected=advance(loaded,c,'gc');
  assert.equal(collected.live,200);assert.equal(collected.garbage,0);assert.equal(collected.idle,600);
  assert.equal(rss(collected),rss(loaded));assert.equal(rss(collected),900);
  assert.equal(runRounds(c,5).allocated,1500);assert.equal(runRounds(c,5).live,200);
});
test('163 retained Go references survive repeated GC even when RSS stays flat',()=>{
  const c:Config={workload:'retained',allocation:300};const s=runRounds(c);
  assert.deepEqual(s.samples.map(x=>x.live),[200,260,320,380]);
  assert.deepEqual(s.samples.map(x=>x.rss),[900,900,900,900]);
  assert.equal(advance(s,c,'gc').live,380);assert.equal(outcome(c),'heap');
});
test('163 cgo and stack growth are independent of Go live heap and GC',()=>{
  const native=runRounds({workload:'native',allocation:450});
  assert.equal(native.live,200);assert.equal(native.native,160);assert.equal(rss(native),1020);
  const stacks=runRounds({workload:'stacks',allocation:450});
  assert.equal(stacks.live,200);assert.equal(stacks.stacks,100);assert.equal(stacks.goroutines,500);
  assert.equal(rss(stacks),960);
});
test('163 page return only removes idle residency; next request can reacquire pages',()=>{
  const c:Config={workload:'retained',allocation:300};const s=runRounds(c);
  const released=advance(s,c,'release');assert.equal(released.idle,0);
  assert.equal(rss(released),rss(s)-s.idle);assert.equal(released.live,s.live);
  assert.equal(released.stacks,s.stacks);assert.equal(released.native,s.native);
  const loaded=advance(released,c,'load');assert.equal(rss(loaded),rss(released)+300);
  const collected=advance(loaded,c,'gc');assert.equal(rss(collected),rss(loaded));
});
test('163 sampling occurs after GC, input snapshots are not mutated and replay is deterministic',()=>{
  const c:Config={workload:'native',allocation:300};const s=initial(), copy=structuredClone(s);
  const loaded=advance(s,c,'load');assert.equal(loaded.samples.length,1);
  assert.equal(advance(loaded,c,'load'),loaded);
  const collected=advance(loaded,c,'gc');assert.equal(collected.samples.length,2);
  assert.equal(advance(collected,c,'gc').samples.length,2);
  assert.deepEqual(s,copy);assert.deepEqual(advance(s,c,'load'),loaded);
});
