export type Gate = 'public' | 'split' | 'internal' | 'guarded';
export type Profile = 'cpu' | 'heap' | 'goroutine';
export type Symptom = 'cpu' | 'memory' | 'waiting';
export interface Config { gate: Gate; origin: 'public' | 'internal'; authorized: boolean; profile: Profile; symptom: Symptom; seconds: number; concurrent: number; budget: number; sameLoad: boolean }
export const initialConfig: Config = { gate: 'public', origin: 'public', authorized: false, profile: 'cpu', symptom: 'cpu', seconds: 30, concurrent: 1, budget: 60, sameLoad: true };
export interface Hop { node: string; detail: string; outcome: 'pass' | 'deny' | 'collect'; cost: number }
export const gateNames: Record<Gate, string> = { public: '公网默认 mux', split: '业务 / 管理 mux 分离', internal: '仅内网，无鉴权', guarded: '管理隔离 + 授权 + 审计' };
export const profileNames: Record<Profile, string> = { cpu: 'CPU 采样', heap: 'Heap 快照', goroutine: 'Goroutine 栈' };
export function estimateCost(c: Config): number { return c.profile === 'cpu' ? c.seconds * c.concurrent : (c.profile === 'heap' ? 12 : 6) * c.concurrent; }
export function profileFits(c: Config): boolean { return ({ cpu: 'cpu', memory: 'heap', waiting: 'goroutine' } as const)[c.symptom] === c.profile; }
export function route(c: Config): Hop[] {
  const hops: Hop[] = [];
  const add = (node: string, detail: string, outcome: Hop['outcome'] = 'pass', cost = 0) => hops.push({ node, detail, outcome, cost });
  if (c.origin === 'public' && c.gate !== 'public') { add('业务入口', '业务 mux 无诊断路由，公网请求被拒绝；授权身份也不能绕过管理网络边界。', 'deny'); return hops; }
  add(c.gate === 'public' ? '公网默认 mux' : '管理 mux', c.gate === 'public' ? 'pprof 注册在业务默认 mux，公网请求命中诊断处理器。' : '请求已到达管理入口；进入内网不代表拥有诊断权限。');
  if (c.gate === 'guarded' && !c.authorized) { add('授权 / 审计', '拒绝：没有诊断权限。拒绝事件已记入审计。', 'deny'); return hops; }
  add('授权 / 审计', c.gate === 'guarded' ? '已验证诊断权限，并记录操作者、版本、采集类型与时间。' : '未设置鉴权与审计：此请求仍会通过，诊断信息可能被未授权访问。');
  const valid = [c.seconds, c.concurrent, c.budget].every(Number.isFinite) && Number.isInteger(c.concurrent) && c.concurrent >= 1 && c.seconds > 0 && c.budget >= 0;
  const cost = estimateCost(c);
  if (!valid || (c.profile === 'cpu' && (c.seconds > 30 || c.concurrent > 1)) || c.concurrent > 2 || cost > c.budget) { add('采集预算', '拒绝采集：CPU 最多 30 秒且同进程一次 1 个；快照最多并发 2 个；预计开销必须在预算内。', 'deny'); return hops; }
  add('采集预算', `预计开销 ${cost} 单位 / 预算 ${c.budget}；${c.profile === 'cpu' ? '时长用于 CPU 采样窗口。' : '本次是快照，CPU 时长参数不参与开销计算。'}`);
  add('Profile 结果', `${profileNames[c.profile]} 已采集。${profileFits(c) ? '所选信号适合当前症状，可作为下一步诊断证据。' : '信号与症状不匹配：采集成功不等于解释了问题。'}${c.gate === 'guarded' ? '审计记录已完成。' : '缺少访问控制，采集成功同时意味着暴露风险。'}`, 'collect', cost);
  return hops;
}
export function comparison(c: Config): string {
  if (!c.sameLoad) return '比较条件不成立：v1 为 100 请求/秒，v2 为 50 请求/秒。热点减少不能直接归因于代码优化。';
  if (c.profile !== 'cpu') return '本题版本对照假设是 CPU 热点下降；当前快照不能替代同负载、同采样窗口的 CPU 比较。';
  return `v1 与 v2：相同 100 请求/秒、同样 ${c.seconds} 秒窗口、相同环境。模拟热点成本 100 → 80 单位，支持继续验证该热点改善；仍需检查业务延迟与其他代价。`;
}
export function result(c: Config): 'deny' | 'allow' { return route(c).at(-1)?.outcome === 'collect' ? 'allow' : 'deny'; }
