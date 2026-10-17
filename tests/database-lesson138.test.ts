import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance,initial,readOld,readNew,record,safePath,type Action} from '../src/components/database-lab/lesson138/model';
const run=(path:Action[])=>path.reduce((s,a)=>advance(s,a),initial());
test('138: expand keeps old app serving; trigger explicitly covers old writes',()=>{
 let s=run(['expand','oldWrite']);assert.equal(s.oldValue,'旧版更新');assert.equal(s.newValue,null);assert.equal(readOld(s),'旧版更新');
 s=advance(s,'compat');s=advance(s,'oldWrite');assert.equal(s.newValue,'旧版更新');assert.equal(s.bridge,true);
});
test('138: guarded backfill does not overwrite concurrent new or old writes',()=>{
 for(const write of ['newWrite','oldWrite'] as const){const s=run(['expand','compat','capture',write,'backfill']);assert.equal(s.newValue,s.latest);assert.equal(s.oldValue,s.latest);assert.equal(s.effect,'ok');assert.match(s.event,/跳过/);}
 const s=run(['expand','compat','capture','backfill','validate']);assert.equal(s.newValue,'小林');assert.equal(s.validated,true);
});
test('138: unguarded stale snapshot overwrites newer data and validation refuses switch',()=>{
 const bad=run(['expand','compat','capture','newWrite','unsafeBackfill']);assert.equal(bad.newValue,'小林');assert.equal(bad.oldValue,'新名字');assert.equal(bad.effect,'damage');assert.equal(advance(bad,'validate').effect,'blocked');assert.equal(advance(bad,'switchRead').readNew,false);
 const repaired=advance(advance(bad,'newWrite'),'validate');assert.equal(repaired.validated,true);
});
test('138: contract requires retirement AND closed rollback window, then new-only writes work',()=>{
 const ready=run(safePath.slice(0,-3));assert.equal(ready.readNew,true);assert.equal(advance(ready,'contract').effect,'blocked');
 const retired=advance(ready,'retire');assert.equal(retired.oldActive,false);assert.equal(advance(retired,'contract').effect,'blocked');assert.equal(retired.oldColumn,true);
 const contracted=advance(advance(retired,'closeWindow'),'contract');assert.equal(contracted.oldColumn,false);assert.equal(contracted.contracted,true);assert.equal(contracted.bridge,false);assert.equal(advance(contracted,'rollback').effect,'blocked');assert.equal(advance(contracted,'newWrite').effect,'ok');
});
test('138: code rollback preserves database; dropping old column breaks reads and rollback',()=>{
 const expanded=run(['expand','compat','capture','backfill','validate','switchRead']);const rollback=advance(expanded,'rollback');assert.equal(rollback.newColumn,true);assert.equal(readOld(rollback),'小林');assert.equal(readNew(rollback),'未部署');
 const broken=advance(expanded,'drop');assert.match(String(readOld(broken)),/错误/);assert.equal(advance(broken,'rollback').effect,'damage');assert.equal(advance(broken,'newWrite').effect,'damage');
});
test('138: invalid ordering blocked, immutable state supports exact rewind and preserves reasons',()=>{
 const start=initial();assert.equal(advance(start,'compat').effect,'blocked');assert.equal(advance(start,'closeWindow').effect,'blocked');assert.equal(run(['expand','capture','backfill']).effect,'blocked');
 const prediction={effect:'ok' as const,reason:'旧列仍在'};const result=record(start,'expand',prediction);prediction.reason='改写';assert.equal(result.prediction.reason,'旧列仍在');assert.deepEqual(result.before,initial());assert.equal(start.newColumn,false);assert.throws(()=>record(start,'expand',{effect:'ok',reason:' '}));
});
