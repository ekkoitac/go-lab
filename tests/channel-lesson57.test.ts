import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advance57,initial57,pair57,tryReceive57,worker57} from '../src/components/channel-lessons/model57';
test('equal idle opportunities spin only with default; blocked select is entered once',()=>{
 const initial=initial57();let s=initial;for(let i=0;i<8;i++)s=pair57(s,'idle');
 assert.equal(s.busy.spins,8);assert.equal(s.busy.checks,8);assert.equal(s.blocking.checks,1);assert.equal(s.blocking.spins,0);assert.equal(s.blocking.status,'waiting');assert.equal(initial.tick,0);
});
test('message wakes original waiting select; both see identical values',()=>{
 const s=pair57(pair57(initial57(),'idle'),'message');assert.deepEqual(s.busy.received,[7]);assert.deepEqual(s.blocking.received,[7]);assert.equal(s.blocking.checks,1);assert.equal(s.blocking.status,'running');
 const next=pair57(s,'idle');assert.equal(next.blocking.checks,2);assert.equal(next.blocking.status,'waiting');assert.deepEqual(s.blocking.received,[7]);
});
test('cancel wakes waiting workers and terminates; further events have no effect',()=>{
 const s=pair57(pair57(initial57(),'idle'),'cancel');assert.equal(s.blocking.status,'stopped');assert.equal(s.busy.status,'stopped');assert.equal(pair57(s,'message'),s);assert.equal(pair57(s,'idle'),s);
});
test('repair requires removal of default and cancellation branch',()=>{
 const noCancel=advance57(advance57(worker57(false,false),'idle'),'cancel');assert.equal(noCancel.status,'waiting');assert.equal(noCancel.spins,0);
 assert.equal(advance57(worker57(true,true),'idle').spins,1);
 const fixed=advance57(advance57(worker57(false,true),'idle'),'cancel');assert.equal(fixed.status,'stopped');assert.equal(fixed.spins,0);
});
test('single nonblocking attempt returns after one check with or without value',()=>{
 assert.deepEqual(tryReceive57(false),{checks:1,received:[],defaults:1,returns:true});assert.deepEqual(tryReceive57(true),{checks:1,received:[7],defaults:0,returns:true});
});
test('57: an ignored cancellation does not disable later message reception',()=>{
 const canceled=advance57(worker57(false,false),'cancel');
 const next=advance57(canceled,'message');
 assert.deepEqual(next.received,[7]);assert.equal(next.status,'running');
});
