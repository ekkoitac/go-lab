export type Config = { delay: number; sleep: number; budget: number; omitDone: boolean };
export const initialConfig: Config = { delay: 4, sleep: 2, budget: 10, omitDone: false };
export type Verdict = 'waiting' | 'early' | 'unproven' | 'passed' | 'timeout';
export type State = {
  config: Config; tick: number; gate: boolean; accepted: boolean; written: boolean;
  done: boolean; sleepVerdict: Verdict; handshakeVerdict: Verdict; events: string[];
};
export function createState(config: Config = initialConfig): State {
  return { config: { ...config }, tick: 0, gate: false, accepted: false, written: false,
    done: false, sleepVerdict: 'waiting', handshakeVerdict: 'waiting',
    events: ['worker 等待 gate；两个测试都还没有完成证据。'] };
}
export function canStep(s: State): boolean {
  return !s.gate || (s.tick < s.config.budget &&
    (s.sleepVerdict === 'waiting' || s.handshakeVerdict === 'waiting'));
}
export function step(s: State): State {
  if (!canStep(s)) return s;
  if (!s.gate) return { ...s, gate: true, events: ['测试关闭 gate：worker 可运行，但调度器还没有安排它接收任务。'] };
  const n: State = { ...s, tick: s.tick + 1, events: [] };
  if (n.tick === n.config.delay) {
    n.accepted = true;
    n.events.push('worker 接收任务，发出 accepted。接收确认不代表处理完成。');
  }
  if (n.tick === n.config.delay + 1) {
    n.written = true;
    n.events.push('worker 写入 result=42；尚未观察完成信号，测试还不能据此安全读取。');
  }
  if (n.tick === n.config.delay + 2) {
    n.done = !n.config.omitDone;
    n.events.push(n.done ? 'worker 关闭 done；等待者观察到关闭后，先前写入对它可见。' : '故障注入：worker 已写结果，却漏关 done，等待者仍被阻塞。');
  }
  if (n.sleepVerdict === 'waiting' && n.tick >= n.config.sleep) {
    n.sleepVerdict = n.written ? 'unproven' : 'early';
    n.events.push(n.written ? 'sleep 结束：值碰巧已写入，但 sleep 没有建立同步关系，不能证明安全读取。' : 'sleep 结束：worker 尚未写结果，提前断言失败。');
  }
  if (n.handshakeVerdict === 'waiting' && n.done) {
    n.handshakeVerdict = 'passed';
    n.events.push('握手测试收到 done，随后读取 result=42：完成证据成立。');
  }
  if (n.tick >= n.config.budget) {
    if (n.handshakeVerdict === 'waiting') n.handshakeVerdict = 'timeout';
    if (n.sleepVerdict === 'waiting') n.sleepVerdict = 'timeout';
    n.events.push('整体测试预算到期：未完成的等待报告超时；超时绝不当作成功。');
  }
  if (!n.events.length) n.events.push('调度时隙推进：没有协议事件，完成关系保持不变。');
  return n;
}
export function run(config: Config): State {
  let state = createState(config);
  for (let i = 0; i <= config.budget && canStep(state); i++) state = step(state);
  return state;
}
export type Signal = 'accepted' | 'done';
export function exampleObservation(phase: number, signal: Signal) {
  const received = phase >= (signal === 'accepted' ? 1 : 3);
  return { received, resultWritten: phase >= 2, safeRead: received && signal === 'done' };
}
export function hasCompletionPath(edges: readonly boolean[]): boolean {
  return edges.length === 3 && edges.every(Boolean);
}
export const protocol = ['释放 gate', 'worker 接收任务', '写入 result', '关闭 done', '测试观察 done', '读取 result'] as const;
export function validateProtocol(order: readonly string[]) {
  const mismatch = protocol.findIndex((name, i) => order[i] !== name);
  return { valid: order.length === protocol.length && mismatch === -1, mismatch };
}
export function transferFeedback(choice: string) {
  return choice === 'join'
    ? '判断正确：先发送取消，再等待 worker 的退出确认，最后检查结果和资源。取消请求只表达意图；整体超时暴露无法退出的协议缺口。'
    : choice === 'cancel'
      ? '取消信号被关闭，只能证明测试发出了请求；worker 可能还在处理。补上退出确认，再核对资源释放。'
      : '延长 sleep 仍不能证明 worker 看到了取消或释放了资源。把完成条件改成可观察的退出信号，并保留总超时。';
}
