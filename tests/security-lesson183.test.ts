import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,trace,result,sequence,orderFeedback,partners} from '../src/components/security-lab/lesson183/model';
test('183: initial resolution does not constrain later DNS dialing',()=>{
 const unsafe=trace({...defaults,scenario:'dns'});
 assert.equal(unsafe[1].connections.length,0);assert.equal(unsafe[1].resolved,'合作方公网 P');
 assert.equal(unsafe.at(-1)!.outcome,'internal');assert.deepEqual(unsafe.at(-1)!.connections,['内网 I']);
 const safe=trace({...defaults,scenario:'dns',egress:true});assert.equal(safe.at(-1)!.outcome,'blocked');assert.deepEqual(safe.at(-1)!.connections,[]);
 assert.equal(result({...defaults,scenario:'dns',redirects:'disabled'}),'internal');
});
test('183: redirect policy and actual egress independently prevent second-hop connection',()=>{
 assert.deepEqual(trace(defaults).at(-1)!.connections,['合作方公网 P','内网 I']);
 for(const config of [{...defaults,egress:true},{...defaults,redirects:'each' as const},{...defaults,redirects:'disabled' as const}]) {
  const frames=trace(config);assert.equal(frames.at(-1)!.outcome,'blocked');assert.deepEqual(frames.at(-1)!.connections,['合作方公网 P']);
  assert.equal(frames.find(f=>f.stage==='收到重定向')!.outcome,'pending');
 }
});
test('183: byte and deadline limits are independent, inclusive, and bound consumption',()=>{
 for(const bytes of [1,4,5,12])for(const seconds of [1,3,4,6]){
  const config={...defaults,scenario:'large' as const,limits:true,bytes,seconds};const end=trace(config).at(-1)!;
  assert.equal(end.outcome,bytes>4||seconds>3?'limited':'completed');assert.ok(end.bytes<=4);assert.ok(end.seconds<=3);
  assert.equal(result({...config,limits:false}),'completed');
 }
 assert.equal(trace({...defaults,scenario:'normal',limits:true}).at(-1)!.bytes,2);
});
test('183: fixed partner mapping and immutable traces support reset and rewind',()=>{
 const original={...defaults};const first=trace(original);const copy=structuredClone(first);
 trace({...original,partner:'cedar',egress:true});assert.deepEqual(first,copy);assert.deepEqual(original,defaults);
 for(const partner of Object.keys(partners) as (keyof typeof partners)[])assert.equal(trace({...defaults,partner})[0].host,partners[partner]);
 assert.notEqual(first[0].connections,first[1].connections);assert.deepEqual(trace(original),first);
});
test('183: sequence feedback identifies check versus dial and TLS ordering',()=>{
 assert.match(orderFeedback(sequence),/顺序成立/);
 assert.match(orderFeedback([sequence[0],sequence[2],sequence[1],...sequence.slice(3)]),/先拿到解析结果/);
 assert.match(orderFeedback([sequence[0],sequence[1],sequence[3],sequence[2],...sequence.slice(4)]),/TLS/);
 assert.match(orderFeedback(sequence.slice(1)),/缺少/);
});
