import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,preset,step,trace,unsafePath,verdict,type Input} from '../src/components/security-lab/lesson184/model';

test('184 unknown length does not approve; strict reader consumes the extra byte and returns nothing',()=>{
  const c=preset('over'),states=trace(c,'probe');
  assert.equal(states[1].phase,'read');assert.equal(states[1].read,0);
  const atN=states.find(s=>s.read===4)!;
  assert.equal(atN.result,'pending');
  const final=states.at(-1)!;
  assert.equal(final.read,5);assert.equal(final.result,'rejected');assert.equal(final.returned,0);
});
test('184 N-only reader reports success on a truncated stream without consuming N+1',()=>{
  const c=preset('over'),final=trace(c,'n').at(-1)!;
  assert.equal(final.read,4);assert.equal(final.returned,4);assert.equal(final.result,'accepted');
  assert.equal(verdict(final,c),'接受了截断内容');
});
test('184 equal limit requires real EOF probe and is accepted unchanged',()=>{
  const c=preset('exact'),states=trace(c,'probe'),last=states.at(-1)!;
  assert.equal(states.at(-2)!.result,'pending');assert.equal(states.at(-2)!.read,4);
  assert.equal(last.read,4);assert.equal(last.returned,4);assert.equal(last.result,'accepted');
  assert.match(last.note,/真实 EOF/);
});
test('184 zero boundary accepts empty and rejects one byte',()=>{
  for(const bytes of [0,1]){
    const c={...preset('over'),bytes,limit:0},last=trace(c,'probe').at(-1)!;
    assert.equal(last.result,bytes===0?'accepted':'rejected');assert.equal(last.read,bytes);
  }
});
test('184 declared length is only a precheck; small claims cannot suppress actual overflow',()=>{
  const low=trace({...preset('over'),declared:1},'probe').at(-1)!;
  assert.equal(low.result,'rejected');assert.equal(low.read,5);
  const high=trace({...preset('exact'),declared:6},'probe').at(-1)!;
  assert.equal(high.result,'rejected');assert.equal(high.read,0);
});
test('184 actual decoded bytes use an independent budget and stop at its first extra byte',()=>{
  const c=preset('bomb'),last=trace(c,'probe').at(-1)!;
  assert.equal(last.read,2);assert.equal(last.expanded,9);assert.equal(last.result,'rejected');
  assert.equal(trace({...c,limit:12},'probe').at(-1)!.result,'rejected');
  const repaired=trace({...c,expandedLimit:10},'probe').at(-1)!;
  assert.equal(repaired.expanded,10);assert.equal(repaired.result,'accepted');
});
test('184 upload rejection never starts decompression',()=>{
  const last=trace({...preset('bomb'),limit:1},'probe').at(-1)!;
  assert.equal(last.read,2);assert.equal(last.expanded,0);assert.equal(last.inspected,0);
});
test('184 entry budget is independent of total bytes and blocks before third entry output',()=>{
  const c=preset('entries'),last=trace(c,'probe').at(-1)!;
  assert.equal(last.inspected,3);assert.equal(last.expanded,2);assert.equal(last.result,'rejected');
  assert.equal(trace({...c,entryLimit:3},'probe').at(-1)!.result,'accepted');
});
test('184 unsafe paths and links are rejected before output despite generous byte budgets',()=>{
  for(const name of ['../x','a/../x','a\\..\\x','/etc/a','C:\\a','\\\\server\\x','']){
    assert.equal(unsafePath(name),true,name);
    const c:Input={...preset('bomb'),archive:[{name,bytes:1}]};
    const last=trace(c,'probe').at(-1)!;assert.equal(last.result,'rejected');assert.equal(last.expanded,0);
  }
  assert.equal(unsafePath('folder/a.txt'),false);
  const linked=trace(preset('link'),'probe').at(-1)!;assert.equal(linked.result,'rejected');assert.equal(linked.expanded,0);
});
test('184 transition is immutable, replay deterministic, terminal states stable',()=>{
  const c=preset('over'),start=initial(),copy=structuredClone(start),next=step(start,c,'probe');
  assert.deepEqual(start,copy);assert.notEqual(next,start);
  assert.deepEqual(trace(c,'probe'),trace(c,'probe'));
  const final=trace(c,'probe').at(-1)!;assert.equal(step(final,c,'probe'),final);
});
test('184 invalid budgets are rejected before resource use',()=>{
  for(const limit of [-1,1.5,Infinity,Number.MAX_SAFE_INTEGER]){
    const last=trace({...preset('over'),limit},'probe').at(-1)!;
    assert.equal(last.result,'rejected');assert.equal(last.read,0);
  }
});


test('184 a truncated compressed payload is never treated as a complete archive',()=>{
  const last=trace({...preset('bomb'),limit:1},'n').at(-1)!;
  assert.equal(last.result,'rejected');assert.equal(last.read,1);assert.equal(last.expanded,0);
});
