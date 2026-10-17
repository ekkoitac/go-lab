import test from 'node:test';import assert from 'node:assert/strict';import {capabilities} from '../server/runner';
test('缺失 Go 工具链返回明确不可用状态，不伪造执行能力',async()=>{const result=await capabilities('go100-deliberately-missing-executable');assert.equal(result.available,false);assert.equal(result.race,false);assert.match(result.goVersion,/未找到/);});
