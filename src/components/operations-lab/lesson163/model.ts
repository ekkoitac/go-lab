export type Workload = 'churn' | 'retained' | 'native' | 'stacks';
export type Prediction = 'plateau' | 'heap' | 'outside';
export type Action = 'load' | 'gc' | 'release';
export interface Config { workload: Workload; allocation: number }
export interface Sample { round: number; live: number; rss: number; stacks: number; native: number }
export interface State {
  round: number; live: number; garbage: number; idle: number; stacks: number;
  native: number; mapped: number; goroutines: number; allocated: number;
  waitingGC: boolean; samples: Sample[]; last: string;
}
export const names: Record<Workload, string> = {
  churn: '临时分配，处理后不保留', retained: '每轮持有 20% 的 Go 对象',
  native: '每轮新增 40 MiB cgo 分配', stacks: '每轮新增 100 个未退出 goroutine',
};
export const predictions: Record<Prediction, string> = {
  plateau: 'GC 后 live heap 稳定，RSS 可以保持高位',
  heap: 'GC 后 live heap 逐轮增长，需检查保留引用',
  outside: 'GC 后 live heap 稳定，RSS 因其他来源增长',
};
export function rss(s: State) { return s.live + s.garbage + s.idle + s.stacks + s.native + s.mapped; }
export function initial(): State {
  return {round: 0, live: 200, garbage: 0, idle: 600, stacks: 40, native: 40, mapped: 20,
    goroutines: 200, allocated: 0, waitingGC: false,
    samples: [{round: 0, live: 200, rss: 900, stacks: 40, native: 40}],
    last: '基线：GC 后 live heap 为 200 MiB，RSS 为 900 MiB。仅凭这两个数字尚不能判定泄漏。'};
}
export function advance(s: State, config: Config, action: Action): State {
  if (action === 'release') {
    if (!s.idle) return {...s, last: '没有可归还的空闲驻留页；仍活跃的 Go 对象、栈与 cgo 内存不受此操作影响。'};
    return {...s, idle: 0, last: '模拟归还 ' + s.idle + ' MiB 空闲页：RSS ' + rss(s) + ' → ' + (rss(s) - s.idle) + ' MiB；live heap 仍为 ' + s.live + ' MiB。'};
  }
  if (action === 'load') {
    if (s.waitingGC) return s;
    const amount = Math.max(100, Math.min(600, Math.round(config.allocation / 10) * 10));
    const kept = config.workload === 'retained' ? amount * .2 : 0;
    const nativeGrowth = config.workload === 'native' ? 40 : 0;
    const stackGrowth = config.workload === 'stacks' ? 20 : 0;
    return {...s, round: s.round + 1, live: s.live + kept, garbage: s.garbage + amount - kept,
      idle: Math.max(0, s.idle - amount), allocated: s.allocated + amount,
      native: s.native + nativeGrowth, stacks: s.stacks + stackGrowth,
      goroutines: s.goroutines + (stackGrowth ? 100 : 0), waitingGC: true,
      last: '第 ' + (s.round + 1) + ' 轮请求：分配 ' + amount + ' MiB，' + kept + ' MiB 继续被引用，' + (amount - kept) + ' MiB 已不可达、等待 GC；新增 cgo ' + nativeGrowth + ' MiB，栈 ' + stackGrowth + ' MiB。'};
  }
  const next: State = {...s, garbage: 0, idle: s.idle + s.garbage, waitingGC: false};
  next.samples = s.waitingGC ? [...s.samples, {round: s.round, live: next.live, rss: rss(next), stacks: next.stacks, native: next.native}] : s.samples;
  next.last = 'GC：回收 ' + s.garbage + ' MiB 不可达对象，转为可复用空闲页；live heap ' + next.live + ' MiB，RSS 仍为 ' + rss(next) + ' MiB。仍被引用的对象不会被回收。';
  return next;
}
export function outcome(config: Config): Prediction {
  return config.workload === 'retained' ? 'heap' : config.workload === 'churn' ? 'plateau' : 'outside';
}
export function runRounds(config: Config, rounds = 3) {
  let s = initial();
  for (let i = 0; i < rounds; i++) { s = advance(s, config, 'load'); s = advance(s, config, 'gc'); }
  return s;
}
export const boundary = '教学边界：用 MiB 整数分桶，假设各桶互不重叠且全部驻留，RSS 为桶之和；真实 OS 的共享页、分页、运行时元数据和采样口径更复杂。GC 与 scavenger 分开演示，归还页是可控反事实，不承诺实际归还时机；栈并非固定每个 0.2 MiB。有限样本只提供增长线索，需结合引用路径、负载与长期趋势判断。所有帮助与实验均不记录独立掌握。';
