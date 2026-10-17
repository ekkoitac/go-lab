export type Producer53 = 'A' | 'B';
export type Outcome53 = 'sent' | 'done' | 'closed' | 'received' | 'ended' | 'blocked' | 'panic';
export type Action53 = { type: 'send' | 'done'; actor: Producer53 } | { type: 'close'; actor: Producer53 | 'receiver' | 'coordinator' } | { type: 'receive' };
export interface State53 {
  sent: Record<Producer53, boolean>;
  done: Record<Producer53, boolean>;
  queue: number[];
  received: number[];
  closed: boolean;
  panic: string | null;
  ended: boolean;
  receiverWaiting: boolean;
  coordinatorWaiting: boolean;
  outcome: Outcome53 | null;
  message: string;
}
export const outcomeLabels53: Record<Outcome53, string> = { sent: '发送完成', done: '生产者结束', closed: '关闭成功', received: '收到缓冲值，ok=true', ended: '读到零值，ok=false', blocked: '等待 / 不能前进', panic: '发生 panic' };
export function initial53(): State53 {
  return { sent: { A: false, B: false }, done: { A: false, B: false }, queue: [], received: [], closed: false, panic: null, ended: false, receiverWaiting: false, coordinatorWaiting: false, outcome: null, message: '两位生产者各发送一次；容量 2。先选一个角色动作，再预测结果。' };
}
export function transition53(state: State53, action: Action53): State53 {
  if (state.panic || !canAct53(state, action)) return state;
  const next: State53 = { ...state, sent: { ...state.sent }, done: { ...state.done }, queue: [...state.queue], received: [...state.received] };
  const result = (outcome: Outcome53, message: string) => { next.outcome = outcome; next.message = message; return next; };
  const panic = (message: string) => { next.panic = message; return result('panic', message); };
  if (action.type === 'send') {
    if (state.sent[action.actor] || state.done[action.actor]) return result('blocked', action.actor + ' 的发送已完成；本模型每人只有一条结果。');
    if (state.closed) return panic(action.actor + ': send on closed channel。关闭已经宣告不再发送，但该生产者仍有未发送的结果。');
    next.sent[action.actor] = true;
    const value = action.actor === 'A' ? 1 : 2;
    if (state.receiverWaiting) {
      next.receiverWaiting = false;
      next.received.push(value);
      return result('sent', action.actor + ' 发送 ' + value + '，唤醒已挂起的接收者，收到值且 ok=true；这条值不留在缓冲。');
    }
    next.queue.push(value);
    return result('sent', action.actor + ' 的结果进入缓冲；发送完成还不等于已经调用 wg.Done()。');
  }
  if (action.type === 'done') {
    if (!state.sent[action.actor]) return result('blocked', action.actor + ' 还需要发送结果，程序尚未到 wg.Done()。');
    if (state.done[action.actor]) return result('blocked', action.actor + ' 已退出，不再重复调用 Done。');
    next.done[action.actor] = true;
    if (next.done.A && next.done.B && next.coordinatorWaiting) {
      next.coordinatorWaiting = false;
      if (next.closed) return panic('最后一个 Done 唤醒协调者，Wait 返回后的 close 触发 close of closed channel：通道先前已被其他角色关闭。');
      next.closed = true;
      if (next.receiverWaiting) { next.receiverWaiting = false; next.ended = true; }
      return result('done', action.actor + ' Done，唤醒协调者；Wait 返回并执行 close。' + (next.ended ? '等待的接收者被唤醒，得到 0 / false。' : '缓冲保留，可继续接收。'));
    }
    return result('done', action.actor + ' 调用 wg.Done() 并退出；还剩 ' + (Number(!next.done.A) + Number(!next.done.B)) + ' 位生产者未结束。');
  }
  if (action.type === 'close') {
    if (action.actor === 'coordinator' && (!state.done.A || !state.done.B)) { next.coordinatorWaiting = true; return result('blocked', 'wg.Wait() 尚未返回：' + (['A', 'B'] as const).filter(actor => !state.done[actor]).join('、') + ' 尚未 Done，协调者挂起；最后一个 Done 后自动继续 close。'); }
    if (state.closed) return panic('close of closed channel。close 不是可以重复调用的结束通知。');
    next.closed = true;
    if (next.receiverWaiting) { next.receiverWaiting = false; next.ended = true; }
    return result('closed', action.actor === 'coordinator' ? '全部生产者已退出，协调者 close 一次。' + next.queue.length + ' 条缓冲结果仍可接收。' : (action.actor === 'receiver' ? '接收者' : action.actor) + ' 执行 close，运行时允许这次关闭；' + (state.done.A && state.done.B ? '但关闭责任已分散，另一方再次 close 会 panic。' : '其他生产者可能仍要发送，危险会在后续发送时暴露。') + '缓冲仍保留。');
  }
  if (next.queue.length) {
    const value = next.queue.shift()!;
    next.received.push(value);
    return result('received', '接收到 ' + value + '，ok=true；' + (next.closed ? '通道已关闭，但先取完缓冲。' : '通道仍开放。'));
  }
  if (next.closed) { next.ended = true; return result('ended', '通道已关闭且缓冲为空：v=0，ok=false。range 在此退出，不把这个零值作为业务结果。'); }
  next.receiverWaiting = true;
  return result('blocked', '接收者已挂起；通道开放且缓冲为空，接收需要等待下一次发送或关闭。');
}
export function canAct53(state: State53, action: Action53): boolean {
  if (state.panic) return false;
  if (action.type === 'send') return !state.sent[action.actor] && !state.done[action.actor];
  if (action.type === 'done') return state.sent[action.actor] && !state.done[action.actor];
  if (action.type === 'receive') return !state.receiverWaiting && !state.ended;
  if (action.actor === 'receiver') return !state.receiverWaiting && !state.ended;
  if (action.actor === 'coordinator') return !state.coordinatorWaiting;
  return !state.done[action.actor];
}
export function actionCode53(action: Action53): string {
  if (action.type === 'send') return action.actor + ': ch <- ' + (action.actor === 'A' ? 1 : 2);
  if (action.type === 'done') return action.actor + ': wg.Done() // 随后退出';
  if (action.type === 'close') return action.actor === 'coordinator' ? 'coordinator: wg.Wait(); close(ch)' : action.actor + ': close(ch) // 缺少统一关闭责任';
  return 'receiver: v, ok := <-ch';
}

