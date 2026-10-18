import test from 'node:test';
import assert from 'node:assert/strict';
import {baseline,buildChain,codeLines,inspect,searchTrace,type Config} from '../src/components/control-flow-lab/lesson38/model';
test('38 identical displayed text can have different reachability with %w versus %v',()=>{
  const a={...baseline,layers:[{context:'order',format:'v' as const}]};
  const b={...a,layers:[{context:'order',format:'w' as const}]};
  assert.equal(buildChain(a).at(-1)!.message,buildChain(b).at(-1)!.message);
  assert.equal(inspect(a,'is',99).found,false);assert.equal(inspect(b,'is',99).found,true);
});
test('38 a middle %v stops outer unwrap and cannot be repaired by an outer %w',()=>{
  const c:Config={...baseline,layers:[{context:'inner',format:'w'},{context:'middle',format:'v'},{context:'outer',format:'w'}]};
  assert.deepEqual(searchTrace(c,'is').map(t=>t.nodeId),['wrap-2','wrap-1']);
  assert.equal(inspect(c,'is',99).found,false);
  assert.equal(buildChain(c).find(n=>n.id==='root')!.message,'no stock');
});
test('38 equal message from a new error does not match the original identity',()=>{
  const c:Config={...baseline,target:'twin',layers:[{context:'order',format:'w'}]};
  assert.deepEqual(searchTrace(c,'is').map(t=>t.nodeId),['wrap-0','root']);
  assert.equal(inspect(c,'is',99).found,false);
});
test('38 As extracts structured fields through wrappers while Is can fail for different target',()=>{
  const c:Config={...baseline,rootKind:'stock',target:'twin',layers:[{context:'inner',format:'w'},{context:'outer',format:'w'}]};
  assert.equal(inspect(c,'is',99).found,false);
  assert.deepEqual(inspect(c,'as',99).extracted,{sku:'book-7',missing:2});
  assert.equal(inspect({...c,rootKind:'sentinel'},'as',99).found,false);
});
test('38 unfinished search does not reveal result and rewind reproduces visited path',()=>{
  const c:Config={...baseline,layers:[{context:'a',format:'w'},{context:'b',format:'w'}]};
  const first=inspect(c,'is',1);assert.equal(first.found,null);assert.deepEqual(first.visited,['wrap-1']);
  inspect(c,'is',99);assert.deepEqual(inspect(c,'is',1),first);
  assert.deepEqual(inspect(c,'is',0).visited,[]);assert.equal(inspect(c,'is',3).found,true);
});
test('38 context text is data even when it contains percent signs',()=>{
  const c:Config={...baseline,layers:[{context:'order %w',format:'w'}]};
  assert.equal(buildChain(c).at(-1)!.message,'order %w: no stock');
  assert.ok(codeLines(c,'is').includes('err = fmt.Errorf("%s: %w", "order %w", err)'));
  assert.throws(()=>buildChain({...c,layers:[]}),RangeError);
});
