export type Storage = 'shared' | 'isolated';
export type Event = 'write' | 'clear' | 'read';
export type Schedule = 'read-first' | 'write-read-clear' | 'write-clear-read';
export type Outcome = 'initial' | 'written' | 'missing';
export const schedules: Record<Schedule, Event[]> = {
  'read-first': ['read', 'write', 'clear'],
  'write-read-clear': ['write', 'read', 'clear'],
  'write-clear-read': ['write', 'clear', 'read'],
};
export interface FixtureState {
  storage: Storage;
  refs: {a: string; b: string};
  maps: Record<string, {count?: number}>;
  initial: number;
  written: number;
  read: {value: number; exists: boolean; outcome: Outcome} | null;
  history: Event[];
}
export function createFixture(storage: Storage, initial = 0, written = 1): FixtureState {
  return {storage, refs: {a: storage === 'shared' ? 'shared' : 'map-A', b: storage === 'shared' ? 'shared' : 'map-B'},
    maps: storage === 'shared' ? {shared: {count: initial}} : {'map-A': {count: initial}, 'map-B': {count: initial}},
    initial, written, read: null, history: []};
}
export function applyEvent(state: FixtureState, event: Event): FixtureState {
  if (state.history.includes(event) || (event === 'clear' && !state.history.includes('write'))) return state;
  const maps = Object.fromEntries(Object.entries(state.maps).map(([key, value]) => [key, {...value}]));
  let read = state.read;
  if (event === 'write') maps[state.refs.a].count = state.written;
  if (event === 'clear') delete maps[state.refs.a].count;
  if (event === 'read') {
    const value = maps[state.refs.b].count;
    read = {value: value ?? 0, exists: value !== undefined,
      outcome: value === undefined ? 'missing' : state.storage === 'shared' && state.history.includes('write') ? 'written' : 'initial'};
  }
  return {...state, maps, read, history: [...state.history, event]};
}
export function replay(storage: Storage, schedule: Schedule, count = 3, initial = 0, written = 1): FixtureState {
  return schedules[schedule].slice(0, Math.max(0, count)).reduce(applyEvent, createFixture(storage, initial, written));
}
export function nestedFixture(copy: 'shallow' | 'deep', initial: number, replacement: number) {
  const original = {items: [initial]};
  const a = copy === 'deep' ? {items: [...original.items]} : {...original};
  const b = copy === 'deep' ? {items: [...original.items]} : {...original};
  a.items[0] = replacement;
  return {a: a.items[0], b: b.items[0], sameArray: a.items === b.items, original: original.items[0]};
}
