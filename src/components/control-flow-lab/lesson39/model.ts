export type Mode = 'direct' | 'named' | 'indirect' | 'other' | 'none';
export const titles: Record<Mode, string> = { direct: 'defer 闭包直接 recover', named: 'defer catch() 直接延迟 catch', indirect: 'defer 闭包 → 普通 catch → recover', other: '只在另一个 goroutine 设置 recover', none: '没有恢复边界' };
export const snippets: Record<Mode, string> = {
  direct: 'defer func() {\n  if r := recover(); r != nil { recordFailure(r) }\n}()',
  named: 'catch := func() {\n  if r := recover(); r != nil { recordFailure(r) }\n}\ndefer catch()',
  indirect: 'catch := func() {\n  if r := recover(); r != nil { recordFailure(r) }\n}\ndefer func() { catch() }()',
  other: '// g0 的请求函数中\ndefer func() { recover() }()\ngo runPluginWithoutRecovery() // g1',
  none: '// 当前 goroutine 没有可恢复的 defer\nplugin()',
};
export type Phase = 'enter' | 'call' | 'mutate' | 'panic' | 'unwind' | 'defer' | 'recover' | 'return' | 'caller' | 'escape' | 'terminate' | 'done';
export type State = { mode: Mode; goroutine: 'g0' | 'g1'; phase: Phase; stack: string[]; panicActive: boolean; dirty: boolean; afterPanicRan: boolean; recoverValue: '未调用' | 'boom' | 'nil'; outcome: 'pending' | 'returned-failure' | 'unhandled'; failure: string | null; events: string[]; note: string };
export function createState(mode: Mode = 'indirect'): State {
  return { mode, goroutine: mode === 'other' ? 'g1' : 'g0', phase: 'enter', stack: [mode === 'other' ? '子任务入口' : '调用者'], panicActive: false, dirty: false, afterPanicRan: false, recoverValue: '未调用', outcome: 'pending', failure: null, events: [], note: '从调用者进入插件执行边界。先观察恢复位置，再触发插件中的 panic。' };
}
export function step(state: State): State {
  if (state.phase === 'done') return state;
  const next: State = { ...state, stack: [...state.stack], events: [...state.events] };
  switch (state.phase) {
    case 'enter': next.stack.push('执行边界'); next.phase = 'call'; next.note = `进入 ${next.goroutine} 的执行边界。${next.mode === 'other' ? 'g0 的恢复函数不在这条栈上。' : next.mode === 'none' ? '此边界未登记恢复函数。' : `登记方式：${titles[next.mode]}。`}`; break;
    case 'call': next.stack.push('插件回调'); next.phase = 'mutate'; next.note = '边界调用插件，插件帧压栈。'; break;
    case 'mutate': next.dirty = true; next.phase = 'panic'; next.note = '插件先写入了一半业务状态：状态现在待修复。这是真实副作用，后续 recover 不会自动撤销。'; break;
    case 'panic': next.panicActive = true; next.phase = 'unwind'; next.note = '插件执行 panic("boom")，正常执行中断；panic 后的成功语句不会运行。'; break;
    case 'unwind': next.stack.pop(); next.phase = 'defer'; next.note = '展开当前 goroutine：插件帧退出，进入执行边界的延迟调用阶段。'; break;
    case 'defer':
      if (next.mode === 'none' || next.mode === 'other') { next.phase = 'escape'; next.note = next.mode === 'other' ? 'g1 没有恢复 defer。g0 的 defer 不会因 g1 的 panic 执行，也不能恢复它。' : '当前边界没有恢复 defer，panic 继续向外展开。'; }
      else { next.stack.push(next.mode === 'named' ? 'catch（被直接 defer）' : 'defer 闭包'); if (next.mode === 'indirect') next.stack.push('catch（普通调用）'); next.phase = 'recover'; next.note = next.mode === 'indirect' ? 'defer 闭包普通调用 catch；recover 的直接调用者是普通 helper，不是被延迟执行的函数。' : `开始执行${next.mode === 'named' ? '被 defer 的 catch' : 'defer 闭包'}，下一步由它直接调用 recover。`; }
      break;
    case 'recover':
      next.stack = next.stack.slice(0, 2);
      if (next.mode === 'direct' || next.mode === 'named') { next.recoverValue = 'boom'; next.panicActive = false; next.failure = 'plugin panic: boom'; next.phase = 'return'; next.note = 'recover 得到 boom，停止本次展开；本模型显式记录失败。下一步执行边界返回，不会回到插件的 panic 下一行。'; }
      else { next.recoverValue = 'nil'; next.phase = 'escape'; next.note = '普通 helper 中 recover 得到 nil；panic 仍在传播。把 catch 本身直接 defer，或将 recover 移入 defer 闭包体，才能修复。'; }
      break;
    case 'return': next.stack.pop(); next.phase = 'caller'; next.note = '含有效恢复 defer 的执行边界完成返回。插件故障位置不会恢复执行，业务半成品仍待修复。'; break;
    case 'caller': next.outcome = 'returned-failure'; next.phase = 'done'; next.note = '调用者收到模型显式转换的失败结果，可以报告失败或安排修复；不会把回调当成成功。'; break;
    case 'escape': next.stack.pop(); next.phase = 'terminate'; next.note = 'panic 越过执行边界，继续展开；本情境没有更外层的同 goroutine 恢复者。'; break;
    case 'terminate': next.stack = []; next.outcome = 'unhandled'; next.phase = 'done'; next.note = '未恢复 panic 使程序终止（这里只展示模拟结果）。另一个 goroutine 的 recover 无法兜底，调用者不会收到正常返回。'; break;
  }
  next.events.push(next.note);
  return next;
}
export function run(state: State): State {
  let result = state;
  for (let i = 0; i < 20; i++) { if (result.phase === 'done') return result; result = step(result); }
  throw new Error('panic 模型没有结束');
}