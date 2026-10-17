export type ReaderMode = 'legacy' | 'safe' | 'v2';
export type DeliveryStatus = 'queued' | 'retry' | 'held' | 'done';
export interface Reader { id: string; name: string; mode: ReaderMode; strictFields: boolean }
export interface OrderEvent { id: string; status: 'paid' | 'reviewing'; extraField: boolean }
export interface Delivery { eventId: string; readerId: string; attempts: number; status: DeliveryStatus; detail: string; action: string }
export interface Snapshot { readers: Reader[]; newState: boolean; extraField: boolean; events: OrderEvent[]; deliveries: Delivery[]; notice: string; selectedReader: string | null }
export interface LabState { current: Snapshot; history: Snapshot[] }
export const modes: Record<ReaderMode, string> = { legacy: 'v1：拒绝未知状态', safe: 'v1+：未知态安全隔离', v2: 'v2：明确支持 reviewing' };
export function initial(): LabState { return { current: { readers: [{ id: 'billing', name: '结算', mode: 'legacy', strictFields: false }, { id: 'shipping', name: '履约', mode: 'legacy', strictFields: false }, { id: 'analytics', name: '统计', mode: 'legacy', strictFields: false }], newState: true, extraField: false, events: [], deliveries: [], notice: '写者已启用 reviewing，三个读者仍是 v1。发布事件，检查旧新组合。', selectedReader: null }, history: [] }; }
function commit(state: LabState, current: Snapshot): LabState { return { current, history: [...state.history, state.current] }; }
export function rewind(state: LabState): LabState { return state.history.length ? { current: state.history.at(-1)!, history: state.history.slice(0, -1) } : state; }
export function configureWriter(state: LabState, patch: Partial<Pick<Snapshot, 'newState' | 'extraField'>>): LabState { return commit(state, { ...state.current, ...patch, notice: '写者开关已改变，只影响之后发布的事件；旧队列保持原始内容。', selectedReader: null }); }
export function configureReader(state: LabState, id: string, mode: ReaderMode, strictFields?: boolean): LabState {
  return commit(state, { ...state.current, readers: state.current.readers.map(reader => reader.id === id ? { ...reader, mode, strictFields: strictFields ?? reader.strictFields } : reader), notice: '此读者已独立更新；历史结果保持不变。请显式重试其待处理事件，验证新行为。', selectedReader: id });
}
export function publish(state: LabState): LabState {
  const event: OrderEvent = { id: `E${state.current.events.length + 1}`, status: state.current.newState ? 'reviewing' : 'paid', extraField: state.current.extraField };
  return commit(state, { ...state.current, events: [...state.current.events, event], deliveries: [...state.current.deliveries, ...state.current.readers.map(reader => ({ eventId: event.id, readerId: reader.id, attempts: 0, status: 'queued' as const, detail: '尚未投递', action: '未执行业务动作' }))], notice: `${event.id} 已发布：status=${event.status}${event.extraField ? '，附加 description 字段' : ''}。三个读者各有独立副本。`, selectedReader: null });
}
export function evaluate(reader: Reader, event: OrderEvent): Pick<Delivery, 'status' | 'detail' | 'action'> & { parses: boolean } {
  if (reader.strictFields && event.extraField) return { parses: false, status: 'retry', detail: '严格字段解码拒绝 description，尚未进入业务状态分支', action: '未执行业务动作' };
  if (event.status === 'reviewing' && reader.mode === 'legacy') return { parses: true, status: 'retry', detail: 'JSON 可解析，但 v1 不认识 reviewing；重试不会改变事件语义', action: '未执行业务动作' };
  if (event.status === 'reviewing' && reader.mode === 'safe') return { parses: true, status: 'held', detail: '未知状态已隔离并保留事件，等待升级或人工处理；不是业务成功', action: '暂停业务动作，发出待处理信号' };
  const action = event.status === 'paid' ? { billing: '进入结算', shipping: '允许发货', analytics: '计入已支付' }[reader.id] : { billing: '暂缓结算', shipping: '暂缓发货', analytics: '计入审核中' }[reader.id];
  return { parses: true, status: 'done', detail: event.status === 'reviewing' ? '读者明确识别 reviewing，执行已定义的审核中语义' : '读者识别既有 paid 状态', action: action ?? '执行业务规则' };
}
function deliverAt(state: LabState, index: number): LabState {
  const pending = state.current.deliveries[index];
  if (!pending || pending.status === 'done') return state;
  const reader = state.current.readers.find(item => item.id === pending.readerId)!;
  const event = state.current.events.find(item => item.id === pending.eventId)!;
  const { parses: _parses, ...outcome } = evaluate(reader, event);
  const delivery = { ...pending, ...outcome, attempts: pending.attempts + 1 };
  return commit(state, { ...state.current, deliveries: state.current.deliveries.map((item, i) => i === index ? delivery : item), notice: `${reader.name} 消费 ${event.id}（第 ${delivery.attempts} 次）：${delivery.detail}。`, selectedReader: reader.id });
}
export function advance(state: LabState): LabState { const index = state.current.deliveries.findIndex(item => item.status === 'queued'); return index < 0 ? publish(state) : deliverAt(state, index); }
export function retry(state: LabState, readerId: string): LabState { const index = state.current.deliveries.findIndex(item => item.readerId === readerId && (item.status === 'retry' || item.status === 'held')); return index < 0 ? state : deliverAt(state, index); }
export function counts(state: LabState) { const deliveries = state.current.deliveries; return { queued: deliveries.filter(item => item.status === 'queued').length, retry: deliveries.filter(item => item.status === 'retry').length, held: deliveries.filter(item => item.status === 'held').length, done: deliveries.filter(item => item.status === 'done').length }; }
