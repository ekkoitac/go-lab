export type Protection = 'none' | 'precheck' | 'select';
export type Prediction = 'blocked' | 'send' | 'cancel' | 'either';
export type LeakConfig = { protection: Protection; consumerLeaves: boolean };
export type LeakState = LeakConfig & {
  phase: 'start' | 'checked' | 'cancelled' | 'blocked' | 'returning' | 'done';
  cancelled: boolean; receiver: boolean; delivered: boolean; done: boolean;
  selected: 'send' | 'cancel' | null; rescued: boolean; event: string;
};
export const initialLeakState = (config: LeakConfig): LeakState => ({...config, phase: 'start', cancelled: false, receiver: true, delivered: false, done: false, selected: null, rescued: false, event: '生产者准备工作；消费者当前仍在。取消尚未发出。'});
export function expectedOutcome(config: LeakConfig): Prediction {
  if (config.protection === 'select') return config.consumerLeaves ? 'cancel' : 'either';
  return config.consumerLeaves ? 'blocked' : 'send';
}
export function advanceLeak(state: LeakState, sample = 0.25): LeakState {
  switch (state.phase) {
    case 'start': return {...state, phase: 'checked', event: state.protection === 'precheck' ? '前置检查发现 ctx 未取消，继续；这次检查并未给后续发送加上取消路径。' : '生产者完成发送前的准备，尚未执行发送。'};
    case 'checked': return {...state, phase: 'cancelled', cancelled: true, receiver: !state.consumerLeaves, event: state.consumerLeaves ? '消费者离开，再调用 cancel()。ctx.Done 已关闭，但生产者还没执行取消分支，done 仍未关闭。' : '消费者仍准备接收，同时调用 cancel()。发送和取消是否都能参与选择，取决于发送处的代码。'};
    case 'cancelled': {
      if (state.protection !== 'select' && !state.receiver) return {...state, phase: 'blocked', event: '普通 out <- 1 没有接收者，阻塞在发送处。前面的检查已经过去；取消通知不能中断这个普通发送。'};
      const selected = state.protection === 'select' && (!state.receiver || sample >= 0.5) ? 'cancel' : 'send';
      return {...state, phase: 'returning', selected, delivered: selected === 'send', event: selected === 'cancel' ? '发送处的 select 选择取消分支，跳过发送，准备返回。此刻还没有完成退出确认。' : state.protection === 'select' ? '发送与取消同时就绪，本次合法地选中了发送。select 没有取消优先级；本模型只发送一项。' : '接收者仍在，普通发送完成；这次退出依赖接收者，并不是 cancel 中断了发送。'};
    }
    case 'returning': return {...state, phase: 'done', done: true, event: '生产者返回并执行 defer close(done)。等待 done 的调用方现在才能确认本任务退出。'};
    default: return state;
  }
}
export function rescueLeak(state: LeakState): LeakState {
  if (state.phase !== 'blocked') return state;
  return {...state, phase: 'returning', receiver: true, delivered: true, selected: 'send', rescued: true, event: '实验清理：临时补一个接收者，阻塞发送才得以完成。取消策略没有被修复；下一步确认退出。'};
}
