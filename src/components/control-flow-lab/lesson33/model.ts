export type Growth = 'none' | 'once' | 'repeat';
export type Task = { name: string; depth: number };
export type Lane = { kind: 'range' | 'queue'; tasks: Task[]; initialLength: number; cursor: number; phase: 'check' | 'process' | 'append' | 'advance' | 'done'; processed: string[]; rejected: number; note: string };
export type State = { growth: Growth; limit: number; lanes: [Lane, Lane]; tick: number };
export function createState(names: string[] = ['A'], growth: Growth = 'once', limit = 8): State {
  if (!Number.isInteger(limit) || limit < 1 || limit > 12 || names.length > limit || names.length > 4 || new Set(names).size !== names.length || names.some(n => !n.trim())) throw new RangeError('初始任务须唯一且至多4项；总任务上限为1–12且不小于初始数量。');
  const lane = (kind: Lane['kind']): Lane => ({ kind, tasks: names.map(name => ({ name, depth: 0 })), initialLength: names.length, cursor: 0, phase: 'check', processed: [], rejected: 0, note: '循环开始：保存初始切片长度，等待检查边界。' });
  return { growth, limit, lanes: [lane('range'), lane('queue')], tick: 0 };
}
export const bound = (lane: Lane) => lane.kind === 'range' ? lane.initialLength : lane.tasks.length;
export function stepLane(lane: Lane, growth: Growth, limit: number): Lane {
  if (lane.phase === 'done') return lane;
  const next: Lane = { ...lane, tasks: lane.tasks.map(t => ({ ...t })), processed: [...lane.processed] };
  const task = next.tasks[next.cursor];
  if (next.phase === 'check') {
    const boundary = bound(next);
    next.phase = next.cursor < boundary ? 'process' : 'done';
    next.note = `检查 i=${next.cursor} < ${next.kind === 'range' ? '初始长度' : '当前 len'} ${boundary} → ${next.phase === 'done' ? 'false，循环结束' : 'true，进入循环体'}。`;
  } else if (next.phase === 'process') {
    next.processed.push(task.name);
    next.phase = 'append';
    next.note = `处理 tasks[${next.cursor}]=${task.name}；已处理 ${next.processed.length} 项，下一步决定是否追加子任务。`;
  } else if (next.phase === 'append') {
    const grows = growth === 'repeat' || (growth === 'once' && task.depth === 0);
    if (!grows) next.note = `${task.name} 不产生新任务，长度保持 ${next.tasks.length}；下一步移动游标。`;
    else if (next.tasks.length >= limit) { next.rejected++; next.note = `教学增长守卫：len=${limit} 已达上限，拒绝追加 ${task.name}′；已有任务仍继续处理。`; }
    else { next.tasks.push({ name: `${task.name}′`, depth: task.depth + 1 }); next.note = `追加 ${task.name}′：len ${next.tasks.length - 1} → ${next.tasks.length}；range 边界仍是 ${next.initialLength}，动态边界变为 ${next.tasks.length}。`; }
    next.phase = 'advance';
  } else {
    next.cursor++;
    next.phase = 'check';
    next.note = `游标前进到 i=${next.cursor}，下一步重新检查${next.kind === 'range' ? '初始长度' : '当前 len(tasks)'}。`;
  }
  return next;
}
export function step(state: State): State {
  if (state.lanes.every(lane => lane.phase === 'done')) return state;
  return { ...state, tick: state.tick + 1, lanes: state.lanes.map(lane => stepLane(lane, state.growth, state.limit)) as [Lane, Lane] };
}
export function run(state: State): State {
  let result = state;
  for (let count = 0; count < 100; count++) { if (result.lanes.every(lane => lane.phase === 'done')) return result; result = step(result); }
  throw new Error('模型超出明确增长边界');
}