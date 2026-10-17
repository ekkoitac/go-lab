export type Config = { instances: number; groups: number; keys: number; overlap: boolean; cache: boolean };
export const defaults: Config = { instances: 20, groups: 1, keys: 1, overlap: true, cache: false };
export const readers = 3;
export type Snapshot = { phase: number; wave: number; origin: number; running: number; waiting: number; returned: number; cacheHits: number; perInstance: number };
export function snapshot(config: Config, phase: number): Snapshot {
  const cells = config.instances * config.groups * config.keys;
  const calls = cells * readers;
  const work = cells * (config.overlap ? 1 : readers);
  const p = Math.max(0, Math.min(4, phase));
  const started = p >= 1;
  const second = p >= 3;
  const secondWork = config.cache ? 0 : work;
  const running = (p === 1 || p === 3) && !(p === 3 && config.cache) ? cells : 0;
  return {
    phase: p, wave: second ? 2 : started ? 1 : 0,
    origin: !started ? 0 : (p === 1 && !config.overlap ? cells : work) + (second ? (p === 3 && !config.overlap && !config.cache ? cells : secondWork) : 0),
    running,
    waiting: config.overlap ? running * (readers - 1) : 0,
    returned: p >= 4 ? calls * 2 : p >= 2 ? calls + (second && config.cache ? calls : 0) : 0,
    cacheHits: second && config.cache ? calls : 0,
    perInstance: config.groups * config.keys * (config.overlap ? 1 : readers),
  };
}
export type State = { config: Config; phase: number; prediction: string; reason: string; submitted: boolean };
export function initial(config: Config = defaults): State { return { config: { ...config }, phase: 0, prediction: '', reason: '', submitted: false }; }
export type Action = { type: 'configure'; patch: Partial<Config> } | { type: 'predict' | 'reason'; value: string } | { type: 'step' | 'back' | 'reset' };
export function transition(state: State, action: Action): State {
  if (action.type === 'configure') return initial({ ...state.config, ...action.patch });
  if (action.type === 'reset') return initial();
  if (action.type === 'predict') return state.submitted ? state : { ...state, prediction: action.value };
  if (action.type === 'reason') return state.submitted ? state : { ...state, reason: action.value };
  if (action.type === 'back') return { ...state, phase: Math.max(0, state.phase - 1) };
  if (!state.reason.trim() || !/^\d+$/.test(state.prediction)) return state;
  return { ...state, submitted: true, phase: Math.min(4, state.phase + 1) };
}
export function leaseSnapshot(step: number, fencing: boolean) {
  return { step, holder: step === 0 ? 'A' : 'B', token: step === 0 ? 1 : 2, oldAStillRunning: step < 3, queries: step === 0 ? 1 : 2, value: step < 2 ? '空' : step === 2 || fencing ? 'B 的新值' : 'A 的旧值', rejected: step === 3 && fencing };
}
