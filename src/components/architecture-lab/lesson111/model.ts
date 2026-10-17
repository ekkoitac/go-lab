export type Scenario = 'browser' | 'internal' | 'export';
export type Transport = 'http' | 'grpc' | 'message';
export interface Config { scenario: Scenario; transport: Transport; interaction: 'sync' | 'task'; adapted: boolean; budget: number; duration: number }
export interface LabState { config: Config; phase: number }
export interface Snapshot { tick: number; event: string; client: string; service: string; handoff: string; progress: number; result: boolean; accepted: boolean; timedOut: boolean; blocked: boolean; edge: 'none' | 'request' | 'accept' | 'work' | 'result' }
export const defaults: Config = { scenario: 'export', transport: 'http', interaction: 'sync', adapted: false, budget: 2, duration: 4 };
export const scenarios: Record<Scenario, string> = { browser: '浏览器查询', internal: '内部计算', export: '报表导出' };
export const transports: Record<Transport, string> = { http: 'HTTP/JSON', grpc: 'gRPC', message: '异步消息' };
const bounded = (value: number) => Number.isFinite(value) ? Math.max(1, Math.min(8, Math.round(value))) : 1;
export function initial(config: Config = defaults): LabState { return { config: { ...config, budget: bounded(config.budget), duration: bounded(config.duration) }, phase: 0 }; }
export function configure(state: LabState, patch: Partial<Config>): LabState { return initial({ ...state.config, ...patch }); }
export function incompatibility(config: Config): string | null {
  if (config.transport === 'message' && config.interaction === 'sync') return '本模型的消息通道只提供任务交接，不能把交接确认当成同步业务结果；请切换异步任务交互。';
  if (config.scenario !== 'internal' && config.transport !== 'http' && !config.adapted) return '浏览器端缺少接入适配，当前请求无法发出；请开启网关／客户端适配，或选择 HTTP/JSON。';
  return null;
}
export function timeline(config: Config): Snapshot[] {
  const start: Snapshot = { tick: 0, event: '配置已就绪，尚未发出请求。', client: '未请求', service: '空闲', handoff: '无任务', progress: 0, result: false, accepted: false, timedOut: false, blocked: false, edge: 'none' };
  const rows = [start];
  const issue = incompatibility(config);
  if (issue) return [...rows, { ...start, event: issue, client: '接入／交互被阻断', blocked: true, edge: 'request' }];
  rows.push({ ...start, event: `${transports[config.transport]} 请求到达服务端；处理尚未完成。`, client: '等待接收', service: '收到请求', edge: 'request' });
  const task = config.interaction === 'task';
  if (task) rows.push({ ...start, tick: 1, event: `${config.transport === 'http' ? 'HTTP 202 + ' : ''}任务编号 T-111 已交接。接收确认只承诺可追踪任务，尚无业务结果。`, client: '持有任务编号 T-111', service: '等待执行', handoff: 'T-111 已记录', accepted: true, edge: 'accept' });
  for (let work = 1; work <= config.duration; work++) {
    const finished = work === config.duration;
    const timedOut = !task && config.duration > config.budget && work >= config.budget;
    rows.push({ ...start, tick: work + (task ? 1 : 0), progress: work, accepted: task, timedOut, result: finished,
      handoff: task ? finished ? 'T-111 结果可查询' : 'T-111 执行中' : '无任务查询契约',
      service: finished ? '业务处理完成' : `处理中 ${work}/${config.duration}`,
      client: task ? '持有任务编号，尚未查询' : timedOut ? '等待超时，结果未知' : finished ? '已取得业务结果' : '等待业务结果',
      edge: finished && !task && !timedOut ? 'result' : 'work',
      event: task ? finished ? '后台已完成。客户端尚未查询，不能仅凭接收确认推断完成。' : `后台推进 1 个处理单位（${work}/${config.duration}）；原请求已结束。`
        : timedOut ? finished ? '服务端后来完成了，但原连接已超时；客户端仍不知道结果。' : `已达到 ${config.budget} 单位等待预算，客户端停止等待；本模型中的服务端继续处理。`
          : finished ? '处理在预算内完成，同步响应携带业务结果。' : `同步连接继续等待；已消耗 ${work}/${config.budget} 单位预算。` });
  }
  if (task) rows.push({ ...rows.at(-1)!, client: '查询后取得业务结果', event: '通过任务编号查询，得到已完成状态和结果；这是与接收确认分开的交互。', edge: 'result' });
  return rows;
}
export function inspect(state: LabState) { const rows = timeline(state.config); return { ...rows[state.phase], done: state.phase >= rows.length - 1, total: rows.length - 1, rows: rows.slice(0, state.phase + 1) }; }
export function advance(state: LabState): LabState { return { ...state, phase: Math.min(timeline(state.config).length - 1, state.phase + 1) }; }
export function rewind(state: LabState): LabState { return { ...state, phase: Math.max(0, state.phase - 1) }; }
