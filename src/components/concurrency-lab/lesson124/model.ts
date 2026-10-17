export type Action = 'stop' | 'cancel' | 'wait' | 'close';
export interface Config { plan: Action[]; cleanupTicks: number; budget: number; cooperative: boolean }
export interface Frame { cursor: number; accepting: boolean; canceled: boolean; databaseOpen: boolean; worker: 'running' | 'cleaning' | 'done' | 'failed'; remaining: number; waited: number; confirmed: boolean; timedOut: boolean; event: string }
export interface State { config: Config; history: Frame[] }
export const labels: Record<Action, string> = { stop: '停止入口', cancel: '通知取消', wait: '等待收尾', close: '关闭数据库' };
export const defaults: Config = { plan: ['stop', 'close', 'cancel', 'wait'], cleanupTicks: 2, budget: 3, cooperative: true };
export function initial(config: Config = defaults): State {
  if (config.plan.length !== 4 || new Set(config.plan).size !== 4 || config.plan.some(a => !Object.hasOwn(labels, a))) throw new Error('退出协议必须包含四个不同动作');
  if (!Number.isInteger(config.cleanupTicks) || config.cleanupTicks < 1 || config.cleanupTicks > 4 || !Number.isInteger(config.budget) || config.budget < 1 || config.budget > 6) throw new Error('预算或收尾长度无效');
  return { config: { ...config, plan: [...config.plan] }, history: [{ cursor: 0, accepting: true, canceled: false, databaseOpen: true, worker: 'running', remaining: config.cleanupTicks, waited: 0, confirmed: false, timedOut: false, event: 'worker 正在运行，最终状态还未写入数据库。' }] };
}
export function current(s: State): Frame { return s.history[s.history.length - 1]; }
export function finished(s: State): boolean { const f = current(s); return f.timedOut || f.cursor === s.config.plan.length; }
export function outcome(s: State): 'pending' | 'safe' | 'unsafe' | 'timeout' {
  const f = current(s);
  if (f.timedOut) return 'timeout';
  if (!finished(s)) return 'pending';
  return f.worker === 'done' && f.confirmed && !f.accepting && !f.databaseOpen ? 'safe' : 'unsafe';
}
export function advance(s: State): State {
  if (finished(s)) return s;
  const f = { ...current(s) }; const action = s.config.plan[f.cursor];
  if (action === 'stop') { f.accepting = false; f.cursor++; f.event = '入口已停止接收；已运行的 worker 仍然存在。'; }
  if (action === 'cancel') { f.canceled = true; if (s.config.cooperative) f.worker = 'cleaning'; f.cursor++; f.event = s.config.cooperative ? 'cancel 已发出；worker 开始收尾，done 尚未确认。' : 'cancel 已发出，但 worker 不检查取消信号，仍在运行。'; }
  if (action === 'close') { f.databaseOpen = false; f.cursor++; f.event = f.worker === 'done' ? '收尾已完成，数据库现在可关闭。' : '数据库已关闭；worker 尚未成功收尾，后续写入将失去依赖。'; }
  if (action === 'wait') {
    f.waited++;
    if (f.worker === 'cleaning') {
      f.remaining--;
      if (f.remaining === 0) { f.worker = f.databaseOpen ? 'done' : 'failed'; f.confirmed = true; f.cursor++; f.event = f.databaseOpen ? '最终状态写入成功，done 已确认，worker 退出。' : '最终状态写入失败：数据库先关闭了。已收到失败完成信号。'; }
      else f.event = `等待一格：worker 正在收尾，还需 ${f.remaining} 格。取消信号不是完成信号。`;
    } else if (f.worker === 'done' || f.worker === 'failed') { f.confirmed = true; f.cursor++; f.event = '收到 worker 完成信号。'; }
    else f.event = f.canceled ? '等待一格：worker 未响应取消，没有完成信号。' : '等待一格：尚未发出取消，worker 不会进入收尾。';
    if (!f.confirmed && f.waited >= s.config.budget) { f.timedOut = true; f.event += ' 等待预算耗尽：报告未完成并停止协议；本模型不强制终止 goroutine，也不自动关闭依赖。'; }
  }
  return { ...s, history: [...s.history, f] };
}
export function rewind(s: State): State { return s.history.length > 1 ? { ...s, history: s.history.slice(0, -1) } : s; }
export function run(config: Config): State { let s = initial(config); for (let i = 0; i < 12 && !finished(s); i++) s = advance(s); return s; }
