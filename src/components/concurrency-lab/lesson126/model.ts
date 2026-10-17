export type Policy = 'fake' | 'reject' | 'wait' | 'drop';
export type Result = 'ready' | 'waiting' | 'accepted' | 'rejected' | 'false-success' | 'dropped' | 'forbidden' | 'cancelled' | 'expired';
export interface Model { policy: Policy; lossy: boolean; budget: number; time: number; queue: string[]; completed: string[]; result: Result; cancelled: boolean; log: string[] }
export type Action = 'offer' | 'release' | 'tick' | 'cancel' | 'retry';
export const names: Record<Result, string> = { ready: '尚未提交', waiting: '等待容量', accepted: '已接收 B', rejected: '忙碌，未接收', 'false-success': '假成功：未入队却确认', dropped: '已明确丢弃 B', forbidden: '禁止丢弃：业务不允许', cancelled: '已取消，未接收', expired: '期限到，未接收' };
export function initial(policy: Policy = 'fake', lossy = false, budget = 2): Model {
  if (!Number.isInteger(budget) || budget < 1 || budget > 5) throw new Error('预算必须为 1 至 5 步');
  return { policy, lossy, budget, time: 0, queue: ['A'], completed: [], result: 'ready', cancelled: false, log: ['容量 1；A 已入队，B 仍由调用方持有。'] };
}
export function transition(state: Model, action: Action): Model {
  const s: Model = { ...state, queue: [...state.queue], completed: [...state.completed], log: [...state.log] };
  const tell = (text: string) => { s.log.push(text); return s; };
  if (action === 'release') {
    if (!s.queue.length) return state;
    s.completed.push(s.queue.shift()!);
    if (s.result === 'waiting') { s.queue.push('B'); s.result = 'accepted'; return tell('消费者完成 A，等待中的 B 立即获得空位；此刻才确认接收。'); }
    return tell('消费者完成队首任务，容量恢复；未接收的 B 不会自动重试。');
  }
  if (action === 'cancel') {
    if (s.result !== 'ready' && s.result !== 'waiting') return state;
    s.cancelled = true; s.result = 'cancelled'; return tell('取消事件先发生；B 未入队，调用方收到取消。');
  }
  if (action === 'tick') {
    if (s.result !== 'waiting') return state;
    s.time += 1;
    if (s.time >= s.budget) { s.result = 'expired'; return tell('等待预算耗尽；B 未入队，调用方收到超时。'); }
    return tell(`已等待 ${s.time} 步；仍无空位。`);
  }
  if (action === 'retry') {
    if (!['rejected', 'expired', 'cancelled', 'forbidden'].includes(s.result)) return state;
    s.result = 'ready'; s.cancelled = false; s.time = 0;
    return tell('调用方显式发起新尝试并获得新预算；尚未确认接收。');
  }
  if (s.result !== 'ready') return state;
  if (!s.queue.length) { s.queue.push('B'); s.result = 'accepted'; return tell('B 实际入队，服务接过执行责任；返回已接收。'); }
  if (s.policy === 'fake') { s.result = 'false-success'; return tell('满队列没有放入 B，却返回已接收；确认与事实矛盾。'); }
  if (s.policy === 'reject') { s.result = 'rejected'; return tell('满队列立即拒绝；调用方知道服务未接收 B。'); }
  if (s.policy === 'wait') { s.result = 'waiting'; return tell('B 等待空位，还没有返回成功；取消和期限可以结束等待。'); }
  s.result = s.lossy ? 'dropped' : 'forbidden';
  return tell(s.lossy ? '业务允许丢失采样，明确报告 B 已丢弃；不承诺执行。' : '当前是不可丢失业务任务；丢弃策略不符合业务约束。');
}
export function ownership(s: Model): string {
  if (s.queue.includes('B') || s.completed.includes('B')) return '服务已接收 B';
  if (s.result === 'false-success') return '无人接住 B，但调用方以为已交接';
  if (s.result === 'dropped') return '按业务约定结束，不再执行 B';
  return '调用方仍负责处理 B 的未接收结果';
}
