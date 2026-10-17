import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,allowed,initialConfig,initialState,replay,verifyRepair,type Action,type Config} from '../src/components/data-boundary-lab/lesson76/model';
test('76 early return leaks without defer; defer closes on return, not on registration',()=>{
 const steps:Action[]=['next','scan','return'];
 assert.equal(replay(initialConfig,steps).inUse,1);
 const c={...initialConfig,deferClose:true};assert.equal(replay(c,['next','scan']).inUse,1);
 assert.equal(replay(c,steps).inUse,0);assert.equal(replay(c,steps).closed,true);
});
test('76 normal EOF and empty results release without defer and keep Err nil',()=>{
 for(const count of [0,2]){const c={...initialConfig,count};const s=replay(c,Array.from({length:count+1},()=> 'next' as Action));assert.equal(s.closed,true);assert.equal(s.inUse,0);assert.equal(s.next,false);assert.equal(advance(c,s,'err').rowsError,null);}
});
test('76 iteration failure releases and is reported only by Rows.Err',()=>{
 const c:Config={...initialConfig,fault:'iteration'};const s=replay(c,['next','scan','next']);assert.equal(s.inUse,0);assert.equal(s.next,false);assert.equal(s.errRead,false);assert.equal(s.scanError,null);assert.equal(s.rowsError,'driver: read failed');assert.equal(advance(c,s,'err').errRead,true);
});
test('76 Scan failure neither closes Rows nor populates Rows.Err',()=>{
 const c:Config={...initialConfig,fault:'scan'};const s=replay(c,['next','scan','err']);assert.equal(s.inUse,1);assert.equal(s.closed,false);assert.match(s.scanError!,/convert/);assert.equal(s.rowsError,null);assert.equal(s.scanned.length,0);assert.equal(replay(c,['next','scan','close']).inUse,0);
});
test('76 Scan requires Next; close is terminal for reads; scope exit blocks all operations',()=>{
 const s=initialState();assert.equal(allowed(s,'scan'),false);assert.deepEqual(advance(initialConfig,s,'scan'),s);const closed=advance(initialConfig,s,'close');assert.equal(allowed(closed,'next'),false);assert.equal(allowed(closed,'scan'),false);const returned=advance(initialConfig,s,'return');for(const a of ['next','scan','err','close','return'] as Action[])assert.equal(allowed(returned,a),false);
});
test('76 history replay supports undo, reset, changed conditions, with immutable baseline',()=>{
 const h:Action[]=['next','scan','return'],baseline=replay(initialConfig,h);assert.equal(replay(initialConfig,h.slice(0,-1)).returned,false);assert.deepEqual(replay(initialConfig,[]),initialState());assert.deepEqual(replay(initialConfig,h),baseline);assert.equal(replay({...initialConfig,deferClose:true},h).inUse,0);assert.equal(baseline.inUse,1);
 const before=initialState();advance(initialConfig,before,'next');assert.deepEqual(before,initialState());
});
test('76 repair verification needs close plus both error channels, not just resource release',()=>{
 const closeOnly=verifyRepair({deferClose:true,checkScan:false,checkRows:false});assert.equal(closeOnly.find(r=>r.kind==='early')!.pass,true);assert.equal(closeOnly.find(r=>r.kind==='eof')!.pass,true);assert.equal(closeOnly.find(r=>r.kind==='scan')!.pass,false);assert.equal(closeOnly.find(r=>r.kind==='iteration')!.pass,false);
 assert.equal(verifyRepair({deferClose:false,checkScan:true,checkRows:true}).find(r=>r.kind==='scan')!.pass,false);
 assert.equal(verifyRepair({deferClose:true,checkScan:true,checkRows:true}).every(r=>r.pass),true);
});
test('76 resource accounting and deterministic transitions across all short legal traces',()=>{
 for(const fault of ['none','scan','iteration'] as const)for(const count of [0,2])for(const deferClose of [false,true]){
  const c={count,fault,deferClose};let states=[initialState()];for(let depth=0;depth<5;depth++)states=states.flatMap(s=>(['next','scan','close','err','return'] as Action[]).filter(a=>allowed(s,a)).map(a=>{const n=advance(c,s,a);assert.equal(n.inUse,n.closed?0:1);assert.ok(n.scanned.every(i=>i>=0&&i<count));assert.deepEqual(n,advance(c,s,a));return n;}));
 }
});
test('76 a prior Err call cannot count as observing a later traversal error',()=>{
 const c:Config={...initialConfig,fault:'iteration'};const s=replay(c,['next','err','scan','next']);assert.equal(s.rowsError,'driver: read failed');assert.equal(s.errRead,false);assert.equal(advance(c,s,'err').errRead,true);
});
