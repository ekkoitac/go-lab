import {test} from 'node:test';
import assert from 'node:assert/strict';
import {after,back,baseline,defaults,evidence,initial,outcome,step,total} from '../src/components/operations-lab/lesson161/model';
test('161: CPU profile excludes wait and denominator is CPU time, not request time',()=>{
 const t=baseline('waiting');assert.equal(total(t),800);const cpu=evidence(t,'cpu');assert.equal(cpu.reduce((n,r)=>n+r.ms,0),80);assert.equal(cpu[0].ms/80,0.25);assert.equal(cpu[0].ms/total(t),0.025);assert.equal(evidence(t,'trace').reduce((n,r)=>n+r.ms,0),800);
});
test('161: optimizing JSON preserves other segments and saves only five ms in wait case',()=>{
 const b=baseline('waiting'),a=after(defaults);assert.equal(total(a),795);assert.equal(a.wait,b.wait);assert.equal(a.otherCPU,b.otherCPU);assert.equal(outcome(defaults),'small');assert.equal(total(after({...defaults,scenario:'cpu'})),310);
});
test('161: connection intervention requires spare downstream capacity',()=>{
 const valid={...defaults,repair:'connection' as const};assert.equal(total(after(valid)),275);assert.equal(outcome(valid),'large');assert.deepEqual(after({...valid,downstreamSpare:false}),baseline('waiting'));assert.equal(outcome({...valid,downstreamSpare:false}),'small');assert.deepEqual(after({...defaults,repair:'none'}),baseline('waiting'));
});
test('161: prediction precedes reveal, snapshot is copied, rewind returns same state',()=>{
 const s=initial();assert.throws(()=>step(s));assert.throws(()=>step(s,{value:'large',reason:' '}));const p={value:'small' as const,reason:'waiting dominates'};const first=step(s,p);p.reason='mutated';assert.equal(first.prediction?.reason,'waiting dominates');assert.deepEqual(back(first),s);const second=step(first);assert.deepEqual(back(second),first);const third=step(second);assert.equal(step(third),third);assert.equal(s.phase,0);
});
test('161: model rejects invalid scenario and keeps returned configurations isolated',()=>{
 const c={...defaults};const s=initial(c);c.repair='none';assert.equal(s.config.repair,'json');assert.throws(()=>initial({...defaults,scenario:'bad' as 'cpu'}));assert.throws(()=>after({...defaults,repair:'bad' as 'json'}));
});
