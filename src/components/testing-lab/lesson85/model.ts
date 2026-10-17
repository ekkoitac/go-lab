export type Protection = 'none' | 'split' | 'whole';
export type Actor = 'A' | 'B';
export type Access = { actor: Actor; kind: 'read' | 'write'; value: number };
export interface RaceState { initial: number; value: number; protection: Protection; executed: boolean; phases: Record<Actor, 0 | 1 | 2>; local: Record<Actor, number | null>; owner: Actor | null; accesses: Access[]; log: string[] }
export function createRaceState(protection: Protection = 'none', initial = 0, executed = true): RaceState {
  return { initial, value: initial, protection, executed, phases: { A: 0, B: 0 }, local: { A: null, B: null }, owner: null, accesses: [], log: [] };
}
export function canStep(s: RaceState, actor: Actor): boolean { return s.executed && s.phases[actor] < 2 && (s.owner === null || s.owner === actor); }
export function stepRace(s: RaceState, actor: Actor): RaceState {
  if (!canStep(s, actor)) return s;
  const reading = s.phases[actor] === 0;
  const value = reading ? s.value : s.local[actor]! + 1;
  const protection = s.protection === 'whole' ? reading ? '持有整段更新的锁' : '写完才释放锁' : s.protection === 'split' ? '本次访问加锁后立即解锁' : '没有同步保护';
  return { ...s, value: reading ? s.value : value, phases: { ...s.phases, [actor]: reading ? 1 : 2 }, local: { ...s.local, [actor]: reading ? value : s.local[actor] }, owner: s.protection === 'whole' && reading ? actor : null, accesses: [...s.accesses, { actor, kind: reading ? 'read' : 'write', value }], log: [...s.log, reading ? `${actor} 读到共享值 ${value}，保存到自己的临时变量；${protection}。` : `${actor} 按自己的旧值 ${s.local[actor]} + 1 写回 ${value}，共享值从 ${s.value} 变为 ${value}；${protection}。`] };
}
export function raceEvidence(s: RaceState): boolean { return s.protection === 'none' && s.accesses.some((a, i) => s.accesses.slice(i + 1).some(b => a.actor !== b.actor && (a.kind === 'write' || b.kind === 'write'))); }
export function completed(s: RaceState): boolean { return !s.executed || s.phases.A === 2 && s.phases.B === 2; }
export function runSchedule(protection: Protection, actors: Actor[], initial = 0, executed = true): RaceState { return actors.reduce(stepRace, createRaceState(protection, initial, executed)); }
export function nextActor(s: RaceState): Actor { if (s.owner) return s.owner; return s.phases.A <= s.phases.B && s.phases.A < 2 ? 'A' : 'B'; }
