import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeProgressSnapshots} from '../src/progress-snapshots';
import {Store} from '../server/store';
import {emptyProgress} from '../src/learning';
test('迟到单课与首屏快照不覆盖更新的步骤和求助记录',()=>{
 const old={...emptyProgress(101),updatedAt:'2026-01-01T00:00:00.001Z'};
 const fresh={...old,step:5,helpUsed:['diagram'],updatedAt:'2026-01-01T00:00:00.002Z'};
 assert.deepEqual(mergeProgressSnapshots({101:fresh},[old])[101],fresh);
 const initial=mergeProgressSnapshots({101:fresh},[old,emptyProgress(1)]);
 assert.deepEqual(initial[101],fresh);assert.equal(initial[1].lessonId,1);
 assert.deepEqual(mergeProgressSnapshots({101:old},[fresh])[101],fresh);
});
test('连续保存有严格递增时间戳，仍可用旧schema备份恢复',()=>{
 const store=new Store(':memory:');try{
  let previous='';for(let i=0;i<100;i++){const p=store.save({...emptyProgress(101),step:i%6});assert.ok(p.updatedAt>previous);previous=p.updatedAt;}
  store.restore([{...emptyProgress(101),step:4,updatedAt:'2020-01-01T00:00:00.000Z'}]);
  assert.ok(store.get(101).updatedAt>previous);assert.equal(store.get(101).step,4);assert.equal(store.backup().schemaVersion,1);
 }finally{store.close();}
});
