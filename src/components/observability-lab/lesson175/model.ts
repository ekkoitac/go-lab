export type Strategy = 'derived' | 'global' | 'background';
export type Lifecycle = 'worker' | 'request';
export type Outcome = 'req-A' | 'req-B' | 'missing' | 'cancelled';
export interface Config { strategy: Strategy; metadata: boolean; lifecycle: Lifecycle }
export interface State { step: number; globalID: string; childID: string; messageID: string; requestCancelled: boolean; workerStatus: 'waiting' | 'running' | 'cancelled'; workerID: string; authorized: boolean; event: string; explanation: string }
export const initialConfig: Config = { strategy: 'global', metadata: true, lifecycle: 'worker' };
export const events = ['请求 A 进入', '请求 B 交错进入', 'A 调用子函数', 'A 写入持久队列', 'HTTP 请求 A 结束', '消费者开始作业', '尝试凭关联 ID 授权'];
export function initialState(): State { return { step: 0, globalID: '', childID: '', messageID: '', requestCancelled: false, workerStatus: 'waiting', workerID: '', authorized: false, event: '等待事件', explanation: '固定调度 A → B → A 子调用，用同一交错顺序比较策略。' }; }
export function advance(state: State, config: Config): State {
 const next = { ...state, step: Math.min(state.step + 1, events.length) };
 if (state.step >= events.length) return state;
 next.event = events[state.step];
 switch (state.step) {
 case 0: next.globalID = 'req-A'; next.explanation = 'A 拥有自己的 request context；共享 currentID 被写成 req-A。'; break;
 case 1: next.globalID = 'req-B'; next.explanation = 'B 不修改 A 的 context，但覆盖了进程共享 currentID。'; break;
 case 2: next.childID = config.strategy === 'derived' ? 'req-A' : config.strategy === 'global' ? state.globalID : ''; next.explanation = config.strategy === 'derived' ? '从 A 的 context 派生，查找值沿父链得到 req-A。' : config.strategy === 'global' ? 'A 子调用读取共享变量，误读 B 的 req-B；这是串号。' : 'Background 没有父 context，A 的诊断值丢失。'; break;
 case 3: next.messageID = config.metadata ? state.childID : ''; next.explanation = config.metadata ? '显式序列化当前关联值；错误值也会被忠实写入，队列不会自动修复。' : '消息没有关联元数据；进程内 context 不会自动穿过队列。'; break;
 case 4: next.requestCancelled = true; next.explanation = '请求生命周期结束并发出取消；已持久化的作业仍应由消费者拥有。'; break;
 case 5: next.workerID = state.messageID; next.workerStatus = config.lifecycle === 'worker' ? 'running' : 'cancelled'; next.explanation = config.lifecycle === 'worker' ? '消费者读取元数据，在服务管理的独立超时 context 中重建关联；HTTP 取消不传播。' : '错误借用已结束请求的取消状态，持久作业开始时就被取消。'; break;
 case 6: next.authorized = false; next.explanation = '即使关联 ID 完整，仍没有认证凭据；授权被拒绝。关联 ID 只供诊断。'; break;
 }
 return next;
}
export function run(config: Config): State { let state = initialState(); for (let i = 0; i < events.length; i++) state = advance(state, config); return state; }
export function outcome(state: State): Outcome { return state.workerStatus === 'cancelled' ? 'cancelled' : state.workerID === 'req-A' ? 'req-A' : state.workerID === 'req-B' ? 'req-B' : 'missing'; }
export const outcomeNames: Record<Outcome, string> = { 'req-A': '作业运行，关联 A', 'req-B': '作业运行，误关联 B', missing: '作业运行，无关联', cancelled: '作业被请求取消' };
export function transferCheck(metadata: boolean, independent: boolean, trustID: boolean): string[] { return [!metadata ? '消费者跨进程，必须在消息中显式保存受限关联元数据。' : '', !independent ? '次日消费需要新的作业生命周期，不能借用昨日请求的取消。' : '', trustID ? '外部提供的关联 ID 不能证明租户身份；授权要单独验证。' : ''].filter(Boolean); }
