export type Config = { hot: boolean; jitter: boolean; merge: boolean; gate: boolean; budget: number; spread: number };
export const defaults: Config = { hot: false, jitter: false, merge: false, gate: false, budget: 4, spread: 60 };
export const capacity = 4;
export const times = [300, 310, 320, 330, 340, 350, 360];
export type Window = { time: number; keys: string[]; requests: number; queries: number; admitted: number; rejected: number; overloaded: number; completed: number; merged: number };
export function keyBucket(key: string, spread: number): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const slots = Math.floor(Math.min(60, Math.max(0, spread)) / 10) + 1;
  return hash % slots;
}
export function expiry(config: Config): { key: string; time: number; readers: number }[] {
  return Array.from({ length: config.hot ? 1 : 12 }, (_, i) => {
    const key = `key-${i + 1}`;
    return { key, time: 300 + (config.jitter ? keyBucket(key, config.spread) * 10 : 0), readers: config.hot ? 12 : 1 };
  });
}
export function simulate(config: Config): Window[] {
  const keys = expiry(config);
  return times.map(time => {
    const expired = keys.filter(item => item.time === time);
    const requests = expired.reduce((sum, item) => sum + item.readers, 0);
    const queries = config.merge ? expired.length : requests;
    const admitted = config.gate ? Math.min(queries, Math.max(0, Math.floor(config.budget))) : queries;
    return { time, keys: expired.map(item => item.key), requests, queries, admitted,
      rejected: queries - admitted, overloaded: Math.max(0, admitted - capacity), completed: Math.min(admitted, capacity), merged: requests - queries };
  });
}
export function peak(config: Config): number { return Math.max(...simulate(config).map(w => w.admitted)); }
export type LabState = { config: Config; cursor: number; prediction: '' | 'safe' | 'overload'; reason: string; submitted: boolean };
export function initial(config: Config = defaults): LabState { return { config: { ...config }, cursor: -1, prediction: '', reason: '', submitted: false }; }
export type Action = { type: 'configure'; patch: Partial<Config> } | { type: 'predict'; value: LabState['prediction'] } | { type: 'reason'; value: string } | { type: 'step' | 'back' | 'reset' };
export function transition(s: LabState, action: Action): LabState {
  if (action.type === 'configure') return initial({ ...s.config, ...action.patch });
  if (action.type === 'reset') return initial(s.config);
  if (action.type === 'predict') return s.submitted ? s : { ...s, prediction: action.value };
  if (action.type === 'reason') return s.submitted ? s : { ...s, reason: action.value };
  if (action.type === 'back') return { ...s, cursor: Math.max(-1, s.cursor - 1) };
  if (!s.prediction || !s.reason.trim() || s.cursor >= times.length - 1) return s;
  return { ...s, cursor: s.cursor + 1, submitted: true };
}
