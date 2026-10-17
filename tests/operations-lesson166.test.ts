import {test} from 'node:test';
import assert from 'node:assert/strict';
import {back,changeLimit,defaultProcs,defaults,initial,pollRuntime,restoreDefault,runPeriod,startRuntime,step} from '../src/components/operations-lab/lesson166/model';

test('166: 64-way work exhausts 200 CPU-ms in 3.125ms, then waits until quota renewal',()=>{
 const s=initial();const first=step(s);
 assert.equal(first.time,10);assert.equal(first.budget,0);assert.equal(first.consumed,200);assert.equal(first.throttled,6.875);
 assert.equal(s.budget,200);assert.equal(s.slices.length,0);
 const end=runPeriod(defaults);assert.equal(end.throttled,96.875);assert.equal(end.consumed,200);assert.equal(end.budget,0);assert.equal(step(end),end);
});
test('166: same quota and continuous work with two lanes spreads work across full period',()=>{
 const end=runPeriod({...defaults,procs:2});assert.equal(end.consumed,200);assert.equal(end.throttled,0);assert.equal(end.budget,0);
 const under=runPeriod({...defaults,procs:1});assert.equal(under.consumed,100);assert.equal(under.budget,100);assert.equal(under.throttled,0);
});
test('166: requests is not CPU limit and period scales quota without changing average bandwidth',()=>{
 const reference=runPeriod(defaults);const changed=runPeriod({...defaults,requests:4});
 assert.equal(changed.consumed,reference.consumed);assert.equal(changed.throttled,reference.throttled);
 for(const period of [50,100,200]){const s=runPeriod({...defaults,period});assert.equal(s.consumed/period,2);assert.equal(s.throttled/period,.96875);}
});
test('166: Go 1.26 minimum-two, ceiling and host/affinity restrictions are distinct',()=>{
 for(const [limit,host,affinity,expected] of [[.5,64,64,2],[1,64,64,2],[1.5,64,64,2],[2.5,64,64,3],[8,64,2,2],[8,1,64,1],[8,64,1,1]])assert.equal(defaultProcs({limit,host,affinity}),expected);
 const lowLimit=runPeriod({...defaults,limit:1,automatic:true});assert.equal(lowLimit.throttled,50);
});
test('166: fewer runnable workers or affinity CPUs cap actual parallel consumption',()=>{
 for(const c of [{...defaults,workers:1},{...defaults,affinity:1},{...defaults,host:1}]){const end=runPeriod(c);assert.equal(end.consumed,100);assert.equal(end.throttled,0);assert.equal(end.budget,100);}
});
test('166: every timeline slot conserves CPU work and wall-clock time',()=>{
 for(const limit of [1,2,4])for(const procs of [1,2,4,8,64])for(const period of [50,100,200]){
 const s=runPeriod({...defaults,limit,procs,period});
 assert.equal(s.consumed+s.budget,limit*period);
 assert.equal(s.slices.reduce((n,x)=>n+x.runMs+x.throttledMs,0),period);
 for(const x of s.slices){assert.equal(x.runMs*x.parallel,x.consumed);assert.ok(x.runMs>=0&&x.throttledMs>=0);}
 }
});
test('166: rewind reproduces exact earlier state; fresh initial replenishes quota',()=>{
 const start=initial();const one=step(start);assert.deepEqual(back(step(one)),one);assert.deepEqual(back(one),start);assert.deepEqual(back(start),start);
 assert.equal(initial(runPeriod(defaults).config).budget,200);
});
test('166: quota update and runtime poll are separate; explicit settings disable automatic updates',()=>{
 let auto=startRuntime({...defaults,automatic:true});assert.equal(auto.actual,2);
 auto=changeLimit(auto,4);assert.equal(auto.actual,2);assert.equal(auto.observedLimit,2);assert.equal(auto.config.limit,4);
 auto=pollRuntime(auto);assert.equal(auto.actual,4);assert.equal(auto.checks,1);
 let manual=changeLimit(startRuntime(defaults),4);manual=pollRuntime(manual);assert.equal(manual.actual,64);assert.equal(manual.config.automatic,false);
 manual=restoreDefault(manual);assert.equal(manual.actual,4);assert.equal(manual.config.automatic,true);
 assert.equal(pollRuntime(changeLimit(manual,2)).actual,2);
});
