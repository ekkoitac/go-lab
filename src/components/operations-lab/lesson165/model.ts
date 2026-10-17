export interface Config { gogc: number; live: number; roots: number; allocation: number; softLimit: number }
export const defaults: Config = { gogc: 100, live: 200, roots: 20, allocation: 220, softLimit: 1000 };
export type Direction = 'lower' | 'same' | 'higher';
export const otherRuntime = 80;
export function inspect(input: Config) {
  const c = { ...input };
  for (const value of Object.values(c)) if (!Number.isFinite(value) || value < 0) throw new Error('参数必须是有限的非负数');
  if (c.gogc === 0 || c.live === 0) throw new Error('此模型只接受正 GOGC 和正存活堆');
  const requestedGrowth = (c.live + c.roots) * c.gogc / 100;
  const availableGrowth = Math.max(0, c.softLimit - otherRuntime - c.roots - c.live);
  const growth = Math.min(requestedGrowth, availableGrowth);
  const constrained = growth < requestedGrowth;
  const infeasible = growth === 0;
  // Steady-state rates, not integer events or real Go pacer timings.
  const cyclesPerSecond = infeasible ? null : c.allocation / growth;
  const scanWork = cyclesPerSecond === null ? null : cyclesPerSecond * (c.live + c.roots);
  return { config: c, requestedGrowth, availableGrowth, growth, constrained, infeasible,
    target: c.live + growth, accountedMemory: c.live + growth + c.roots + otherRuntime,
    cyclesPerSecond, scanWork };
}
export type Reading = ReturnType<typeof inspect>;
export function direction(base: Reading, next: Reading): Direction | 'infeasible' {
  if (next.scanWork === null || base.scanWork === null) return 'infeasible';
  if (Math.abs(next.scanWork - base.scanWork) < 0.000001) return 'same';
  return next.scanWork < base.scanWork ? 'lower' : 'higher';
}
export interface Observation { config: Config; prediction: Direction | 'infeasible'; reason: string; actual: Direction | 'infeasible' }
export function record(history: Observation[], config: Config, prediction: Direction | 'infeasible', reason: string): Observation[] {
  if (!reason.trim()) return history;
  return [...history, {config: {...config}, prediction, reason: reason.trim(), actual: direction(inspect(defaults), inspect(config))}];
}
export function rewind(history: Observation[]) { return history.slice(0, -1); }

