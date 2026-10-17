import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, current, defaults, finished, initial, metrics, rewind, run } from '../src/components/concurrency-lab/lesson121/model';

test('same burst separates execution, created goroutines and admission', () => {
  const state = advance(initial());
  const [direct, inside, workers] = current(state).boards;
  assert.deepEqual([metrics(direct, defaults).active, metrics(direct, defaults).goroutines], [8, 8]);
  assert.deepEqual([metrics(inside, defaults).active, metrics(inside, defaults).goroutines, metrics(inside, defaults).waiting], [2, 8, 6]);
  assert.deepEqual([metrics(workers, defaults).active, metrics(workers, defaults).goroutines, metrics(workers, defaults).queue, metrics(workers, defaults).source], [2, 2, 2, 4]);
});
test('fixed workers retain identity budget including an idle worker in final odd batch', () => {
  const config = { ...defaults, total: 3 };
  const state = advance(advance(initial(config)));
  const worker = current(state).boards[2];
  assert.equal(metrics(worker, config).active, 1);
  assert.equal(metrics(worker, config).goroutines, 2);
  assert.equal(metrics(current(advance(state)).boards[2], config).goroutines, 0);
});
test('all finite input is eventually processed exactly once across queue capacities', () => {
  for (const total of [0, 1, 7, 12]) for (const workers of [1, 2, 6]) for (const queue of [0, 1, 8]) {
    const config = { ...defaults, total, workers, queue };
    const result = run(config);
    assert.equal(finished(result), true);
    for (const frame of result.history) for (const board of frame.boards) {
      assert.equal(new Set(board.tasks.map(t => t.id)).size, total);
      if (board.strategy === 'workers') {
        assert.ok(metrics(board, config, frame.round > 0).queue <= queue);
        assert.ok(metrics(board, config, frame.round > 0).goroutines <= workers);
      }
    }
    assert.ok(current(result).boards.every(b => b.tasks.every(t => t.place === 'done')));
  }
});
test('zero queue still hands off and applies backpressure without dropping tasks', () => {
  const config = { ...defaults, queue: 0 };
  const state = advance(initial(config));
  assert.deepEqual(current(state).boards[2].tasks.map(t => t.place), ['active', 'active', 'source', 'source', 'source', 'source', 'source', 'source']);
  assert.equal(current(run(config)).boards[2].peakQueue, 0);
});
test('zero workers exposes a stable stall instead of claiming completion', () => {
  const state = run({ ...defaults, workers: 0 });
  assert.equal(finished(state), false);
  assert.equal(current(state).boards[1].peakG, 8);
  assert.equal(current(state).boards[2].peakActive, 0);
  assert.equal(advance(state), state);
});
test('dependency limit diagnoses overcapacity but does not silently throttle workers', () => {
  const config = { ...defaults, workers: 4 };
  const board = current(advance(initial(config))).boards[2];
  assert.equal(metrics(board, config).active, 4);
  assert.equal(metrics(board, config).overloaded, true);
});
test('rewind and replay preserve exact task state and history without mutating prior snapshots', () => {
  const base = initial(); const first = advance(base); const second = advance(first);
  assert.equal(current(base).boards[0].tasks[0].place, 'source');
  assert.deepEqual(current(rewind(second)), current(first));
  assert.deepEqual(advance(rewind(second)), second);
  assert.deepEqual(rewind(base), base);
  const end = run(defaults); assert.equal(advance(end), end);
});
test('model rejects invalid inputs and copies mutable caller config', () => {
  for (const workers of [-1, 0.5, 7, NaN]) assert.throws(() => initial({ ...defaults, workers }));
  assert.throws(() => initial({ ...defaults, dependency: 0 }));
  const config = { ...defaults }; const state = initial(config); config.total = 2;
  assert.equal(state.config.total, 8);
});
