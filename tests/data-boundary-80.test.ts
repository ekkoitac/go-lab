import assert from 'node:assert/strict';
import {test} from 'node:test';
import {escapeHTML,evaluate,snapshot} from '../src/components/data-boundary-lab/lesson80/model';
test('80 HTML text escaping matches html/template replacement table including plus and NUL',()=>{
 assert.equal(escapeHTML('<script>"a" & \'b\'+\0</script>'),'&lt;script&gt;&#34;a&#34; &amp; &#39;b&#39;&#43;\uFFFD&lt;/script&gt;');
 assert.equal(escapeHTML('&lt;'),'&amp;lt;');assert.equal(escapeHTML('你好 / café'),'你好 / café');
 const safe=evaluate('html','context','<script>x</script>');assert.equal(safe.output,'<p>&lt;script&gt;x&lt;/script&gt;</p>');assert.equal(safe.outcome,'data');
 const raw=evaluate('html','raw','plain');assert.equal(raw.outcome,'unencoded');assert.equal(raw.output,'<p>plain</p>');
});
test('80 structured log preserves exact input in one record while raw newline makes physical lines',()=>{
 for(const input of ['alice\nrole=owner','a\r\n"x"\\\t', '', '中文\u2028名字']){
 const r=evaluate('log','context',input);assert.deepEqual(JSON.parse(r.output),{user:input});assert.equal(r.output.split('\n').length,1);assert.equal(r.cells.length,1);
 }
 assert.equal(evaluate('log','raw','alice\nrole=owner').cells.length,2);
});
test('80 argv retains spaces and shell characters without claiming application options are safe',()=>{
 for(const input of ['file.txt; echo x','$(whoami)', 'a b.txt','']){
 const r=evaluate('command','context',input);assert.deepEqual(JSON.parse(r.output),['viewer',input]);assert.equal(r.cells.length,2);assert.equal(r.outcome,'data');
 }
 assert.equal(evaluate('command','context','--delete-all').outcome,'option');assert.equal(evaluate('command','raw','file; echo x').cells.length,1);assert.equal(evaluate('command','raw','file; echo x').outcome,'unencoded');
});
test('80 stages hide result before execution and rewind deterministically',()=>{
 const args=['html','context','<b>x</b>'] as const;assert.equal(snapshot(...args,0).output,null);assert.deepEqual(snapshot(...args,1).cells,[]);assert.equal(snapshot(...args,2).outcome,null);
 const final=snapshot(...args,3);snapshot(...args,2);assert.deepEqual(snapshot(...args,3),final);assert.equal(snapshot(...args,0).outcome,null);assert.equal(snapshot('log','raw','new',0).output,null);
});
