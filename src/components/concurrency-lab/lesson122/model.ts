export type Policy = 'shared' | 'renewed';
export type TaskStatus = 'queued' | 'running' | 'ok' | 'timeout' | 'cancelled';
export interface Config { queue: number; slots: number; retry: boolean }
export interface Call { id: 'price' | 'stock' | 'recommend'; label: string; required: boolean; duration: number; status: TaskStatus; attempt: number; start: number | null; deadline: number | null; end: number | null; spans: { start: number; end: number; retry: boolean }[] }
export interface State { config: Config; policy: Policy; now: number; calls: Call[]; peak: number; response: 'waiting' | 'ok' | 'failed' | 'deadline'; responseAt: number | null; assemblyAt: number | null; notes: string[] }
export const ROOT_DEADLINE = 300;
export const RESERVE = 20;
export const defaults: Config = { queue: 80, slots: 2, retry: false };
export function initial(config: Config = defaults, policy: Policy = 'shared'): State {
  const safe = { queue: Math.max(0, Math.min(320, Math.round(config.queue / 20) * 20)), slots: Math.max(1, Math.min(3, Math.round(config.slots))), retry: config.retry };
  const state: State = { config: safe, policy, now: 0, calls: [
    { id: 'price', label: '价格', required: true, duration: 100 },
    { id: 'stock', label: '库存', required: true, duration: 120 },
    { id: 'recommend', label: '推荐', required: false, duration: 260 },
  ].map(call => ({ ...call, id: call.id as Call['id'], status: 'queued', attempt: 0, start: null, deadline: null, end: null, spans: [] })), peak: 0, response: 'waiting', responseAt: null, assemblyAt: null, notes: ['请求进入队列；总预算从 0ms 开始计时。'] };
  schedule(state);
  return state;
}
function schedule(s: State) {
  if (s.now < s.config.queue || (s.policy === 'shared' && s.now >= ROOT_DEADLINE - RESERVE)) return;
  let available = s.config.slots - s.calls.filter(c => c.status === 'running').length;
  for (const call of s.calls) {
    if (call.status !== 'queued' || available <= 0) continue;
    available--;
    call.status = 'running'; call.attempt++; call.start = s.now;
    call.deadline = s.policy === 'shared' ? Math.min(280, call.required ? 280 : s.now + 80) : s.now + 300;
    s.notes.push(`${call.label}第 ${call.attempt} 次开始：截止 ${call.deadline}ms，可用 ${call.deadline - s.now}ms。`);
  }
  s.peak = Math.max(s.peak, s.calls.filter(c => c.status === 'running').length);
}
function close(call: Call, now: number, status: TaskStatus) {
  if (call.start !== null && call.status === 'running') call.spans.push({ start: call.start, end: now, retry: call.attempt > 1 });
  call.status = status; call.end = now;
}
export function advance(previous: State): State {
  if (finished(previous)) return previous;
  const s: State = structuredClone(previous);
  s.now += 20; s.notes = [];
  for (const call of s.calls) {
    if (call.status !== 'running' || call.start === null || call.deadline === null) continue;
    // Exact deadline ties deliberately resolve as timeout in this teaching model.
    if (s.now >= call.deadline) {
      close(call, s.now, 'timeout');
      s.notes.push(`${call.label}到达截止时间；${call.required ? '核心依赖不完整' : '可选推荐降级为空'}。`);
    } else if (s.config.retry && call.id === 'price' && call.attempt === 1 && s.now - call.start >= 60) {
      close(call, s.now, 'queued');
      s.notes.push('价格第一次调用在 60ms 后失败，重试重新竞争并发额度。');
    } else if (s.now - call.start >= call.duration) {
      close(call, s.now, 'ok'); s.notes.push(`${call.label}返回成功。`);
    }
  }
  if (s.policy === 'shared' && s.now >= 280) {
    for (const call of s.calls) if (call.status === 'queued') { close(call, s.now, 'cancelled'); s.notes.push(`${call.label}仍在排队，剩余时间必须留给组装，取消启动。`); }
  }
  schedule(s);
  const settled = s.calls.every(c => c.status !== 'queued' && c.status !== 'running');
  if (settled && s.assemblyAt === null) {
    s.assemblyAt = s.now + RESERVE;
    s.notes.push('所有依赖已结束，开始 20ms 响应组装。');
  }
  if (s.response === 'waiting') {
    if (s.assemblyAt !== null && s.now >= s.assemblyAt) {
      s.response = s.calls.filter(c => c.required).every(c => c.status === 'ok') ? 'ok' : 'failed';
      s.responseAt = s.now;
    } else if (s.now >= ROOT_DEADLINE) {
      s.response = 'deadline'; s.responseAt = ROOT_DEADLINE;
      s.notes.push('客户端 300ms 总预算耗尽。重置局部预算的调用仍可能占用资源。');
    }
  }
  if (!s.notes.length) s.notes.push(s.now < s.config.queue ? '仍在排队，根预算继续减少。' : '调用正在占用并发额度；时间继续消耗。');
  return s;
}
export function finished(s: State) { return s.response !== 'waiting' && s.calls.every(c => c.status !== 'queued' && c.status !== 'running'); }
export function run(config: Config, policy: Policy): State {
  let s = initial(config, policy);
  for (let i = 0; i < 100 && !finished(s); i++) s = advance(s);
  return s;
}
export function at(config: Config, policy: Policy, steps: number): State {
  let s = initial(config, policy);
  for (let i = 0; i < steps && !finished(s); i++) s = advance(s);
  return s;
}

