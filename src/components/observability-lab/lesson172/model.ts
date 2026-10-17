export type Counts = { requests: number; errors: number };
export type Input = { slo: number; previous: Counts; recent: Counts };
export type Route = 'insufficient' | 'observe' | 'task' | 'page';
export const labels: Record<Route, string> = { insufficient: '证据不足', observe: '继续观察', task: '创建修复任务', page: '唤醒值班（分页）' };
export const policy = { minimumRequests: 100, slowBurn: 2, fastBurn: 14 };
export function validCounts(c: Counts): boolean { return Number.isSafeInteger(c.requests) && Number.isSafeInteger(c.errors) && c.requests >= 0 && c.errors >= 0 && c.errors <= c.requests; }
export function assess(input: Input) {
  if (!Number.isFinite(input.slo) || input.slo <= 0 || input.slo >= 1 || !validCounts(input.previous) || !validCounts(input.recent)) throw new Error('SLO 必须介于 0 和 1；请求、错误必须是非负整数且错误不超过请求。');
  const long = { requests: input.previous.requests + input.recent.requests, errors: input.previous.errors + input.recent.errors };
  if (!Number.isSafeInteger(long.requests) || !Number.isSafeInteger(long.errors)) throw new Error('总计超出安全整数范围。');
  const allowed = 1 - input.slo;
  const rate = (c: Counts) => c.requests === 0 ? null : c.errors / c.requests;
  const longRate = rate(long), shortRate = rate(input.recent);
  const longBurn = longRate === null ? null : longRate / allowed, shortBurn = shortRate === null ? null : shortRate / allowed;
  const enough = long.requests >= policy.minimumRequests && input.recent.requests >= policy.minimumRequests;
  const meets = (value: number, threshold: number) => value >= threshold - 1e-10;
  const route: Route = !enough ? 'insufficient' : meets(longBurn!, policy.fastBurn) && meets(shortBurn!, policy.fastBurn) ? 'page' : meets(longBurn!, policy.slowBurn) && meets(shortBurn!, policy.slowBurn) ? 'task' : 'observe';
  const longOnly: Route = longBurn === null ? 'insufficient' : meets(longBurn, policy.fastBurn) ? 'page' : meets(longBurn, policy.slowBurn) ? 'task' : 'observe';
  const reason = !enough ? '至少一个窗口少于 100 次请求；高比率或零请求都不足以证明服务状态，应补充事件量或有界合成探测。' : route === 'page' ? '长、短窗均达到 14 倍，持续快速消耗预算；需要立即响应。' : route === 'task' ? '长、短窗均达到 2 倍，但未共同达到 14 倍；持续慢消耗需要修复任务。' : longBurn! >= policy.slowBurn && shortBurn! < policy.slowBurn ? '长窗仍保留历史错误，但短窗已低于慢消耗线；不因历史故障再次唤醒，继续确认恢复。' : '两个窗口未共同满足消耗阈值；单次突发或低燃烧不足以触发本模型的通知。';
  return { long, allowed, longRate, shortRate, longBurn, shortBurn, enough, route, longOnly, reason };
}
export const scenarios: Record<string, { title: string; input: Input }> = {
  slow: { title: '白天持续 0.5% 错误', input: { slo: .999, previous: { requests: 11000, errors: 55 }, recent: { requests: 1000, errors: 5 } } },
  fast: { title: '持续快速消耗', input: { slo: .999, previous: { requests: 11000, errors: 220 }, recent: { requests: 1000, errors: 20 } } },
  recovered: { title: '旧故障已恢复', input: { slo: .999, previous: { requests: 11000, errors: 220 }, recent: { requests: 1000, errors: 0 } } },
  sparse: { title: '凌晨 2 次请求错 1 次', input: { slo: .999, previous: { requests: 20, errors: 0 }, recent: { requests: 2, errors: 1 } } },
  idle: { title: '最近没有请求', input: { slo: .999, previous: { requests: 1000, errors: 0 }, recent: { requests: 0, errors: 0 } } },
};
export const percent = (n: number | null) => n === null ? '不可计算' : `${(n * 100).toFixed(3)}%`;
export const multiple = (n: number | null) => n === null ? '未知' : `${n.toFixed(2)} 倍`;
