import test from 'node:test';
import assert from 'node:assert/strict';
import {advance,autoRun,complete,initialState,readyTasks} from '../src/components/sync-lab/lesson42/model';
test('42: one unit interleaves tasks without any simultaneous computation',()=>{
 let s=initialState();for(const id of ['A','B','A','B','A','B'] as const)s=advance(s,[id]);
 assert.equal(complete(s),true);assert.equal(s.tick,6);assert.ok(s.timeline.every(t=>t.running.length===1));
});
test('42: two units permit parallel work but capacity is not actual utilization',()=>{
 assert.equal(autoRun(2).tick,3);assert.equal(autoRun(1).tick,6);
 const s=advance(initialState(2),['A']);assert.equal(s.tasks[1].work,0);assert.equal(s.timeline[0].running.length,1);
});
test('42: waiting does not use a compute unit and becomes runnable only after two later slices',()=>{
 const start=initialState(1,true),a=advance(start,['A']);assert.equal(a.tasks[0].wait,2);assert.deepEqual(readyTasks(a),['B']);
 const b=advance(a,['B']);assert.equal(b.tasks[0].wait,1);assert.equal(b.tasks[1].wait,2);
 const c=advance(b,[]);assert.deepEqual(readyTasks(c),['A']);assert.equal(c.tasks[1].wait,1);
 assert.equal(start.tick,0);assert.equal(start.tasks[0].work,0);
});
test('42: reject duplicate assignments, excess capacity, and waiting tasks without moving time',()=>{
 assert.equal(advance(initialState(),['A','B']).tick,0);assert.equal(advance(initialState(2),['A','A']).tick,0);
 const waiting=advance(initialState(2,true),['A','B']);assert.equal(advance(waiting,['A']).tick,1);
});
test('42: preserved snapshots allow alternative schedules; finished work cannot advance',()=>{
 const s=advance(initialState(2),['A']);const left=advance(s,['A']),right=advance(s,['B']);
 assert.deepEqual(s.tasks.map(t=>t.work),[1,0]);assert.deepEqual(left.tasks.map(t=>t.work),[2,0]);assert.deepEqual(right.tasks.map(t=>t.work),[1,1]);
 const end=autoRun(2,true);assert.equal(complete(end),true);assert.equal(advance(end,[]),end);
});
