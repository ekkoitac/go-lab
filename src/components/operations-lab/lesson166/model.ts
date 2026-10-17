export type Config = {limit: number; period: number; procs: number; automatic: boolean; host: number; affinity: number; requests: number; workers: number};
export const defaults: Config = {limit: 2, period: 100, procs: 64, automatic: false, host: 64, affinity: 64, requests: 1, workers: 128};
/** Go 1.26 default: Linux, enabled cgroup awareness and modern compatibility settings. */
export function defaultProcs(c: Pick<Config, 'limit'|'host'|'affinity'>): number {
  return Math.min(c.host, c.affinity, Math.max(2, Math.ceil(c.limit)));
}
export function effectiveProcs(c: Config): number { return c.automatic ? defaultProcs(c) : c.procs; }
export type Slice = {from: number; to: number; runMs: number; throttledMs: number; consumed: number; parallel: number};
export type State = {config: Config; time: number; budget: number; consumed: number; throttled: number; slices: Slice[]};
export function initial(config: Config = defaults): State {
  return {config: {...config}, time: 0, budget: config.limit * config.period, consumed: 0, throttled: 0, slices: []};
}
/** One bounded quota period, saturated independent CPU work; no bursts or other workloads. */
export function step(s: State): State {
  const c = s.config;
  if (s.time >= c.period) return s;
  const dt = Math.min(10, c.period - s.time);
  const parallel = Math.min(effectiveProcs(c), c.host, c.affinity, c.workers);
  const runMs = Math.min(dt, s.budget / parallel);
  const consumed = runMs * parallel;
  const throttledMs = dt - runMs;
  const slice = {from: s.time, to: s.time + dt, runMs, throttledMs, consumed, parallel};
  return {...s, time: s.time + dt, budget: Math.max(0, s.budget - consumed), consumed: s.consumed + consumed, throttled: s.throttled + throttledMs, slices: [...s.slices, slice]};
}
export function at(config: Config, steps: number): State {
  let s = initial(config);
  for (let i=0; i<steps && s.time<config.period; i++) s=step(s);
  return s;
}
export function back(s: State): State { return at(s.config, Math.max(0, s.slices.length - 1)); }
export function runPeriod(config: Config): State { return at(config, Math.ceil(config.period / 10)); }
export type RuntimeState = {config: Config; actual: number; observedLimit: number; checks: number};
export function startRuntime(config: Config): RuntimeState {return {config: {...config}, actual: effectiveProcs(config), observedLimit: config.limit, checks: 0};}
export function changeLimit(s: RuntimeState, limit: number): RuntimeState {return {...s, config: {...s.config, limit}};}
/** User-triggered eligible poll, not tied to cgroup quota replenishment periods. */
export function pollRuntime(s: RuntimeState): RuntimeState {return {...s, actual: s.config.automatic ? defaultProcs(s.config) : s.actual, observedLimit: s.config.limit, checks: s.checks + 1};}
export function restoreDefault(s: RuntimeState): RuntimeState {return {...s, config: {...s.config, automatic: true}, actual: defaultProcs(s.config), observedLimit: s.config.limit};}
