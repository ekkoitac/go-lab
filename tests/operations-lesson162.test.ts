import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,next,run,quantile,mean,histogram,bucketForRank,fanoutRisk} from '../src/components/operations-lab/lesson162/model';
test('nearest-rank P99 of 99 fast and one slow request is still fast',()=>{
 const s=run({slowCount:1});assert.equal(s.samples.length,100);assert.equal(s.p99,20);assert.equal(s.rank,99);assert.equal(mean(s.samples),39.8);assert.equal(Math.max(...s.samples),2000);
});
test('fixed mean can hide a P99 change when the 99th rank crosses into the tail',()=>{
 const one=run({slowCount:1});const two=run({slowCount:2});assert.equal(mean(one.samples),mean(two.samples));assert.equal(two.p99,1010);assert.deepEqual(bucketForRank(two.buckets),{lower:1000,upper:2000});assert.equal(two.samples.filter(v=>v===20).length,98);
});
test('local quantiles cannot be averaged, including request-weighted averages',()=>{
 const s=run({scenario:'aggregate',aCount:900});assert.equal(s.p99,20);assert.equal(s.samples.length,1000);assert.equal(quantile(s.groups[0].samples),20);assert.equal(quantile(s.groups[1].samples),2000);assert.equal(mean(s.groups.map(g=>quantile(g.samples)!)),1010);
 const weighted=s.groups.reduce((sum,g)=>sum+quantile(g.samples)!*g.samples.length,0)/s.samples.length;assert.equal(weighted,218);assert.notEqual(weighted,s.p99);
});
test('changing only fast-instance traffic changes global tail share',()=>{
 const large=run({scenario:'aggregate',aCount:900});const small=run({scenario:'aggregate',aCount:50});assert.deepEqual(small.groups[1],large.groups[1]);assert.equal(small.p99,2000);assert.equal(small.rank,149);assert.equal(large.p99,20);
});
test('same-boundary histogram aggregation preserves all samples and gives an interval',()=>{
 for(const aCount of [50,100,900]){const s=run({scenario:'aggregate',aCount});assert.deepEqual(s.buckets,histogram(s.samples));assert.equal(s.buckets.reduce((a,b)=>a+b,0),s.samples.length);const interval=bucketForRank(s.buckets)!;assert.ok(s.p99!>interval.lower&&s.p99!<=interval.upper)}
 assert.equal(bucketForRank([0,0,0,0,0,0]),null);assert.equal(quantile([]),null);
});
test('pipeline reveals results in order and preserves snapshots for rewind',()=>{
 const start=initial();const collected=next(start);const merged=next(collected);const ranked=next(merged);const traced=next(ranked);
 assert.equal(start.groups.length,0);assert.equal(collected.groups.length,1);assert.equal(collected.samples.length,0);assert.equal(merged.p99,null);assert.equal(ranked.p99,1010);assert.equal(traced.step,4);assert.equal(next(traced),traced);assert.equal(start.step,0);assert.equal(collected.step,1);assert.match(traced.message,/排队 990ms/);
});
test('small sample and exact rank boundaries are explicit',()=>{assert.equal(quantile([20,2000]),2000);assert.equal(run({scenario:'aggregate',aCount:100}).p99,20);assert.throws(()=>quantile([1],0),RangeError)});
test('independent fanout risk increases with required child calls',()=>{assert.ok(Math.abs(fanoutRisk(.01,1)-.01)<1e-12);assert.ok(fanoutRisk(.01,100)>.63);assert.ok(fanoutRisk(.01,100)<.64);assert.equal(fanoutRisk(0,100),0);assert.equal(fanoutRisk(1,1),1)});
