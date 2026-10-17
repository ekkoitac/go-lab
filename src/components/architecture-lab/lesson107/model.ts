export type Config = { design: 'coupled' | 'ports'; entry: 'http' | 'message' | 'fake'; amount: number; storageOk: boolean; ackOk: boolean };
export type State = { config: Config; phase: number };
export type Outcome = 'waiting' | 'success' | 'invalid' | 'storage' | 'ack' | 'blocked';
export const defaults: Config = { design: 'ports', entry: 'message', amount: 40, storageOk: true, ackOk: true };
export const initial = (config: Config = defaults): State => ({ config: { ...config }, phase: 0 });
export const advance = (state: State): State => ({ ...state, phase: Math.min(4, state.phase + 1) });
export const rewind = (state: State): State => ({ ...state, phase: Math.max(0, state.phase - 1) });
export const names: Record<Outcome, string> = { waiting: '尚未完成', success: '退款提交且入口处理完成', invalid: '业务拒绝，无退款写入', storage: '持久化失败，未确认消息', ack: '退款已提交，消息确认失败', blocked: '测试被外部依赖阻塞' };
export function inspect(state: State) {
  const { config: c, phase: p } = state;
  const blocked = c.design === 'coupled' && c.entry === 'fake';
  const valid = Number.isFinite(c.amount) && c.amount > 0 && c.amount <= 100;
  const validated = p >= 2 && !blocked;
  const saveCalls = p >= 3 && valid && !blocked ? 1 : 0;
  const committed = saveCalls === 1 && c.storageOk;
  const ackCalls = p >= 4 && committed && c.entry === 'message' ? 1 : 0;
  const acknowledged = ackCalls === 1 && c.ackOk;
  const outcome: Outcome = p < 4 ? 'waiting' : blocked ? 'blocked' : !valid ? 'invalid' : !c.storageOk ? 'storage' : c.entry === 'message' && !c.ackOk ? 'ack' : 'success';
  const dependencies = c.design === 'ports' ? ['RefundCommand', 'RefundStore'] : ['HTTP Context', 'SQL driver', 'Broker delivery'];
  const trace = [
    '准备：订单可退余额 100 元，尚未调用退款用例。',
    blocked ? '准备失败：直连函数需要 HTTP、SQL 与 Broker；只有 fake 端口无法装配。' : c.design === 'coupled' && c.entry === 'message' ? '消息入口伪造 HTTP Context，进入绑定框架的退款函数。' : `${c.entry === 'http' ? 'HTTP 适配器' : c.entry === 'message' ? '消息适配器' : '测试'}生成 RefundCommand(amount=${c.amount})。`,
    blocked ? '未执行规则：缺少真实外部组件。' : valid ? '业务规则通过：0 < amount ≤ 可退余额 100。' : '业务规则拒绝：退款金额须大于 0 且不超过可退余额；停止写入。',
    blocked || !valid ? '存储步骤跳过，Save 调用次数为 0。' : c.storageOk ? `Save 成功：${c.entry === 'fake' ? 'fake 记录' : '模拟持久化记录'}写入 ${c.amount} 元。` : 'Save 返回错误：本模型事务回滚，无退款记录。',
    blocked ? '无法在纯 fake 环境运行这个直连函数。' : !valid ? c.entry === 'message' ? '消息适配器将无效业务请求拒绝到死信（本模型策略），不做成功 Ack。' : '入口返回业务拒绝；HTTP 对应 422。' : !c.storageOk ? c.entry === 'message' ? '消息保持未确认，可重试；绝不能先 Ack。' : '入口返回存储错误；HTTP 对应 503。' : c.entry !== 'message' ? c.entry === 'fake' ? '测试得到成功业务结果；没有 HTTP 或 Broker。' : 'HTTP 适配器映射为 200；没有消息确认。' : c.ackOk ? '提交后 Ack 成功，消息处理完成。' : '提交已成功，但 Ack 失败；消息可能重投，不能假装退款回滚。',
  ];
  return { phase: p, command: p > 0 && !blocked ? { orderId: 'R-107', amount: c.amount } : null, validated, valid: validated ? valid : null, saveCalls, committed, recordAmount: committed ? c.amount : 0, ackCalls, acknowledged, outcome, dependencies, trace: trace.slice(0, p + 1) };
}
export const completed = (config: Config) => inspect({ config, phase: 4 });
