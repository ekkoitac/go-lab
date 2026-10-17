export type Outcome = 'waiting' | 'complete' | 'client' | 'context' | 'both' | 'cancel' | 'race';
export type Input = {client: number; context: number; bodyAt: number | null; cancelAt: number | null};
export const baseline: Input = {client: 5, context: 0, bodyAt: 8, cancelAt: null};
export const labels: Record<Outcome, string> = {waiting:'仍在等待', complete:'完整读完响应体', client:'Client 总预算到期', context:'请求 context 到期', both:'两个预算同时到期', cancel:'手动取消等待', race:'完成与截止竞争，结果不确定'};
export function requestState(input: Input, time: number) {
  for (const value of [input.client, input.context, input.bodyAt, input.cancelAt, time]) {
    if (value !== null && (!Number.isInteger(value) || value < 0)) throw new Error('逻辑秒必须是非负整数');
  }
  if (input.bodyAt !== null && input.bodyAt <= 3) throw new Error('响应体完成必须晚于响应头');
  const budgets = [input.client > 0 ? input.client : Infinity, input.context > 0 ? input.context : Infinity, input.cancelAt ?? Infinity];
  const stopAt = Math.min(...budgets);
  const bodyAt = input.bodyAt ?? Infinity;
  const terminalAt = Math.min(stopAt, bodyAt);
  let outcome: Outcome = 'waiting';
  if (time >= terminalAt) {
    if (stopAt === bodyAt) outcome = 'race';
    else if (bodyAt < stopAt) outcome = 'complete';
    else if (input.cancelAt === stopAt) outcome = 'cancel';
    else if (input.client === stopAt && input.context === stopAt) outcome = 'both';
    else outcome = input.client === stopAt ? 'client' : 'context';
  }
  const localTime = Math.min(time, terminalAt);
  const phase = localTime < 1 ? '准备连接' : localTime < 3 ? '连接、发送与等待响应头' : outcome === 'complete' ? '响应体已读完' : '读取响应体';
  // 本场景设定：t=1 请求抵达，服务端不响应取消，t=2 提交。取消不能撤销已经抵达的工作。
  const received = stopAt >= 1 && time >= 1;
  const remote = !received ? '未接收' : time >= 2 ? '已提交副作用' : '处理中';
  return {time, phase, outcome, waiting:outcome==='waiting', remote, terminalAt:Number.isFinite(terminalAt)?terminalAt:null, stopAt:Number.isFinite(stopAt)?stopAt:null, headersReceived:localTime>=3, bodyComplete:outcome==='complete'};
}


