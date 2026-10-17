import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrace, initialConfig, type Strategy } from '../src/components/engineering-lab/lesson92/model';

test('三索引缩小 cap 但不会使原数组不可达', () => {
  const plain = buildTrace({ ...initialConfig, strategy: 'slice' })[2];
  const limited = buildTrace(initialConfig)[2];
  assert.equal(plain.cap, 1024); assert.equal(limited.cap, 4);
  assert.equal(plain.retainedBytes, limited.retainedBytes);
  assert.equal(limited.largeReachable, true); assert.equal(limited.copyBytes, 0);
});
test('副本在 data 退出后只保留必要字节，复制成本仍然保留', () => {
  const trace = buildTrace({ ...initialConfig, strategy: 'copy' });
  assert.equal(trace[1].retainedBytes, 1028);
  assert.equal(trace[2].retainedBytes, 4); assert.equal(trace[2].largeReachable, false);
  assert.equal(trace[4].retainedBytes, 0); assert.equal(trace[4].copyBytes, 4);
  assert.equal(trace[4].allocatedBytes, 1028);
});
test('复制不能替其他持有者断开引用', () => {
  const trace = buildTrace({ ...initialConfig, size: 1048576, keep: 16, strategy: 'copy', other: true });
  assert.equal(trace[2].retainedBytes, 1048592); assert.equal(trace[2].largeReachable, true);
  assert.equal(trace[3].retainedBytes, 16); assert.equal(trace[3].largeReachable, false);
});
test('各策略清空缓存后没有遗漏引用，轨迹快照独立且确定', () => {
  for (const strategy of ['slice', 'limited', 'copy'] as Strategy[]) {
    const config = { ...initialConfig, strategy, other: true }; const trace = buildTrace(config);
    assert.equal(trace[0].source, true); assert.equal(trace[0].cache, 'none');
    assert.equal(trace[4].largeReachable, false); assert.equal(trace[4].retainedBytes, 0);
    assert.equal(new Set(trace).size, 5); assert.deepEqual(buildTrace(config), trace);
    assert.equal(trace[1].copyBytes, strategy === 'copy' ? 4 : 0);
  }
});
test('拒绝无意义切片边界', () => {
  for (const keep of [0, -1, 1025, 1.5]) assert.throws(() => buildTrace({ ...initialConfig, keep }));
});
