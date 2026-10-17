export type Field = 'id' | 'name' | 'riskScore';
export type Strategy = 'direct' | 'dto';
export interface Config { strategy: Strategy; addedRisk: boolean; name: string; risk: number; whitelist: Field[] }
export interface LabState { config: Config; phase: number }
export const defaults: Config = { strategy: 'direct', addedRisk: false, name: '小林', risk: 87, whitelist: ['id', 'name'] };
export const stages = ['准备领域数据', '确定映射路径', '编码公开响应', '检查字段契约'];
export function initial(config: Config = defaults): LabState { return { config: { ...config, whitelist: [...config.whitelist] }, phase: 0 }; }
export function configure(state: LabState, patch: Partial<Config>): LabState { return initial({ ...state.config, ...patch }); }
export function advance(state: LabState): LabState { return { ...state, phase: Math.min(3, state.phase + 1) }; }
export function rewind(state: LabState): LabState { return { ...state, phase: Math.max(0, state.phase - 1) }; }
export function project(domain: Record<string, string | number>, strategy: Strategy, whitelist: readonly string[]) {
  return Object.fromEntries(Object.entries(domain).filter(([key]) => strategy === 'direct' || whitelist.includes(key)));
}
export function checkContract(response: Record<string, string | number>, required: readonly string[]) {
  const keys = Object.keys(response);
  const unexpected = keys.filter(key => !required.includes(key));
  const missing = required.filter(key => !keys.includes(key));
  return { unexpected, missing, passes: !unexpected.length && !missing.length };
}
export function inspect(state: LabState) {
  const domain: Record<string, string | number> = { id: 'U-42', name: state.config.name };
  if (state.config.addedRisk) domain.riskScore = state.config.risk;
  const mapped = project(domain, state.config.strategy, state.config.whitelist);
  return { domain, routed: state.phase >= 1 ? Object.keys(mapped) : [], response: state.phase >= 2 ? mapped : null,
    contract: state.phase >= 3 ? checkContract(mapped, ['id', 'name']) : null };
}
export function trace(state: LabState): string {
  const view = inspect(state);
  if (state.phase === 0) return '领域对象已准备；尚未选择编码路径，也没有发送响应。修改任一条件会重新开始本轮。';
  if (state.phase === 1) return state.config.strategy === 'direct' ? '直接编码：当前领域对象中的所有可编码字段进入公开路径；新增字段也会被带出。' : '显式 DTO：只有白名单中且领域对象实际存在的字段进入公开路径。请检查白名单本身是否正确。';
  if (state.phase === 2) return 'JSON 已生成。能被解析只说明格式有效；下一步核对响应字段是否符合公开契约。';
  return view.contract!.passes ? '契约通过：公开响应恰好包含 id、name，内部新增字段没有改变响应字段集合。' : `契约失败：${view.contract!.unexpected.length ? `多出 ${view.contract!.unexpected.join('、')}；从公开映射中移除内部字段。` : ''}${view.contract!.missing.length ? `缺少 ${view.contract!.missing.join('、')}；恢复必需公开字段。` : ''}`;
}
