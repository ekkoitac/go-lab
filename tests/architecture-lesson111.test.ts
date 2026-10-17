import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, configure, defaults, initial, inspect, rewind, timeline, type Config } from '../src/components/architecture-lab/lesson111/model';
const complete = (patch: Partial<Config> = {}) => { let state = initial({ ...defaults, ...patch }); while (!inspect(state).done) state = advance(state); return state; };
test('111 synchronous timeout preserves server completion but client uncertainty', () => {
  const rows = timeline(defaults);
  assert.equal(rows.find(row => row.tick === 2)?.timedOut, true);
  const view = inspect(complete());
  assert.equal(view.result, true);
  assert.equal(view.client, '等待超时，结果未知');
  assert.equal(view.handoff, '无任务查询契约');
});
test('111 HTTP task acknowledgement is distinct from completion and querying', () => {
  const rows = timeline({ ...defaults, interaction: 'task' });
  const receipt = rows.find(row => row.accepted)!;
  assert.equal(receipt.result, false);
  assert.match(receipt.event, /HTTP 202/);
  assert.equal(receipt.progress, 0);
  assert.equal(rows.at(-2)?.client, '持有任务编号，尚未查询');
  assert.equal(rows.at(-2)?.result, true);
  assert.equal(rows.at(-1)?.client, '查询后取得业务结果');
  assert.equal(rows.some(row => row.timedOut), false);
});
test('111 protocol does not change processing speed or make acknowledgement into result', () => {
  for (const transport of ['http', 'grpc'] as const) {
    const view = inspect(complete({ scenario: 'internal', transport, duration: 3, budget: 2 }));
    assert.equal(view.tick, 3); assert.equal(view.progress, 3); assert.equal(view.timedOut, true);
  }
  const messageSync = inspect(complete({ scenario: 'internal', transport: 'message' }));
  assert.equal(messageSync.blocked, true); assert.equal(messageSync.progress, 0);
  const messageTask = inspect(complete({ scenario: 'internal', transport: 'message', interaction: 'task' }));
  assert.equal(messageTask.client, '查询后取得业务结果');
});
test('111 browser and browser-origin export need gRPC/message adaptation; internal supports generated client', () => {
  for (const scenario of ['browser', 'export'] as const) {
    assert.equal(inspect(complete({ scenario, transport: 'grpc' })).blocked, true);
    assert.equal(inspect(complete({ scenario, transport: 'grpc', adapted: true })).blocked, false);
    assert.equal(inspect(complete({ scenario, transport: 'message', interaction: 'task' })).blocked, true);
  }
  assert.equal(inspect(complete({ scenario: 'internal', transport: 'grpc', duration: 2, budget: 2 })).client, '已取得业务结果');
});
test('111 equal budget succeeds and shorter budget only changes client waiting', () => {
  assert.equal(inspect(complete({ duration: 2, budget: 2 })).client, '已取得业务结果');
  assert.equal(inspect(complete({ duration: 2, budget: 1 })).client, '等待超时，结果未知');
  assert.equal(inspect(complete({ duration: 2, budget: 1 })).progress, 2);
});
test('111 rewind replays identical state; configuration starts fresh and cannot retain future events', () => {
  const start = initial(); const next = advance(start);
  assert.deepEqual(rewind(next), start); assert.deepEqual(advance(rewind(next)), next);
  const done = complete(); const changed = configure(rewind(done), { interaction: 'task' });
  assert.equal(changed.phase, 0); assert.equal(inspect(changed).rows.length, 1);
  assert.equal(inspect(changed).timedOut, false); assert.equal(start.phase, 0);
  assert.deepEqual(advance(done), done); assert.deepEqual(rewind(start), start);
});
test('111 numeric inputs stay bounded and cannot create an empty or unbounded timeline', () => {
  assert.equal(initial({ ...defaults, duration: Infinity, budget: -2 }).config.duration, 1);
  assert.equal(initial({ ...defaults, duration: 99, budget: NaN }).config.duration, 8);
  assert.equal(initial({ ...defaults, duration: 99, budget: NaN }).config.budget, 1);
});
