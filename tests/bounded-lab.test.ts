import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, challengeChecks, createTimeline, defaults, isFinished, metrics, seek, type Config, type Strategy, type Timeline } from '../src/components/bounded-lab/model';

function finish(timeline: Timeline) {
  let t = timeline;
  for (let i = 0; i < 40 && !isFinished(t.frames[t.cursor]); i++) t = advance(t);
  assert.ok(isFinished(t.frames[t.cursor]));
  return t;
}

test('same batch distinguishes execution, goroutine and queue peaks', () => {
  const t = advance(createTimeline(defaults, ['direct', 'semaphore', 'workers']));
  const [direct, sem, workers] = t.frames[t.cursor].boards;
  assert.deepEqual(metrics(direct), { active: 8, goroutines: 8, queued: 0, permit: 0, source: 0, done: 0 });
  assert.deepEqual(metrics(sem), { active: 2, goroutines: 8, queued: 0, permit: 6, source: 0, done: 0 });
  assert.deepEqual(metrics(workers), { active: 2, goroutines: 2, queued: 6, permit: 0, source: 0, done: 0 });
  const end = finish(t).frames.at(-1)!;
  assert.deepEqual(end.boards.map(b => b.finishedAt), [2, 8, 8]);
  assert.deepEqual(end.boards.map(b => b.peak.goroutines), [8, 8, 2]);
});

test('bounded queue backpressures one producer; zero buffer directly hands off', () => {
  for (const capacity of [0, 2]) {
    const t = advance(createTimeline({ ...defaults, capacity }, ['workers']));
    assert.deepEqual(metrics(t.frames[t.cursor].boards[0]), { active: 2, goroutines: 2, queued: capacity, permit: 0, source: 6 - capacity, done: 0 });
    const next = advance(advance(t)).frames.at(-1)!;
    assert.equal(next.time, 2);
    assert.deepEqual(next.boards[0].tasks.filter(x => x.place === 'running').map(x => x.id), [3, 4]);
    assert.equal(next.boards[0].tasks.filter(x => x.place === 'done').length, 2);
    assert.equal(next.boards[0].peak.queued, capacity);
  }
});

test('every supported boundary conserves tasks, completes exactly once and respects strategy limits', () => {
  for (const strategy of ['direct', 'semaphore', 'workers'] as Strategy[]) {
    for (let total = 1; total <= 16; total++) for (let limit = 1; limit <= 4; limit++) for (const capacity of [0, 2, 6, 16]) {
      const config: Config = { total, limit, capacity };
      const t = finish(createTimeline(config, [strategy]));
      for (const snapshot of t.frames) {
        const board = snapshot.boards[0], m = metrics(board);
        assert.equal(m.active + m.queued + m.permit + m.source + m.done, total);
        assert.equal(new Set(board.tasks.map(x => x.id)).size, total);
        if (strategy !== 'direct') assert.ok(m.active <= limit);
        if (strategy === 'workers') { assert.ok(m.goroutines <= Math.min(limit, total)); assert.ok(m.queued <= capacity); }
        for (const task of board.tasks.filter(x => x.place === 'done')) assert.equal(task.completedAt! - task.startedAt!, 2);
      }
      const board = t.frames.at(-1)!.boards[0];
      assert.equal(metrics(board).done, total);
      assert.equal(metrics(board).goroutines, 0);
      for (const task of board.tasks) {
        assert.equal(board.events.filter(e => e.task === task.id && e.text.includes('开始执行')).length, 1);
        assert.equal(board.events.filter(e => e.task === task.id && e.text.includes('完成')).length, 1);
      }
      assert.equal(board.finishedAt, strategy === 'direct' ? 2 : Math.ceil(total / limit) * 2);
    }
  }
});

test('snapshots are immutable; rewind/forward restores exact state and shorter board freezes', () => {
  const start = createTimeline(), saved = structuredClone(start);
  const end = finish(start);
  assert.deepEqual(start, saved);
  let rewound = seek(end, 1);
  assert.deepEqual(rewound.frames[rewound.cursor], advance(start).frames[1]);
  while (rewound.cursor < end.cursor) rewound = advance(rewound);
  assert.deepEqual(rewound, end);
  assert.equal(advance(end), end);
  const directAt2 = end.frames.find(s => s.submitted && s.time === 2)!.boards[0];
  assert.deepEqual(end.frames.at(-1)!.boards[0], directAt2);
});

test('challenge locates earliest violation, does not pass unfinished runs, accepts slower valid repairs', () => {
  const initial = createTimeline(defaults, ['semaphore']);
  assert.ok(challengeChecks(initial).every(c => c.status === 'pending'));
  const failed = finish(initial), g = challengeChecks(failed)[2];
  assert.equal(g.status, 'fail'); assert.equal(g.firstViolation, 1);
  const queueFailed = finish(createTimeline(defaults, ['workers']));
  assert.equal(challengeChecks(queueFailed)[3].firstViolation, 1);
  for (const total of [8, 16]) for (const limit of [1, 2]) for (const capacity of [0, 2]) {
    const passed = finish(createTimeline({ total, limit, capacity }, ['workers']));
    assert.ok(challengeChecks(passed).every(c => c.status === 'pass'));
    assert.equal(passed.frames.at(-1)!.boards[0].finishedAt, total / limit * 2);
  }
});

test('parameter changes use a fresh timeline and invalid configuration cannot enter the model', () => {
  const old = finish(createTimeline());
  const fresh = createTimeline({ ...old.config, total: 16, capacity: 0 });
  assert.equal(fresh.frames.length, 1); assert.equal(fresh.cursor, 0);
  assert.equal(fresh.frames[0].submitted, false);
  for (const patch of [{ total: 0 }, { total: 17 }, { limit: 0 }, { limit: 5 }, { capacity: -1 }, { capacity: 17 }, { limit: 1.5 }]) assert.throws(() => createTimeline({ ...defaults, ...patch }));
});
