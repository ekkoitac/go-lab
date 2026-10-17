import {test} from 'node:test';
import assert from 'node:assert/strict';
import {technical,capability,inspect,affected,eventFor,transferFeedback} from '../src/components/architecture-lab/lesson102/model';

test('102 same price change preserves work but consolidates ownership',()=>{
 const layered=inspect(technical,'price',false,3),business=inspect(capability,'price',false,3);
 assert.deepEqual(layered.visited,business.visited);
 assert.equal(layered.owners.length,3);assert.equal(layered.crossings,2);
 assert.equal(business.owners.length,1);assert.equal(business.crossings,0);
 assert.equal(business.visited.includes('payment'),false);
});
test('102 direct shared writes still propagate after code regrouping',()=>{
 const leaking=inspect(capability,'price',true,99);
 assert.deepEqual(leaking.owners,['订单团队','支付团队']);
 assert.equal(leaking.crossings,1);assert.equal(leaking.total,4);
 assert.equal(leaking.priceWriters.length,2);
 assert.match(eventFor('payment',true),/直接写价格/);
 assert.deepEqual(affected('price',false),['entry','rule','store']);
});
test('102 independently evolving search platform is not merged just because it is technical',()=>{
 const platform=inspect(technical,'search',true,99);
 assert.deepEqual(platform.visited,['searchApi','searchIndex']);
 assert.deepEqual(platform.owners,['搜索平台']);assert.equal(platform.crossings,0);
 assert.deepEqual(platform,inspect(capability,'search',true,99));
});
test('102 stepping and rewind reproduce exact state without mutating topology',()=>{
 const before={...technical};const initial=inspect(technical,'price',false,0);
 assert.deepEqual(initial.visited,[]);assert.equal(initial.done,false);
 assert.deepEqual(inspect(technical,'price',false,1).owners,['入口团队']);
 assert.deepEqual(inspect(technical,'price',false,0),initial);
 assert.deepEqual(technical,before);
 assert.equal(inspect(technical,'price',false,-5).cursor,0);
 assert.equal(inspect(technical,'price',false,NaN).cursor,0);
 assert.equal(inspect(technical,'price',false,999).cursor,3);
});
test('102 custom topology counts crossed boundaries and unique owners separately',()=>{
 const mixed={...technical,store:technical.entry};
 const result=inspect(mixed,'price',false,3);
 assert.equal(result.owners.length,2);assert.equal(result.crossings,2);
 assert.match(transferFeedback('owner'),/^正确/);
 assert.doesNotMatch(transferFeedback('rename'),/^正确/);
});
