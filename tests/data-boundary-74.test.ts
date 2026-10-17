import test from 'node:test';
import assert from 'node:assert/strict';
import {finalFrame,scanValue,trace,presets} from '../src/components/data-boundary-lab/lesson74/model';
test('74 independent unknown-field and single-document rules',()=>{
 assert.equal(finalFrame({input:presets[0].input,unknown:true,second:false}).outcome,'accept');
 assert.equal(finalFrame({input:presets[0].input,unknown:false,second:true}).outcome,'reject');
 assert.equal(finalFrame({input:presets[2].input,unknown:false,second:true}).outcome,'accept');
 assert.equal(finalFrame({input:presets[2].input,unknown:true,second:false}).first,'unknown field');
});
test('74 streaming boundaries support null, scalar, nested strings and whitespace',()=>{
 for(const tail of ['null','42','true','"x"','[1,2]','{"n":2}']){
  const f=finalFrame({input:'{"n":1} '+tail,unknown:true,second:true});assert.equal(f.second,'nil');assert.equal(f.outcome,'reject');
 }
 const input=' {"n":1}  \n';const f=finalFrame({input,unknown:true,second:true});assert.equal(f.second,'io.EOF');assert.equal(f.cursor,8);assert.equal(f.outcome,'accept');
 const nested='{"a":[{"x":"} \\\" ["},null]}true';const a=scanValue(nested);assert.equal(a.kind,'value');if(a.kind==='value')assert.equal(nested.slice(a.end),'true');
});
test('74 invalid first and invalid trailing values stop independently',()=>{
 for(const input of ['{"n":}','{"n":1','{"n":1,}','[1,]','"unterminated','1e','truex']){
  const f=finalFrame({input,unknown:true,second:true});assert.equal(f.outcome,'reject');
 }
 const bad=finalFrame({input:'{"n":1} garbage',unknown:false,second:true});assert.equal(bad.first,'nil');assert.equal(bad.second,'SyntaxError');assert.equal(bad.cursor,7);
 assert.equal(finalFrame({input:'{"n":1} garbage',unknown:true,second:false}).outcome,'accept');
 assert.equal(finalFrame({input:' \n',unknown:true,second:true}).first,'io.EOF');
});
test('74 trace is pure and supports deterministic replay and reset',()=>{
 const config={input:presets[0].input,unknown:true,second:true};const a=trace(config);assert.equal(a[0].cursor,0);assert.equal(a[1].cursor,7);assert.equal(a[1].outcome,'pending');assert.equal(a[2].cursor,15);assert.deepEqual(trace(config),a);
 const altered=trace({...config,input:presets[1].input});assert.equal(altered[0].first,'尚未调用');assert.equal(altered.at(-1)?.outcome,'accept');assert.equal(config.input,presets[0].input);
});
