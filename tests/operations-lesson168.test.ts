import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cancel,defaults,initial,memory,run,step} from '../src/components/operations-lab/lesson168/model';
test('stream copies 10 GiB within a fixed model buffer; file size is not residency',()=>{
 const s=run(defaults);assert.equal(s.status,'done');assert.equal(s.written,10240);assert.equal(s.peak,128);
 const larger=run({...defaults,size:20480});assert.equal(larger.peak,s.peak);assert.equal(larger.written,20480);
});
test('ReadAll retains input and crosses 512 MiB before any output',()=>{
 const s=run({...defaults,strategy:'readall'});assert.equal(s.status,'oom');assert.equal(s.read,640);assert.equal(s.written,0);
 const small=run({...defaults,strategy:'readall',size:256});assert.equal(small.status,'done');assert.equal(small.peak,256);
});
test('memory Writer accumulates even with a bounded copy buffer',()=>{
 const s=run({...defaults,target:'memory'});assert.equal(s.status,'oom');assert.ok(s.written>0);assert.equal(s.peak,defaults.chunk+s.written);
});
test('partial write prevents next read and zero receiver creates observable backpressure',()=>{
 const first=step(defaults,initial());assert.equal(first.read,128);assert.equal(first.pending,128);
 const second=step(defaults,first);assert.equal(second.read,128);assert.equal(second.pending,64);
 const blocked=step({...defaults,rate:0},second);assert.equal(blocked.read,128);assert.equal(blocked.written,64);assert.equal(blocked.event,'blocked');
 const drained=step(defaults,second);assert.equal(drained.pending,0);assert.equal(step(defaults,drained).read,256);
 assert.equal(first.pending,128,'previous snapshot remains available for rewind');
});
test('total-byte policy produces partial failure, not a successful truncated response',()=>{
 const s=run({...defaults,limit:256});assert.equal(s.status,'limited');assert.equal(s.read,256);assert.equal(s.written,256);
 assert.equal(run({...defaults,size:256,limit:256}).status,'done');
});
test('cancelled transfer cannot read or write again; sent bytes remain sent',()=>{
 const s=step(defaults,step(defaults,initial()));const stopped=cancel(s);assert.equal(stopped.status,'cancelled');assert.equal(step(defaults,stopped),stopped);assert.equal(stopped.written,64);
});
test('buffer size affects peak and write steps; oversized buffer can fail before full read',()=>{
 assert.equal(run({...defaults,chunk:32}).peak,32);
 const huge=step({...defaults,chunk:1024},initial());assert.equal(huge.status,'oom');assert.equal(memory({...defaults,chunk:1024},huge),1024);
 assert.equal(run({...defaults,size:300,chunk:128}).written,300,'last short block preserves exact byte count');
});

