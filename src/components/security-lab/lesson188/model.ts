export type Version = '1.0' | '1.1';
export type Exposure = 'reachable' | 'unreachable' | 'unknown' | 'no-known';
export type Decision = 'block' | 'hold' | 'conditional';
export interface Config {
  version: Version; checksum: boolean; callEdge: boolean; productionTag: boolean;
  scanTag: boolean; source: 'controlled' | 'unverified'; buildEvidence: boolean;
  review: boolean; tests: boolean; rollback: boolean;
}
export interface Snapshot {config: Config; phase: number; prediction: Exposure | ''; reason: string}
export interface State extends Snapshot {history: Snapshot[]}
export const initialConfig: Config = {version: '1.0', checksum: true, callEdge: true, productionTag: true, scanTag: true, source: 'controlled', buildEvidence: true, review: false, tests: false, rollback: false};
export const labels: Record<Exposure, string> = {reachable: '已知漏洞可达', unreachable: '已知漏洞在当前构建不可达', unknown: '证据缺失，不能判断', 'no-known': '本模型未匹配已知漏洞'};
export const phases = ['登记依赖与构建', '核对完整性', '核对漏洞与调用路径', '汇总交付证据'];
export function createState(config: Config = initialConfig): State {return {config: {...config}, phase: 0, prediction: '', reason: '', history: []};}
export function exposure(config: Config): Exposure {
  if (!config.buildEvidence || config.scanTag !== config.productionTag) return 'unknown';
  if (config.version === '1.1') return 'no-known';
  return config.callEdge && config.productionTag ? 'reachable' : 'unreachable';
}
export function assess(config: Config): {exposure: Exposure; decision: Decision; evidence: string[]} {
  const result = exposure(config);
  const evidence: string[] = [];
  if (!config.checksum) evidence.push('下载内容与锁定校验和不一致，停止交付并调查来源');
  if (result === 'reachable') evidence.push('教学公告 LAB-188-A 影响 decoder v1.0；生产入口 → adapter → Decode 可达');
  if (result === 'unreachable') evidence.push(config.callEdge ? '生产构建未启用 legacy 标签，Decode 未编入当前路径' : 'adapter → Decode 调用边已断开；此结论仅覆盖所建模入口');
  if (result === 'unknown') evidence.push(!config.buildEvidence ? '缺少版本与构建记录，无法把分析结果绑定到待发布制品' : '扫描标签与生产标签不一致，必须按生产配置重新分析');
  if (result === 'no-known') evidence.push('教学公告只覆盖 v1.0；v1.1 未匹配该公告，不等于没有未知漏洞');
  if (config.source === 'unverified') evidence.push('发布者身份/来源待核验；校验和匹配不能排除维护者账号被接管');
  if (!config.review) evidence.push('缺少升级差异与构建权限审查');
  if (!config.tests) evidence.push('缺少目标生产配置下的兼容性测试证据');
  if (!config.rollback) evidence.push('缺少已验证回退制品与回退路径');
  const blocked = !config.checksum || result === 'reachable';
  const held = result === 'unknown' || config.source === 'unverified' || !config.review || !config.tests || !config.rollback;
  return {exposure: result, decision: blocked ? 'block' : held ? 'hold' : 'conditional', evidence};
}
function snapshot(state: State): Snapshot {return {config: {...state.config}, phase: state.phase, prediction: state.prediction, reason: state.reason};}
export function configure(state: State, patch: Partial<Config>): State {return {...createState({...state.config, ...patch}), history: [...state.history, snapshot(state)]};}
export function step(state: State): State {
  if (!state.prediction || !state.reason.trim() || state.phase >= 3) return state;
  return {...state, phase: state.phase + 1, history: [...state.history, snapshot(state)]};
}
export function back(state: State): State {const previous = state.history.at(-1); return previous ? {...previous, history: state.history.slice(0, -1)} : state;}
