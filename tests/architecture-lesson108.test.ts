import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, defaults, detectionStage, graph, initial, inspect, rewind, timeline, validate, type Strategy } from '../src/components/architecture-lab/lesson108/model';

test('missing providers stop before resource acquisition at a strategy-specific stage', () => {
  const stages = ['编译期：缺失构造函数', '生成期图验证', '启动期图解析'];
  (['explicit', 'generated', 'runtime'] as Strategy[]).forEach((strategy, index) => {
    const config = { ...defaults, strategy, missingClient: true };
    assert.equal(detectionStage(config), stages[index]);
    assert.deepEqual(validate(graph(config)), { kind: 'missing', path: ['Service', 'Client'] });
    const end = timeline(config).at(-1)!;
    assert.deepEqual(end.active, []);
    assert.deepEqual(end.built, []);
    assert.equal(end.failed, true);
  });
});
test('a dependency cycle reports its path and does not claim universal compiler detection', () => {
  const config = { ...defaults, cycle: true };
  assert.deepEqual(validate(graph(config)), { kind: 'cycle', path: ['Service', 'DB', 'Service'] });
  assert.equal(detectionStage(config), '装配计划审查');
  assert.deepEqual(timeline(config).at(-1)!.built, []);
});
test('runtime environmental failures stay runtime for all composition strategies', () => {
  for (const strategy of ['explicit', 'generated', 'runtime'] as Strategy[]) {
    const config = { ...defaults, strategy, failAt: 'Service' as const };
    assert.equal(detectionStage(config), '启动期构造');
    const frames = timeline(config);
    const failed = frames.find(frame => frame.failed)!;
    assert.deepEqual(failed.active, ['DB', 'Client']);
    assert.deepEqual(frames.at(-1)!.closed, ['Client', 'DB']);
    assert.deepEqual(frames.at(-1)!.active, []);
  }
});
test('only successful resources are rolled back; missing cleanup retains exactly those resources', () => {
  const config = { ...defaults, failAt: 'Client' as const };
  assert.deepEqual(timeline(config).at(-1)!.closed, ['DB']);
  assert.deepEqual(timeline({ ...config, cleanup: false }).at(-1)!.active, ['DB']);
  assert.deepEqual(timeline({ ...config, cleanup: false }).at(-1)!.closed, []);
});
test('successful service borrows resources until shutdown and reverse release', () => {
  const frames = timeline({ ...defaults, failAt: 'none' });
  const running = frames.find(frame => frame.running)!;
  assert.deepEqual(running.built, ['DB', 'Client', 'Service']);
  assert.deepEqual(running.active, ['DB', 'Client']);
  assert.deepEqual(frames.at(-1)!.closed, ['Client', 'DB']);
  assert.equal(frames.at(-1)!.failed, false);
});
test('step and rewind are immutable snapshots, bounded at both ends', () => {
  const start = initial();
  const next = advance(start);
  assert.equal(start.phase, 0);
  assert.deepEqual(rewind(next), start);
  assert.deepEqual(rewind(start), start);
  let state = start;
  for (let i = 0; i < 30; i++) state = advance(state);
  assert.equal(inspect(state).done, true);
  assert.deepEqual(advance(state), state);
});
