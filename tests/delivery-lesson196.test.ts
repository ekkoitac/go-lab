import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,audit,defaults,initialState,run} from '../src/components/delivery-lab/lesson196/model';

test('196 binary rollback does not restore removed cents fields',()=>{
 const state=run(defaults); const result=audit(state,defaults);
 assert.equal(state.app,'v1');assert.equal(result.unreadableIds.length,4);assert.equal(result.passed,false);
});
test('196 backup loses later paid orders even with permissive RPO',()=>{
 const config={...defaults,recovery:'backup' as const,rpoMinutes:10}; const state=run(config);const result=audit(state,config);
 assert.deepEqual(result.missingIds,['N1','N2']);assert.equal(result.lostWindowMinutes,6);assert.equal(result.rpoMet,true);assert.equal(result.passed,false);
 assert.equal(state.ledger.length,4);assert.equal(state.rows.length,2);
});
test('196 RPO zero detects backup loss and no-new-writes backup passes',()=>{
 const config={...defaults,recovery:'backup' as const};assert.equal(audit(run(config),config).rpoMet,false);
 const noWrites={...config,newOrders:0};assert.equal(audit(run(noWrites),noWrites).passed,true);
});
test('196 forward repair with original values keeps paid orders and exact amounts',()=>{
 const config={...defaults,recovery:'forward' as const};const result=audit(run(config),config);
 assert.equal(result.passed,true);assert.equal(result.actualCents,5302);
});
test('196 rounded values can balance totals while individual orders are wrong',()=>{
 const config={...defaults,recovery:'forward' as const,preserveRaw:false};const result=audit(run(config),config);
 assert.equal(result.actualCents,result.expectedCents);assert.deepEqual(result.mismatchIds,['A','B']);assert.equal(result.passed,false);
});
test('196 lossless conversion can be repaired without original migration fields',()=>{
 const config={...defaults,recovery:'forward' as const,preserveRaw:false,lossy:false};assert.equal(audit(run(config),config).passed,true);
});
test('196 stepping is immutable, keeps backup and payment evidence and terminates',()=>{
 const initial=initialState();const backup=advance(initial,defaults);const migrated=advance(backup,defaults);
 assert.equal(initial.stage,0);assert.equal(backup.rows[0].cents,1299);assert.equal(migrated.rows[0].cents,undefined);
 assert.equal(migrated.backup[0].cents,1299);assert.equal(migrated.ledger[0].cents,1299);
 const complete=run(defaults);assert.equal(advance(complete,defaults),complete);
});
