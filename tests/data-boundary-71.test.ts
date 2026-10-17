import test from 'node:test';
import assert from 'node:assert/strict';
import {initialFields,decide,snapshot,codeLine,matchesKeys,repairedOrderContract} from '../src/components/data-boundary-lab/lesson71/model';
test('71 tag does not export fields; dash excludes nonempty values',()=>{
 const fields=initialFields();assert.equal(decide(fields[0]).included,false);assert.equal(decide(fields[1]).included,false);
 assert.deepEqual(snapshot(fields,3).output,{});
 fields[0].exported=true;assert.deepEqual(snapshot(fields,3).output,{status:'paid'});
 fields[0].tag='';assert.deepEqual(snapshot(fields,3).output,{Status:'paid'});
});
test('71 omitempty covers empty string only in the finite string model',()=>{
 const f=initialFields()[2];assert.equal(decide(f).included,false);f.value='0';assert.equal(decide(f).included,true);
 f.value='';f.omit=false;assert.deepEqual(snapshot([f],1).output,{note:''});f.tag='-';assert.equal(decide(f).included,false);
});
test('71 pure snapshots support reset, rewind, replay and do not mutate input',()=>{
 const f=initialFields();f[0].exported=true;const before=structuredClone(f),final=snapshot(f,3);
 assert.deepEqual(snapshot(f,0).output,{});assert.equal(snapshot(f,2).done,false);assert.deepEqual(snapshot(f,3),final);assert.deepEqual(f,before);
 f[0].exported=false;assert.deepEqual(snapshot(f,0).output,{});assert.deepEqual(snapshot(f,3).output,{});
 assert.equal(snapshot(f,-1).cursor,0);assert.equal(snapshot(f,9).cursor,3);
});
test('71 code and prediction reflect the same external contract',()=>{
 const f=initialFields()[0];assert.match(codeLine(f),/^status string/);assert.match(codeLine(f),/json:"status"/);
 assert.equal(matchesKeys('无',{}),true);assert.equal(matchesKeys('note，status',{status:'paid',note:''}),true);assert.equal(matchesKeys('Status',{status:'paid'}),false);
});

test('71 repair requires durable token exclusion, not a coincidentally empty sample',()=>{
 const fields=initialFields();fields[0].exported=true;fields[0].value='shipped';fields[2].omit=false;
 assert.equal(repairedOrderContract(fields),true);
 fields[1].tag='external';fields[1].omit=true;fields[1].value='';
 assert.deepEqual(snapshot(fields,3).output,{status:'shipped',note:''});
 assert.equal(repairedOrderContract(fields),false);
 fields[1].tag='-';fields[1].value='nonempty-secret';assert.equal(repairedOrderContract(fields),true);
});
