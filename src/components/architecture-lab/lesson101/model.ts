export type Topology = 'monolith' | 'services';
export type ChangeScope = 'shared' | 'settlement';
export interface Config { topology: Topology; scope: ChangeScope; compatible: boolean; hotSettlement: boolean }
export interface LabState { config: Config; phase: number }
export const defaults: Config = { topology: 'services', scope: 'shared', compatible: false, hotSettlement: false };
export const modules = ['订单', '优惠', '结算'] as const;
export function initial(config: Config = defaults): LabState { return { config: { ...config }, phase: 0 }; }
export function advance(state: LabState): LabState { return { ...state, phase: Math.min(state.config.topology === 'services' && state.config.scope === 'shared' ? 3 : 1, state.phase + 1) }; }
export function rewind(state: LabState): LabState { return { ...state, phase: Math.max(0, state.phase - 1) }; }
export function inspect(state: LabState) {
  const { topology, scope, compatible, hotSettlement } = state.config;
  const affected = scope === 'shared' ? [0, 1, 2] : [2];
  const released = state.phase === 0 ? [] : topology === 'monolith' ? affected : affected.slice(0, state.phase);
  const versions = modules.map((_, i) => released.includes(i) ? 2 : 1);
  const mixed = scope === 'shared' && new Set(versions).size > 1;
  const blocked = mixed && !compatible;
  const deployments = state.phase === 0 ? 0 : topology === 'monolith' ? 1 : released.length;
  const totalDeployments = topology === 'monolith' ? 1 : affected.length;
  // One replica per module is one teaching resource unit; settlement demand is four replicas when hot.
  const replicas = hotSettlement ? topology === 'monolith' ? [4, 4, 4] : [1, 1, 4] : [1, 1, 1];
  return { affected, released, versions, mixed, blocked, deployments, totalDeployments, replicas,
    resourceUnits: replicas.reduce((a, b) => a + b, 0), remoteCalls: topology === 'services' ? 2 : 0,
    done: released.length === affected.length };
}
export function trace(state: LabState): string {
  const result = inspect(state);
  if (!state.phase) return '尚未发布：三个模块都运行 v1。先选择变更范围，再推进同一轮发布。';
  if (result.blocked) return `已发布 ${result.released.map(i => modules[i]).join('、')}；跨模块规则 v1 / v2 混用，当前请求被契约校验拒绝。`;
  if (result.mixed) return '仍在滚动发布；兼容桥接允许旧、新规则协议共存，请求继续，但要维护两个版本。';
  if (result.done) return state.config.scope === 'shared' ? '规则变更完成：三个模块统一为 v2；发布数量没有消除共同变更。' : '结算内部算法已更新；对外协议未变，订单和优惠继续运行 v1。';
  return '本步未改变业务版本。';
}

