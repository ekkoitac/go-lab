export type Policy = 'return' | 'receipt';
export type Effect = 'launch' | 'progress' | 'saved' | 'signal' | 'block' | 'ack' | 'exit';
export type Actor = 'main' | 'worker';
export interface State {
  policy: Policy; work: number; remaining: number;
  main: 'new' | 'ready' | 'waiting' | 'acknowledged' | 'exited';
  worker: 'absent' | 'ready' | 'writing' | 'saved' | 'done' | 'stopped';
  saved: boolean; receipt: boolean; effect: Effect | null; message: string;
}
export const effects: Record<Effect, string> = {
  launch: '任务已启动，尚未完成', progress: '后台推进，尚未写完', saved: '写入完成，尚未发送回执',
  signal: '完成通道已关闭', block: 'main 等待回执', ack: 'main 收到回执', exit: 'main 返回，进程结束',
};
export function initialState(policy: Policy = 'return', work = 2): State {
  if (!Number.isInteger(work) || work < 1 || work > 4) throw new Error('work must be 1–4');
  return {policy, work, remaining: work, main: 'new', worker: 'absent', saved: false, receipt: false, effect: null,
    message: '先运行 main 的 go save()，再自主选择哪条执行线推进。'};
}
export function canStep(s: State, actor: Actor): boolean {
  if (s.main === 'exited') return false;
  return actor === 'main' ? !(s.main === 'waiting' && !s.receipt) : s.worker === 'ready' || s.worker === 'writing' || s.worker === 'saved';
}
export function step(s: State, actor: Actor): State {
  if (!canStep(s, actor)) return s;
  if (actor === 'worker') {
    if (s.worker === 'saved') return {...s, worker: 'done', receipt: true, effect: 'signal', message: '后台执行 close(done)：写入发生在关闭之前；等待方现在可收到完成事件。'};
    const remaining = s.remaining - 1;
    return {...s, remaining, worker: remaining ? 'writing' : 'saved', saved: !remaining, effect: remaining ? 'progress' : 'saved',
      message: remaining ? `后台推进一个工作片段，还剩 ${remaining} 段；启动没有替它完成这些工作。` : '后台写入已完成；接下来还要执行 close(done)，main 才有明确的完成依据。'};
  }
  if (s.main === 'new') return {...s, main: 'ready', worker: 'ready', effect: 'launch', message: 'main 执行 go save() 后继续；后台变为可运行，并不表示写入已经执行。'};
  if (s.policy === 'receipt' && s.main !== 'acknowledged') {
    return s.receipt
      ? {...s, main: 'acknowledged', effect: 'ack', message: 'main 的 <-done 返回：关闭前的写入已经完成，完成回执建立了继续执行的依据。'}
      : {...s, main: 'waiting', effect: 'block', message: 'done 尚未关闭，main 阻塞在 <-done；后台仍可运行。下一步请推进后台。'};
  }
  return {...s, main: 'exited', worker: s.worker === 'done' ? 'done' : 'stopped', effect: 'exit',
    message: s.receipt ? 'main 返回，进程结束；这条路径已经完成写入并发出回执。' : s.saved ? 'main 返回时写入碰巧已完成，但没有等待完成事件；换一种调度仍可能丢失工作。' : 'main 返回，进程结束。后台未写完的工作没有机会继续；go 不会隐式等待它。'};
}
