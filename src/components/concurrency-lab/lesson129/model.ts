export type Strategy = 'fields' | 'reload' | 'once';
export type Timing = 'before' | 'between' | 'after';
export type Outcome = 'old' | 'new' | 'mixed';
export type Pair = { limit: number; burst: number };
export type Config = { strategy: Strategy; timing: Timing; variant: number };
export type Event = 'readLimit' | 'readBurst' | 'writeLimit' | 'writeBurst' | 'publish';
export type Read = { value: number; version: 1 | 2 };
export type State = {
  cursor: number; published: 1 | 2; limit: Read; burst: Read;
  held: 1 | 2 | null; readLimit: Read | null; readBurst: Read | null; log: string[];
};
export const versions = (variant: number): [Pair, Pair] => variant === 1
  ? [{ limit: 2, burst: 4 }, { limit: 9, burst: 18 }]
  : [{ limit: 10, burst: 20 }, { limit: 30, burst: 40 }];
export function schedule(config: Config): Event[] {
  const writes: Event[] = config.strategy === 'fields' ? ['writeLimit', 'writeBurst'] : ['publish'];
  if (config.timing === 'before') return [...writes, 'readLimit', 'readBurst'];
  if (config.timing === 'after') return ['readLimit', 'readBurst', ...writes];
  return ['readLimit', ...writes, 'readBurst'];
}
export function initial(config: Config): State {
  const [old] = versions(config.variant);
  return { cursor: 0, published: 1, limit: { value: old.limit, version: 1 }, burst: { value: old.burst, version: 1 }, held: null, readLimit: null, readBurst: null, log: [] };
}
export function step(config: Config, previous: State): State {
  const action = schedule(config)[previous.cursor];
  if (!action) return previous;
  const s = { ...previous, cursor: previous.cursor + 1, log: [...previous.log] };
  const pair = versions(config.variant);
  if (action === 'writeLimit') { s.limit = { value: pair[1].limit, version: 2 }; s.log.push(`写者：limit.Store(${s.limit.value})；burst 尚未更新。`); }
  if (action === 'writeBurst') { s.burst = { value: pair[1].burst, version: 2 }; s.log.push(`写者：burst.Store(${s.burst.value})；两个字段现已更新。`); }
  if (action === 'publish') { s.published = 2; s.log.push('写者：Store(完整 V2)；V1 对象仍保持不可变。'); }
  if (action === 'readLimit' || action === 'readBurst') {
    const field = action === 'readLimit' ? 'limit' : 'burst';
    if (config.strategy === 'once' && s.held === null) s.held = s.published;
    const version = config.strategy === 'once' ? s.held! : s.published;
    const read: Read = config.strategy === 'fields' ? { ...s[field] } : { value: pair[version - 1][field], version };
    s[action] = read;
    s.log.push(`读者：${field} = ${read.value}，来自 V${read.version}${config.strategy === 'once' ? '（沿用同一次 Load）' : config.strategy === 'reload' ? '（本次重新 Load）' : '（独立原子读取）'}。`);
  }
  return s;
}
export function at(config: Config, count: number): State {
  let state = initial(config);
  for (let i = 0; i < Math.max(0, Math.min(count, schedule(config).length)); i++) state = step(config, state);
  return state;
}
export function outcome(state: State): Outcome | null {
  if (!state.readLimit || !state.readBurst) return null;
  return state.readLimit.version !== state.readBurst.version ? 'mixed' : state.readLimit.version === 1 ? 'old' : 'new';
}
export const eventLabels: Record<Event, string> = { readLimit: '读 limit', readBurst: '读 burst', writeLimit: '写 limit', writeBurst: '写 burst', publish: '发布 V2' };
