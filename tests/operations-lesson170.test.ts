import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,gates,initial,metrics,run,step,theoretical,verdict} from '../src/components/operations-lab/lesson170/model';

test('local time reduction uses Amdahl share, not a global 30 percent improvement',()=>{
 const t=theoretical(defaults);assert.equal(t.localBefore,5);assert.equal(t.localAfter,3.5);assert.equal(t.after,98.5);assert.equal(t.saved,1.5);assert.equal(t.speedGain,1.52);
 assert.equal(theoretical({...defaults,share:90}).saved,27);
 assert.equal(theoretical({...defaults,reduction:0}).after,100);
});
test('three paired samples precede review and retain immutable rewind snapshots',()=>{
 const start=initial(),one=step(defaults,start),two=step(defaults,one),three=step(defaults,two),review=step(defaults,three);
 assert.equal(start.samples.length,0);assert.equal(one.samples.length,1);assert.equal(two.samples.length,2);assert.equal(three.reviewed,false);assert.equal(review.reviewed,true);assert.equal(step(defaults,review),review);
 assert.equal(metrics(defaults,review).before,100);assert.equal(metrics(defaults,review).after,98.5);assert.equal(metrics(defaults,review).saved,1.5);
});
test('default local benefit fails independent memory and p99 release gates',()=>{
 const s=run(defaults),failed=gates(defaults,s).filter(g=>!g.pass).map(g=>g.key);
 assert.deepEqual(failed,['memory','p99']);assert.equal(metrics(defaults,s).memory,576);assert.equal(metrics(defaults,s).p99,133.5);assert.match(verdict(defaults,s),/暂停发布/);
});
test('changing load or CPU creates apparent benefit but invalidates attribution',()=>{
 for(const comparison of ['load','cpu'] as const){const c={...defaults,memoryExtra:0,tailExtra:0,comparison},s=run(c);assert.ok(metrics(c,s).saved>1.5);assert.deepEqual(gates(c,s).filter(g=>!g.pass).map(g=>g.key),['conditions']);assert.match(verdict(c,s),/暂停发布/);}
});
test('repair must satisfy all gates, including correctness and enough samples',()=>{
 const c={...defaults,memoryExtra:128,tailExtra:10};assert.ok(gates(c,run(c)).every(g=>g.pass));assert.match(verdict(c,run(c)),/教学门槛通过/);
 const wrong={...c,correct:false};assert.deepEqual(gates(wrong,run(wrong)).filter(g=>!g.pass).map(g=>g.key),['correctness']);
 assert.equal(gates(c,step(c,initial())).find(g=>g.key==='samples')?.pass,false);
 const tiny={...c,reduction:10};assert.equal(gates(tiny,run(tiny)).find(g=>g.key==='benefit')?.pass,false);
});
test('memory and p99 thresholds include boundaries independently of improvement',()=>{
 const exact={...defaults,memoryExtra:256,tailExtra:21.5};assert.ok(gates(exact,run(exact)).every(g=>g.pass));
 const memory={...exact,memoryExtra:257};assert.equal(gates(memory,run(memory)).find(g=>g.key==='memory')?.pass,false);
 const tail={...exact,tailExtra:21.6};assert.equal(gates(tail,run(tail)).find(g=>g.key==='p99')?.pass,false);
});
