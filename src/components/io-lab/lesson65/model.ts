export type Config = { length: number; limit: number; fault: boolean };
export type Verdict = 'pending' | 'accept' | 'oversize' | 'error';
export type Lane = { budget: number; read: number; remaining: number; bytes: string; eof: 'none' | 'limit' | 'source'; error: boolean; done: boolean; verdict: Verdict; event: string };
export const defaults: Config = { length: 8, limit: 4, fault: false };
export function normalize(c: Config): Config { return { length: Math.max(0, Math.min(12, Math.floor(c.length))), limit: Math.max(1, Math.min(8, Math.floor(c.limit))), fault: c.fault }; }
export function lane(c: Config, tick: number, extra: boolean): Lane {
  c = normalize(c);
  const budget = c.limit + Number(extra);
  // The simulated reader returns one ASCII byte per Read; byte 2 may carry a non-EOF error.
  const fault = c.fault && c.length >= 2 && budget >= 2;
  const count = Math.min(c.length, budget, fault ? 2 : Infinity);
  const stoppedAt = fault ? count : count + 1;
  const read = Math.min(Math.max(0, tick), count);
  const stopped = tick >= stoppedAt;
  const done = tick > stoppedAt;
  const eof = stopped && !fault ? (budget <= c.length ? 'limit' : 'source') : 'none';
  const error = stopped && fault;
  const verdict: Verdict = !done ? 'pending' : error ? 'error' : extra && read > c.limit ? 'oversize' : 'accept';
  const event = tick === 0 ? '尚未读取' : done ? '先检查读取错误，再比较 len(b) 与 N' : error ? '本次返回 n=1 与读取错误：字节已收到，但整次输入不可接受' : stopped ? eof === 'limit' ? 'LimitReader 预算耗尽，返回 EOF；未询问源是否结束' : '底层源返回 EOF，确认已读完' : `本次返回 n=1, err=nil；累计 ${read} 字节`;
  return { budget, read, remaining: c.length - read, bytes: 'ABCDEFGHIJKL'.slice(0, read), eof, error, done, verdict, event };
}
export function endTick(c: Config): number { const n = normalize(c); return n.fault && n.length >= 2 ? 3 : Math.min(n.length, n.limit + 1) + 2; }
export function snapshot(c: Config, tick: number) { return { config: normalize(c), tick, limited: lane(c, tick, false), probe: lane(c, tick, true) }; }
export const verdictText: Record<Verdict, string> = { pending: '尚未判定', accept: '接受', oversize: '拒绝：too large', error: '拒绝：读取错误' };
