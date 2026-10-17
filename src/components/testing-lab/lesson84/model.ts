export type ClockSource = 'fixed' | 'live';
export type Rule = 'before' | 'not-after';
export interface ClockConfig { offset: number; delay: number; source: ClockSource; rule: Rule }
export interface Observation { sampledOffset: number; before: boolean; notAfter: boolean; actual: boolean; expected: boolean; pass: boolean }
export const baseline: ClockConfig = { offset: 0, delay: 0, source: 'fixed', rule: 'not-after' };
// Teaching model: small integer offsets in nanoseconds relative to expiry.
// This deliberately does not use JS Date, execute Go, or simulate a real scheduler.
export function observe(config: ClockConfig): Observation {
  if (![config.offset, config.delay].every(Number.isSafeInteger) || config.delay < 0) throw new Error('时间必须为安全整数，调度延迟不能为负');
  const sampledOffset = config.offset + (config.source === 'live' ? config.delay : 0);
  if (!Number.isSafeInteger(sampledOffset)) throw new Error('时间超出模型范围');
  const before = sampledOffset < 0;
  const notAfter = sampledOffset <= 0;
  const actual = config.rule === 'before' ? before : notAfter;
  const expected = before;
  return { sampledOffset, before, notAfter, actual, expected, pass: actual === expected };
}
export const offsetLabel = (offset: number) => offset === 0 ? '恰好到期（0 ns）' : `${offset < 0 ? '到期前' : '到期后'} ${Math.abs(offset)} ns`;
export function canReveal(prediction: string, reason: string): boolean { return (prediction === 'true' || prediction === 'false') && reason.trim().length > 0; }
export function contractResult(offset: number, inclusive: boolean): boolean { return inclusive ? offset <= 0 : offset < 0; }
