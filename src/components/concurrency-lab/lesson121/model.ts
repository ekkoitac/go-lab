export type Strategy = 'direct' | 'inside' | 'workers';
export type Place = 'source' | 'waiting' | 'queue' | 'active' | 'done';
export type Config = { total: number; workers: number; queue: number; dependency: number };
export type Task = { id: number; place: Place };
export type Board = { strategy: Strategy; tasks: Task[]; peakActive: number; peakG: number; peakQueue: number };
export type Frame = { round: number; boards: Board[] };
export type State = { config: Config; history: Frame[]; cursor: number };
export const defaults: Config = { total: 8, workers: 2, queue: 2, dependency: 2 };
export const names: Record<Strategy, string> = { direct: '每项直接启动', inside: '先启动，再等许可', workers: '固定 worker + 有界队列' };
export const places: Record<Place, string> = { source: '上游尚未接纳', waiting: 'G 等待许可', queue: '已接纳的队列', active: '调用依赖', done: '完成' };
export function initial(config: Config = defaults): State {
  for (const [key, max] of [['total', 12], ['workers', 6], ['queue', 8], ['dependency', 6]] as const) {
    if (!Number.isInteger(config[key]) || config[key] < (key === 'dependency' ? 1 : 0) || config[key] > max) throw new Error('参数超出教学模型范围');
  }
  return { config: { ...config }, cursor: 0, history: [{ round: 0, boards: (['direct', 'inside', 'workers'] as Strategy[]).map(strategy => ({ strategy, tasks: Array.from({ length: config.total }, (_, id) => ({ id: id + 1, place: 'source' })), peakActive: 0, peakG: 0, peakQueue: 0 })) }] };
}
export function current(state: State): Frame { return state.history[state.cursor]; }
export function metrics(board: Board, config: Config, submitted = true) {
  const count = (place: Place) => board.tasks.filter(task => task.place === place).length;
  const active = count('active'), waiting = count('waiting'), queue = count('queue'), done = count('done'), source = count('source');
  // Fixed workers remain alive, including idle ones, until this finite batch is drained.
  const goroutines = board.strategy === 'workers' ? submitted && done < config.total ? Math.min(config.workers, config.total) : 0 : active + waiting;
  return { active, waiting, queue, done, source, goroutines, overloaded: active > config.dependency };
}
export function finished(state: State): boolean {
  return state.cursor > 0 && current(state).boards.every(board => metrics(board, state.config).done === state.config.total);
}
export function advance(state: State): State {
  if (state.cursor + 1 < state.history.length) return { ...state, cursor: state.cursor + 1 };
  if (finished(state)) return state;
  const frame = structuredClone(current(state));
  frame.round++;
  for (const board of frame.boards) {
    for (const task of board.tasks) if (task.place === 'active') task.place = 'done';
    if (board.strategy === 'direct') {
      for (const task of board.tasks) if (task.place === 'source') task.place = 'active';
    } else if (board.strategy === 'inside') {
      for (const task of board.tasks) if (task.place === 'source') task.place = 'waiting';
      for (const task of board.tasks.filter(t => t.place === 'waiting').slice(0, state.config.workers)) task.place = 'active';
    } else {
      const available = [...board.tasks.filter(t => t.place === 'queue'), ...board.tasks.filter(t => t.place === 'source')];
      for (const task of available.slice(0, state.config.workers)) task.place = 'active';
      const space = state.config.queue - board.tasks.filter(t => t.place === 'queue').length;
      for (const task of board.tasks.filter(t => t.place === 'source').slice(0, space)) task.place = 'queue';
    }
    const m = metrics(board, state.config);
    board.peakActive = Math.max(board.peakActive, m.active);
    board.peakG = Math.max(board.peakG, m.goroutines);
    board.peakQueue = Math.max(board.peakQueue, m.queue);
  }
  if (state.cursor > 0 && JSON.stringify(frame.boards) === JSON.stringify(current(state).boards)) return state;
  return { ...state, history: [...state.history, frame], cursor: state.cursor + 1 };
}
export function rewind(state: State): State { return { ...state, cursor: Math.max(0, state.cursor - 1) }; }
export function run(config: Config): State {
  let state = initial(config);
  for (let i = 0; i <= config.total + 2; i++) { const next = advance(state); if (next === state) break; state = next; }
  return state;
}
export function reason(board: Board, config: Config, submitted: boolean): string {
  const m = metrics(board, config, submitted);
  if (!submitted) return '同一批任务仍在上游；首次单步才接纳任务并分配资源。';
  if (m.done === config.total) return `全部 ${m.done} 项完成；完成不代表过程中没有超额，检查峰值。`;
  if (board.strategy === 'direct') return m.overloaded ? `创建 ${m.goroutines} 个 G 后全部调用依赖，超过依赖上限 ${config.dependency}。上限只是约束，不会自动生效。` : '本批到达量未超过依赖容量，简单启动也可以满足当前约束。';
  if (config.workers === 0) return '额度为 0：没有任务能执行。有限资源不等于系统能够前进，请增加额度。';
  if (board.strategy === 'inside') return `${m.active} 项执行，另有 ${m.waiting} 个已经创建的 G 等待许可；许可限制执行数，没有限制 G 的创建。`;
  return `${m.active} 项由固定 worker 执行，${m.queue} 项占队列槽，${m.source} 项留在有限上游列表。队列满时单一生产者停止提交，没有丢任务。`;
}
