import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,defaults,initial,inspect,memoryMB,step,verdict} from '../src/components/cache-message-lab/lesson141/model';
test('141: invalidating writer local memory leaves B stale beyond five-second deadline',()=>{
  const s=inspect(defaults,5);assert.equal(s.database,120);assert.equal(s.reads[0].price,120);assert.equal(s.reads[1].price,100);assert.equal(s.reads[2].time,6);assert.equal(verdict(s),'stale');assert.equal(s.b?.expires,60);
  assert.equal(inspect(defaults,6).checkout,120);assert.equal(inspect(defaults,7).lastRead?.price,120);
});
test('141: shared invalidation makes both instances observe one refreshed entry',()=>{
  const s=inspect({...defaults,scheme:'shared'},5);assert.deepEqual(s.reads.map(r=>r.price),[120,120,120]);assert.equal(s.a,null);assert.equal(s.b,null);assert.equal(s.networkReads,3);assert.equal(s.databaseReads,1);
  const failed=inspect({...defaults,scheme:'shared',invalidateShared:false},5);assert.equal(verdict(failed),'stale');assert.equal(failed.databaseReads,0);
});
test('141: missed L1 broadcast is repaired by expiry only when lower layer is fresh',()=>{
  assert.equal(verdict(inspect({...defaults,scheme:'layered',ttl:60},5)),'stale');
  assert.equal(verdict(inspect({...defaults,scheme:'layered',ttl:3},5)),'fresh');
  const stale=inspect({...defaults,scheme:'layered',ttl:3,invalidateShared:false},5);
  assert.equal(verdict(stale),'stale');assert.equal(stale.b?.expires,9);assert.equal(stale.lastRead?.price,100);assert.equal(stale.databaseReads,0);
});
test('141: expired means expires <= now; complete broadcast works before long TTL expires',()=>{
  const short=inspect({...defaults,ttl:3},4);assert.equal(short.lastRead?.time,3);assert.equal(short.lastRead?.price,120);assert.equal(short.b?.expires,6);
  const broadcast=inspect({...defaults,scheme:'layered',broadcast:true},4);assert.equal(broadcast.lastRead?.price,120);assert.equal(broadcast.b?.expires,63);
});
test('141: immutable version key is a counterexample to requiring frequent invalidation',()=>{
  const s=inspect({...defaults,immutable:true},5);assert.equal(s.database,100);assert.equal(verdict(s),'fresh');assert.equal(s.databaseReads,0);
  assert.equal(memoryMB({...defaults,instances:100}),20000);assert.equal(memoryMB({...defaults,scheme:'shared'}),0);
});
test('141: prediction required, copying and rewind preserve deterministic state',()=>{
  const start=initial();assert.throws(()=>step(start));assert.throws(()=>step(start,{value:'stale',reason:' '}));
  const prediction={value:'stale' as const,reason:'B has independent memory'};const first=step(start,prediction);prediction.reason='modified';assert.equal(first.prediction?.reason,'B has independent memory');assert.deepEqual(back(first),start);
  const second=step(first);assert.deepEqual(back(second),first);assert.equal(start.phase,0);assert.deepEqual(inspect(defaults,5),inspect(defaults,5));
});
test('141: invalid configurations and phases cannot silently change semantics',()=>{
  for(const ttl of [0,5,NaN])assert.throws(()=>initial({...defaults,ttl}));
  assert.throws(()=>inspect(defaults,-1));assert.throws(()=>inspect(defaults,8));assert.throws(()=>memoryMB({...defaults,instances:0}));
});
