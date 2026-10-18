export type Operation = 'flush' | 'close' | 'report';
export const labels: Record<Operation, string> = { flush: 'Flush 刷新缓冲', close: 'Close 关闭连接', report: 'Report 收集结果' };
export type Call = { op: Operation; iteration: number };
export type State = { order: Operation[]; rounds: number; iteration: number; cursor: number; stack: Call[]; phase: 'register' | 'loop-end' | 'body' | 'exit' | 'done'; pending: number; written: number; open: boolean; failFlush: boolean; errors: string[]; executed: Call[]; reports: string[]; note: string };
export function createState(order: Operation[] = ['report', 'flush', 'close'], pending = 3, failFlush = false, rounds = 1): State {
  if (!order.length || order.length > 3 || new Set(order).size !== order.length || order.some(op => !Object.hasOwn(labels, op)) || !Number.isInteger(pending) || pending < 0 || pending > 9 || !Number.isInteger(rounds) || rounds < 1 || rounds > 3) throw new RangeError('模型参数越界');
  return { order: [...order], rounds, iteration: 1, cursor: 0, stack: [], phase: 'register', pending, written: 0, open: true, failFlush, errors: [], executed: [], reports: [], note: '当前函数正在执行函数体；defer 尚未登记。' };
}
export function move(order: Operation[], index: number, delta: -1 | 1): Operation[] {
  const target = index + delta;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return [...order];
  const next = [...order]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
export function requestExit(state: State): State {
  if (state.phase !== 'body') return state;
  return { ...state, phase: 'exit', note: `触发当前函数 return：开始按后进先出执行 ${state.stack.length} 个延迟调用。` };
}
export function step(state: State): State {
  if (state.phase === 'done' || state.phase === 'body') return state;
  const next: State = { ...state, stack: state.stack.map(c => ({ ...c })), executed: [...state.executed], errors: [...state.errors], reports: [...state.reports] };
  if (next.phase === 'register') {
    const op = next.order[next.cursor]; next.stack.push({ op, iteration: next.iteration }); next.cursor++;
    next.note = `第 ${next.iteration} 轮登记 ${labels[op]}：压到栈顶，栈深 ${next.stack.length}；此刻不执行清理。`;
    if (next.cursor === next.order.length) next.phase = 'loop-end';
  } else if (next.phase === 'loop-end') {
    if (next.iteration < next.rounds) { next.iteration++; next.cursor = 0; next.phase = 'register'; next.note = `上一轮循环结束，进入第 ${next.iteration} 轮；仍在同一函数中，defer 栈保留 ${next.stack.length} 项。`; }
    else { next.phase = 'body'; next.note = `循环已结束，但当前函数尚未返回：${next.stack.length} 个 defer 仍在等待。下一步触发函数返回。`; }
  } else {
    const call = next.stack.pop();
    if (!call) { next.phase = 'done'; next.note = 'defer 栈已清空，当前函数完成返回。'; return next; }
    next.executed.push(call);
    if (call.op === 'close') { next.note = next.open ? '弹出 Close：连接从打开变为关闭。缓冲内容不会由本模型中的 Close 自动刷新。' : '再次执行 Close：连接已经关闭；此模型把重复关闭简化为无状态变化。'; next.open = false; }
    else if (call.op === 'flush') {
      if (!next.open || next.failFlush) { const error = !next.open ? 'Flush 失败：连接已关闭' : 'Flush 失败：注入的写入错误'; next.errors.push(error); next.note = `${error}；${next.pending} 条仍留在缓冲，已写入数不变。错误已汇总，下一项 defer 仍会执行。`; }
      else { const count = next.pending; next.written += count; next.pending = 0; next.note = `弹出 Flush：成功写入 ${count} 条，缓冲 ${count} → 0；连接仍打开。`; }
    } else { const report = `写入=${next.written}，待写=${next.pending}，错误=${next.errors.length}`; next.reports.push(report); next.note = `弹出 Report：此刻收集 ${report}。若后面还有清理，此快照不含它们的后续结果。`; }
  }
  return next;
}
export function run(state: State): State {
  let result = state;
  for (let i = 0; i < 50; i++) { if (result.phase === 'done') return result; result = result.phase === 'body' ? requestExit(result) : step(result); }
  throw new Error('defer 模型未在有限步骤内结束');
}