import test from 'node:test';
import assert from 'node:assert/strict';
import { compare128, default128, model128 } from '../src/components/concurrency-lab/lesson128/model';
test('slow I/O under a global lock blocks an independent tenant', () => {
  const pair = compare128(default128, 3);
  assert.equal(pair.baseline.bStatus, '等待锁');
  assert.equal(pair.baseline.waitUnits, 4);
  assert.equal(pair.candidate.bStatus, '读取完成');
  assert.equal(pair.candidate.waitUnits, 0);
  assert.equal(model128({ ...default128, outside: false, delay: 7 }, 3).waitUnits, 7);
});
test('sharding separates independent keys but does not split one hot key', () => {
  const config = { ...default128, outside: false, sharded: true };
  assert.equal(model128(config, 3).bStatus, '读取完成');
  assert.equal(model128({ ...config, sameKey: true }, 3).bStatus, '等待锁');
});
test('moving I/O outside permits an intervening update; checked commit preserves it', () => {
  const during = model128(default128, 2);
  assert.equal(during.snapshot, 1);
  assert.equal(during.version, 2);
  assert.equal(during.value, '新业务值');
  assert.equal(model128(default128, 4).stale, true);
  assert.equal(model128(default128, 4).value, '旧回源结果');
  const fixed = model128({ ...default128, validate: true }, 4);
  assert.equal(fixed.version, 2);
  assert.equal(fixed.value, '新业务值');
  assert.equal(fixed.stale, false);
});
test('inside lock serializes the update; deterministic rewind restores prior state', () => {
  const config = { ...default128, outside: false };
  assert.equal(model128(config, 3).updater, '等待 A 释放锁');
  assert.equal(model128(config, 4).value, '新业务值');
  assert.equal(model128(config, 5).bStatus, '读取完成');
  assert.deepEqual(model128(config, 0), model128(config, -1));
  assert.equal(model128(config, 1).version, 1);
  assert.equal(model128(config, 1).snapshot, 1);
});
