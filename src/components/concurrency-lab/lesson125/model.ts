export type Tenant = 'A' | 'B';
export interface Config { a: number; b: number; slots: number; costA: number; costB: number }
export interface Job { id: string; tenant: Tenant; cost: number }
export interface Run { waiting: Job[]; selected: Job[]; next: Tenant }
export interface State { config: Config; fifo: Run; roundRobin: Run; step: number }
export const defaults: Config = { a: 3, b: 1, slots: 3, costA: 1, costB: 1 };
export function initial(config: Config = defaults): State {
  const jobs: Job[] = (['A', 'B'] as Tenant[]).flatMap(tenant => Array.from({ length: tenant === 'A' ? config.a : config.b }, (_, i) => ({ id: `${tenant}${i + 1}`, tenant, cost: tenant === 'A' ? config.costA : config.costB })));
  return { config: { ...config }, fifo: { waiting: [...jobs], selected: [], next: 'A' }, roundRobin: { waiting: [...jobs], selected: [], next: 'A' }, step: 0 };
}
export function nextTenant(run: Run): Tenant | null { return run.waiting.find(j => j.tenant === run.next)?.tenant ?? run.waiting[0]?.tenant ?? null; }
function dispatch(run: Run, fair: boolean): Run {
  const index = fair ? run.waiting.findIndex(j => j.tenant === nextTenant(run)) : 0;
  if (index < 0 || !run.waiting.length) return run;
  const job = run.waiting[index];
  return { waiting: run.waiting.filter((_, i) => i !== index), selected: [...run.selected, job], next: job.tenant === 'A' ? 'B' : 'A' };
}
export function step(state: State): State {
  if (state.step >= state.config.slots || !state.fifo.waiting.length) return state;
  return { ...state, fifo: dispatch(state.fifo, false), roundRobin: dispatch(state.roundRobin, true), step: state.step + 1 };
}
export function finish(config: Config): State { let state = initial(config); while (step(state) !== state) state = step(state); return state; }
export function totals(run: Run, tenant: Tenant) { const jobs = run.selected.filter(j => j.tenant === tenant); return { count: jobs.length, cost: jobs.reduce((sum, job) => sum + job.cost, 0) }; }
