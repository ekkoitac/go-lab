export type Outcome = 'completed' | 'denied' | 'blocked';
export type Config = {authorized: boolean; sink: 'healthy' | 'before' | 'after'; policy: 'block' | 'continue'; actor: boolean; correlation: boolean; leak: boolean; note: string; reader: 'investigator' | 'operator'; retained: boolean};
export const defaults: Config = {authorized: true, sink: 'healthy', policy: 'block', actor: true, correlation: true, leak: false, note: '导出工单 LAB-190', reader: 'investigator', retained: true};
export const labels: Record<Outcome, string> = {completed: '业务实际完成', denied: '授权拒绝，未执行', blocked: '审计前置失败，未执行'};
export const stages = ['配置与预测', '收到请求', '授权与审计前置检查', '业务实际结果', '调查保存证据'];
export type AuditEvent = {event: 'requested' | 'denied' | 'blocked' | 'completed'; actor?: string; action: string; resource: string; result: string; time: string; correlationId?: string; note: string; Authorization?: string; body?: string};
export type State = {config: Config; phase: number; prediction: Outcome | ''; reason: string; history: Omit<State, 'history'>[]};
export const createState = (): State => ({config: {...defaults}, phase: 0, prediction: '', reason: '', history: []});
export function outcome(config: Config): Outcome {return !config.authorized ? 'denied' : config.sink === 'before' && config.policy === 'block' ? 'blocked' : 'completed';}
export function eventFor(config: Config, event: AuditEvent['event']): AuditEvent {
  return {event, ...(config.actor ? {actor: 'trusted:admin-7'} : {}), action: 'customer.export', resource: 'tenant-A:collection-R', result: event === 'requested' ? 'pending' : event === 'completed' ? 'completed:120 rows' : 'not-executed', time: `2026-01-01T10:00:0${event === 'requested' ? 1 : event === 'completed' ? 3 : 2}Z`, ...(config.correlation ? {correlationId: 'corr-LAB-190'} : {}), note: config.note.slice(0, 80), ...(config.leak ? {Authorization: '[教学凭据占位符，不是真实令牌]', body: '[教学正文占位符，不是真实客户资料]'} : {})};
}
export function view(state: State) {
  const {config, phase} = state;
  const actual = outcome(config);
  const events: AuditEvent[] = phase ? [eventFor(config, 'requested')] : [];
  if (phase >= 2 && actual !== 'completed') events.push(eventFor(config, actual));
  if (phase >= 3 && actual === 'completed') events.push(eventFor(config, 'completed'));
  const saved = events.filter(e => config.sink !== 'before' && !(config.sink === 'after' && e.event === 'completed'));
  const issues: string[] = [];
  if (!config.actor) issues.push('缺证 actor：无法从事件追溯可信操作者；自报姓名不能替代认证上下文。');
  if (!config.correlation) issues.push('缺证 correlationId：请求与完成无法可靠关联；不要仅按相近时间猜测。');
  if (config.leak) issues.push('泄漏字段 Authorization 与 body：删除凭据和正文，只保留受限资源标识。');
  if (phase >= 3 && actual === 'completed' && !saved.some(e => e.event === 'completed')) issues.push('缺证 completed：业务已完成，但保存的事件不能证明完成。告警并按协议补记，不得伪称业务已回滚。');
  if (phase >= 2 && config.sink === 'before') issues.push(!config.authorized ? '授权已拒绝：拒绝事件也未保存，需要独立告警；没有进入业务执行。' : config.policy === 'block' ? '审计不可用：前置阻断策略生效；需要独立告警通道处理审计故障。' : '显式继续策略：承担审计缺口并告警、补记；高敏业务通常应选择前置阻断。');
  const readable = phase >= 4 && config.reader === 'investigator' && config.retained;
  return {actual: phase >= 3 ? actual : 'pending', events, saved, issues, readable, visible: readable ? saved : [], serialized: readable ? saved.map(e => JSON.stringify(e)).join('\n') : '', readStatus: phase < 4 ? '尚未进入调查步骤' : config.reader !== 'investigator' ? '读取拒绝：普通操作员没有审计查询权限' : !config.retained ? '保留期已过：本模型记录已清理，需按预定政策处理调查需求' : `授权读取 ${saved.length} 条结构化事件`};
}
const snapshot = ({history: _history, ...state}: State) => state;
export function step(state: State): State {if (!state.prediction || !state.reason.trim() || state.phase >= 4) return state; return {...state, phase: state.phase + 1, history: [...state.history, snapshot(state)]};}
export function back(state: State): State {const previous = state.history.at(-1); return previous ? {...previous, history: state.history.slice(0, -1)} : state;}
export function configure(state: State, patch: Partial<Config>): State {return {...createState(), config: {...state.config, ...patch}, history: [...state.history, snapshot(state)]};}

