export type Strategy = 'direct' | 'semaphore' | 'workers';
export type Place = 'source' | 'permit' | 'queue' | 'running' | 'done';
export type Config = { total: number; limit: number; capacity: number };
export type Task = { id: number; place: Place; startedAt?: number; completedAt?: number; worker?: number };
export type Event = { time: number; task: number; text: string };
export type Metrics = { active: number; goroutines: number; queued: number; permit: number; source: number; done: number };
export type Board = {
  strategy: Strategy; tasks: Task[]; events: Event[];
  peak: { active: number; goroutines: number; queued: number };
  finishedAt?: number;
};
export type Snapshot = { time: number; submitted: boolean; boards: Board[] };
export type Timeline = { config: Config; frames: Snapshot[]; cursor: number };
export const defaults: Config = { total: 8, limit: 2, capacity: 6 };
export const names: Record<Strategy, string> = {
  direct: '每项创建 goroutine', semaphore: 'goroutine 内获取许可', workers: '固定 worker + 有界队列',
};
export const places: Record<Place, string> = {
  source: '尚未接纳', permit: '等待许可', queue: '队列等待', running: '正在执行', done: '已完成',
};

export function metrics(board: Board): Metrics {
  const count = (place: Place) => board.tasks.filter(t => t.place === place).length;
  const active = count('running'), permit = count('permit');
  return { active, permit, queued: count('queue'), source: count('source'), done: count('done'),
    goroutines: board.strategy === 'workers' ? active : active + permit };
}

export function createTimeline(config: Config = defaults, strategies: Strategy[] = ['direct', 'workers']): Timeline {
  // Inputs are bounded by the controls; reject invalid programmatic callers as well.
  if (!Number.isInteger(config.total) || config.total < 1 || config.total > 16 ||
      !Number.isInteger(config.limit) || config.limit < 1 || config.limit > 4 ||
      !Number.isInteger(config.capacity) || config.capacity < 0 || config.capacity > 16) throw new Error('实验参数超出范围');
  return { config: { ...config }, cursor: 0, frames: [{ time: 0, submitted: false, boards: strategies.map(strategy => ({
    strategy, tasks: Array.from({ length: config.total }, (_, i) => ({ id: i + 1, place: 'source' })),
    events: [], peak: { active: 0, goroutines: 0, queued: 0 },
  })) }] };
}

function move(board: Board, task: Task, place: Place, time: number, text: string) {
  task.place = place;
  board.events.push({ time, task: task.id, text });
}

function dispatch(board: Board, config: Config, time: number) {
  const start = (task: Task, worker?: number) => {
    task.startedAt = time; task.worker = worker;
    move(board, task, 'running', time, worker ? `worker ${worker} 接手 T${task.id}，开始执行` : `G${task.id} ${board.strategy === 'semaphore' ? '获得许可，' : ''}开始执行`);
  };
  if (board.strategy === 'direct') {
    for (const task of board.tasks.filter(t => t.place === 'source')) start(task);
  } else if (board.strategy === 'semaphore') {
    for (const task of board.tasks.filter(t => t.place === 'source')) move(board, task, 'permit', time, `已创建 G${task.id}，在 goroutine 内申请许可`);
    const available = config.limit - metrics(board).active;
    for (const task of board.tasks.filter(t => t.place === 'permit').slice(0, available)) start(task);
  } else {
    const workers = Math.min(config.limit, config.total);
    for (let id = 1; id <= workers; id++) {
      if (board.tasks.some(t => t.place === 'running' && t.worker === id)) continue;
      const task = board.tasks.find(t => t.place === 'queue') ?? board.tasks.find(t => t.place === 'source');
      if (task) start(task, id);
    }
    const free = config.capacity - metrics(board).queued;
    for (const task of board.tasks.filter(t => t.place === 'source').slice(0, free)) move(board, task, 'queue', time, `T${task.id} 进入缓冲队列，尚未创建专属 goroutine`);
  }
  const m = metrics(board);
  board.peak = { active: Math.max(board.peak.active, m.active), goroutines: Math.max(board.peak.goroutines, m.goroutines), queued: Math.max(board.peak.queued, m.queued) };
  if (m.done === config.total) board.finishedAt ??= time;
}

export function isFinished(snapshot: Snapshot) {
  return snapshot.submitted && snapshot.boards.every(b => b.finishedAt !== undefined);
}

/** A snapshot is a logical boundary: finish ALL simultaneous jobs, then dispatch. */
export function advance(timeline: Timeline): Timeline {
  if (timeline.cursor < timeline.frames.length - 1) return { ...timeline, cursor: timeline.cursor + 1 };
  const previous = timeline.frames[timeline.cursor];
  if (isFinished(previous)) return timeline;
  const next: Snapshot = structuredClone(previous);
  next.submitted = true;
  if (previous.submitted) next.time++;
  for (const board of next.boards) {
    if (board.finishedAt !== undefined) continue;
    for (const task of board.tasks.filter(t => t.place === 'running' && next.time - t.startedAt! >= 2)) {
      task.completedAt = next.time;
      move(board, task, 'done', next.time, `T${task.id} 完成${board.strategy === 'semaphore' ? '并归还许可' : ''}`);
    }
    dispatch(board, timeline.config, next.time);
  }
  return { ...timeline, frames: [...timeline.frames, next], cursor: timeline.cursor + 1 };
}

export function seek(timeline: Timeline, cursor: number): Timeline {
  return { ...timeline, cursor: Math.max(0, Math.min(timeline.frames.length - 1, Math.trunc(cursor))) };
}

export type Check = { label: string; value: number; status: 'pass' | 'fail' | 'pending'; firstViolation?: number };
export function challengeChecks(timeline: Timeline): Check[] {
  const snapshots = timeline.frames.slice(0, timeline.cursor + 1);
  const board = snapshots.at(-1)!.boards[0];
  const completed = board.finishedAt !== undefined;
  const limits: [keyof Board['peak'], string][] = [['active', '执行峰值 ≤ 2'], ['goroutines', '工作 goroutine 峰值 ≤ 2'], ['queued', '队列等待峰值 ≤ 2']];
  return [
    { label: `完成全部 ${timeline.config.total} 项任务`, value: metrics(board).done, status: completed ? 'pass' : 'pending' },
    ...limits.map(([key, label]): Check => {
      const index = snapshots.findIndex(s => s.boards[0].peak[key] > 2);
      return { label, value: board.peak[key], status: index >= 0 ? 'fail' : completed ? 'pass' : 'pending', firstViolation: index >= 0 ? index : undefined };
    }),
  ];
}

export function taskReason(task: Task, strategy: Strategy, submitted: boolean): string {
  if (!submitted) return '任务仍在原始批任务列表中；点击「提交这一批」开始。';
  switch (task.place) {
    case 'source': return '单一生产者的提交受到背压；本项仍在原始批任务列表中，没有创建工作 goroutine。';
    case 'permit': return `G${task.id} 已存在，但许可已被占用；执行数受限，等待的 goroutine 仍然占用资源。`;
    case 'queue': return '本项已被队列接纳，等待 worker 领取；排队任务没有各自的 goroutine。';
    case 'running': return strategy === 'workers' ? `worker ${task.worker} 正在处理本项；同一 worker 完成后可领取下一项。` : strategy === 'semaphore' ? `G${task.id} 已取得许可，正在执行受保护操作。` : `G${task.id} 直接执行；依赖预算只用于检测违规，不会自动限流。`;
    case 'done': return `本项在 t=${task.completedAt} 完成，执行持续 2 个模拟时间单位。`;
  }
}
