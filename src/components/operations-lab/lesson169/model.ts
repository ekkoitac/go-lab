export type Config = { qps: number; serviceMs: number; capacity: number; admission: 'queue' | 'reject' };
export const defaults: Config = { qps: 1000, serviceMs: 50, capacity: 80, admission: 'queue' };
export type Request = { id: number; arrived: number; due: number };
export type State = { timeMs: number; arrivals: number; completed: number; rejected: number; active: Request[]; queue: Request[]; areaMs: number; completedResidenceMs: number; lastCompleted: number; lastArrivals: number; lastRejected: number };
export const initial = (): State => ({ timeMs: 0, arrivals: 0, completed: 0, rejected: 0, active: [], queue: [], areaMs: 0, completedResidenceMs: 0, lastCompleted: 0, lastArrivals: 0, lastRejected: 0 });
export function meanInFlight(throughput: number, residenceMs: number) { return throughput * residenceMs / 1000; }
export function step(previous: State, config: Config): State {
  const timeMs = previous.timeMs + 10;
  const finished = previous.active.filter(r => r.due <= timeMs);
  const active = previous.active.filter(r => r.due > timeMs);
  const queue = [...previous.queue];
  const incoming = Math.floor(timeMs * config.qps / 1000) - Math.floor(previous.timeMs * config.qps / 1000);
  let rejected = 0;
  for (let i = 0; i < incoming; i++) {
    const request = { id: previous.arrivals + i + 1, arrived: timeMs, due: 0 };
    if (config.admission === 'reject' && active.length + queue.length >= config.capacity) rejected++;
    else queue.push(request);
  }
  while (queue.length && active.length < config.capacity) {
    const request = queue.shift()!;
    active.push({ ...request, due: timeMs + config.serviceMs });
  }
  return { timeMs, arrivals: previous.arrivals + incoming, completed: previous.completed + finished.length,
    rejected: previous.rejected + rejected, active, queue,
    areaMs: previous.areaMs + 10 * (previous.active.length + previous.queue.length),
    completedResidenceMs: previous.completedResidenceMs + finished.reduce((sum, r) => sum + timeMs - r.arrived, 0),
    lastCompleted: finished.length, lastArrivals: incoming, lastRejected: rejected };
}
export function run(config: Config, ticks: number): State {
  let state = initial();
  for (let i = 0; i < ticks; i++) state = step(state, config);
  return state;
}
export function metrics(state: State) {
  return { averageL: state.timeMs ? state.areaMs / state.timeMs : 0,
    throughput: state.timeMs ? state.completed / (state.timeMs / 1000) : 0,
    completedW: state.completed ? state.completedResidenceMs / state.completed : 0,
    unfinished: state.active.length + state.queue.length };
}
export function predictionOutcome(config: Config): 'grow' | 'reject' | 'clear' {
  const overload = meanInFlight(config.qps, config.serviceMs) > config.capacity;
  return overload ? config.admission === 'queue' ? 'grow' : 'reject' : 'clear';
}
