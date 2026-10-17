import test from 'node:test';
import assert from 'node:assert/strict';
import {drawing} from '../src/components/sync-lab/diagrams';
import {initial,transition,type Action} from '../src/components/sync-lab/model';
import {replay,routeFor} from '../src/components/sync-lab/guides';
test('lock identity diagram converges shared references on one object only in pointer mode',()=>{
 const copied=drawing(initial(45)),shared=drawing(initial(45,true));
 assert.equal(copied.nodes.filter(n=>n.shape==='lock').length,2);
 assert.equal(shared.nodes.filter(n=>n.shape==='lock').length,1);
 assert.deepEqual(shared.edges.filter(e=>['a','b'].includes(e.from)).map(e=>e.to),['lock','lock']);
});
test('wait diagram has directed alternating task-resource cycle only after both blocking requests',()=>{
 const before=['a','b'].reduce((s,a)=>transition(s,a as Action),initial(46));
 assert.equal(drawing(before).edges.filter(e=>e.wait).length,0);
 const after=transition(transition(before,'a'),'b'),edges=drawing(after).edges;
 for(const [from,to] of [['t0','l1'],['l1','t1'],['t1','l0'],['l0','t0']])assert.ok(edges.some(e=>e.from===from&&e.to===to));
 assert.equal(drawing(initial(47)).edges.filter(e=>e.wait).length,0);
 assert.equal(drawing(transition(transition(initial(47),'a'),'a')).edges.filter(e=>e.wait).length,2);
});
test('Once bypass exits the whole once body in broken scope and enters outside business in corrected scope',()=>{
 for(const fixed of [false,true]){
  const state=replay(49,fixed,2,routeFor(49,fixed,2)).at(-1)!,graph=drawing(state);
  const bypass=graph.edges.find(e=>e.from==='request'&&e.to!=='init')!;
  assert.equal(bypass.to,fixed?'business':'end');
  const business=graph.nodes.find(n=>n.id==='business')!,scope=graph.marks.find(m=>m.outline)!;
  assert.equal(business.y<scope.y+scope.h,!fixed);
 }
});
test('all graph edges resolve to unique visible objects throughout both paths',()=>{
 for(let id=41;id<=50;id++)for(const fixed of [false,true])for(const state of replay(id,fixed,2,routeFor(id,fixed,2))){
  const graph=drawing(state),ids=graph.nodes.map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
  graph.edges.forEach(e=>{assert.ok(ids.includes(e.from));assert.ok(ids.includes(e.to));});
  assert.ok(graph.nodes.length);assert.ok(graph.title&&graph.description);
 }
});

