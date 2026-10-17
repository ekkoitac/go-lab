export type RejectionPolicy = 'good' | 'bad';
export type Outcome = 'paid' | 'rejected' | 'failed' | 'cancelled';
export interface Payment { id: string; acceptedAt: number; eligible: boolean; http: number; outcome?: Outcome; terminalAt?: number }
export interface Config { slowMinutes: number; rejection: RejectionPolicy }
export const defaultConfig: Config = { slowMinutes: 6, rejection: 'good' };
export function payments(config: Config): Payment[] {
  return [
    { id: 'A', acceptedAt: 0, eligible: true, http: 202, outcome: 'paid', terminalAt: 2 },
    { id: 'B', acceptedAt: 0, eligible: true, http: 202, outcome: 'paid', terminalAt: config.slowMinutes },
    { id: 'C', acceptedAt: 1, eligible: true, http: 202, outcome: 'rejected', terminalAt: 3 },
    { id: 'D', acceptedAt: 1, eligible: true, http: 202, outcome: 'failed', terminalAt: 2 },
    { id: 'E', acceptedAt: 1, eligible: false, http: 400 },
    { id: 'F', acceptedAt: 2, eligible: true, http: 202, outcome: 'paid', terminalAt: 3 },
    { id: 'G', acceptedAt: 1, eligible: true, http: 202, outcome: 'cancelled', terminalAt: 3 },
  ];
}
export function classify(payment: Payment, now: number, policy: RejectionPolicy, window: [number, number] = [0, 2], deadline = 5) {
  if (payment.acceptedAt > now) return { status: '未到达', denominator: 0, good: 0 };
  if (!payment.eligible) return { status: '资格不符：排除', denominator: 0, good: 0 };
  if (payment.acceptedAt < window[0] || payment.acceptedAt >= window[1]) return { status: '属于其他受理窗口', denominator: 0, good: 0 };
  if (now - payment.acceptedAt < deadline) return { status: '未成熟：暂缓计入', denominator: 0, good: 0 };
  const timely = payment.terminalAt !== undefined && payment.terminalAt <= payment.acceptedAt + deadline;
  const good = timely && (payment.outcome === 'paid' || (payment.outcome === 'rejected' && policy === 'good'));
  return { status: good ? '好事件：期限内符合约定的终态' : !timely ? '坏事件：期限内未到终态' : '坏事件：终态不符合约定', denominator: 1, good: Number(good) };
}
export function snapshot(config: Config, now: number) {
  const rows = payments(config).map(payment => ({ ...payment, ...classify(payment, now, config.rejection) }));
  const denominator = rows.reduce((sum, row) => sum + row.denominator, 0);
  const good = rows.reduce((sum, row) => sum + row.good, 0);
  const accepted = rows.filter(row => row.acceptedAt <= now && row.http === 202);
  return { now, rows, denominator, good, ratio: denominator ? good / denominator : null, acceptedHttpSuccess: accepted.length ? 1 : null };
}
