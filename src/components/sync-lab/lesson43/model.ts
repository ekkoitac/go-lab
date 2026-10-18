export type Strategy = 'unsafe' | 'write-lock' | 'access-lock' | 'whole-lock' | 'atomic';
export type Actor = 'A' | 'B';
export type Phase = 'read' | 'compute' | 'write' | 'done';
export interface Worker { phase: Phase; local: number | null }
export interface State { strategy: Strategy; initial: number; delta: number; value: number; owner: Actor | null; workers: Record<Actor, Worker>; trace: string[]; previous: State | null }
export const strategies: Record<Strategy, string> = { unsafe: '没有同步', 'write-lock': '只锁写入', 'access-lock': '读写各自加锁', 'whole-lock': '锁住整个读改写', atomic: '原子 Add' };
export function initial(strategy: Strategy = 'unsafe', value = 0, delta = 1): State {
  return { strategy, initial: value, delta, value, owner: null, workers: { A: { phase: 'read', local: null }, B: { phase: 'read', local: null } }, trace: [], previous: null };
}
export function blocked(state: State, actor: Actor): boolean { return state.strategy === 'whole-lock' && state.owner !== null && state.owner !== actor; }
export function advance(state: State, actor: Actor): State {
  const current = state.workers[actor];
  if (current.phase === 'done') return state;
  const next: State = { ...state, workers: { A: { ...state.workers.A }, B: { ...state.workers.B } }, trace: [...state.trace], previous: state };
  const worker = next.workers[actor];
  let event: string;
  if (blocked(state, actor)) event = `${actor} 请求锁：等待 ${state.owner} 完成整个更新；共享值保持 ${state.value}，尚未读取旧值。`;
  else if (state.strategy === 'atomic') {
    next.value += state.delta; worker.local = next.value; worker.phase = 'done';
    event = `${actor} 执行 atomic.Add：共享值 ${state.value} → ${next.value}；加法与写回是同一个原子操作。`;
  } else if (current.phase === 'read') {
    if (state.strategy === 'whole-lock') next.owner = actor;
    worker.local = state.value; worker.phase = 'compute';
    event = `${actor} ${state.strategy === 'whole-lock' ? '获取锁并' : ''}读取 n=${state.value} → 私有快照=${worker.local}；共享值未改。${state.strategy === 'access-lock' ? '本次读取的 mutex 已释放，后续写回不在同一临界区。' : ''}`;
  } else if (current.phase === 'compute') {
    worker.local = current.local! + state.delta; worker.phase = 'write';
    event = `${actor} 私有计算 ${current.local} + (${state.delta}) = ${worker.local}；只改私有副本，共享 n 仍为 ${state.value}。`;
  } else {
    next.value = current.local!; worker.phase = 'done';
    if (state.strategy === 'whole-lock') next.owner = null;
    event = `${actor} 写回私有值 ${current.local}：共享 n ${state.value} → ${next.value}。${next.value === state.value ? '数值没变：相同的旧快照覆盖，另一份增量没有被合并。' : ''}${state.strategy === 'whole-lock' ? '释放锁，下一个任务才能读取新值。' : ''}`;
  }
  next.trace.push(event); return next;
}
export function rewind(state: State): State { return state.previous ?? state; }
export function inspect(state: State) {
  const done = state.workers.A.phase === 'done' && state.workers.B.phase === 'done';
  return { value: state.value, owner: state.owner, workers: state.workers, done, expected: state.initial + 2 * state.delta, lostUpdate: done && state.value !== state.initial + 2 * state.delta, raceRisk: state.strategy === 'unsafe' || state.strategy === 'write-lock', steps: state.trace.length };
}
export function run(strategy: Strategy, order: Actor[], value = 0, delta = 1): State { return order.reduce(advance, initial(strategy, value, delta)); }
