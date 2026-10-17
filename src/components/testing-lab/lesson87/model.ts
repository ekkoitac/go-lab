export type Placement = 'inside' | 'outside-reset' | 'outside-counted';
export interface Config { size: number; rounds: number; placement: Placement; consume: boolean; reportAllocs: boolean }
export interface BenchState { config: Config; step: number; prediction: string; reason: string }
export const initialConfig: Config = {size: 4, rounds: 3, placement: 'outside-reset', consume: true, reportAllocs: true};
export function initialState(config: Config = initialConfig): BenchState { return {config: {...config}, step: 0, prediction: '', reason: ''}; }
export function nextStep(state: BenchState): BenchState {
  if (!state.prediction || !state.reason.trim() || state.step >= state.config.rounds + 1) return state;
  return {...state, step: state.step + 1};
}
export function inputFor(size: number): number[] { return Array.from({length: size}, (_, i) => i + 1); }
export function measure(config: Config, step: number) {
  const executed = Math.max(0, Math.min(config.rounds, step - 1));
  const prepared = step > 0;
  const setupCount = config.placement === 'inside' ? executed : Number(prepared);
  const timedSetupCount = config.placement === 'outside-reset' ? 0 : setupCount;
  const setupUnits = timedSetupCount * config.size * 4;
  const workUnits = executed * config.size;
  const expectedSum = inputFor(config.size).reduce((total, value) => total + value, 0);
  return {executed, setupCount, setupUnits, workUnits, totalUnits: setupUnits + workUnits,
    averageUnits: executed ? (setupUnits + workUnits) / executed : null,
    allocations: config.reportAllocs ? timedSetupCount : null,
    sink: config.consume && executed > 0 ? expectedSum : null,
    expectedSum, optimizationRisk: !config.consume};
}
export function compare(config: Config, step: number) {
  return {baseline: measure({...config, placement: 'inside', consume: true}, step), candidate: measure(config, step)};
}
export function scopeFeedback(config: Config, goal: 'sum' | 'end-to-end'): string {
  if (!config.consume) return '结果未被消费：存在被优化或测量失真的风险，不能据此比较算法。具体是否消除计算取决于编译器和代码。';
  if (goal === 'sum') return config.placement === 'outside-reset'
    ? '计时只含求和，准备阶段被 ResetTimer 排除；现在回答的是同一输入上的求和成本。'
    : '当前计时混入准备成本。若问题是求和本身，把准备移到循环前并调用 ResetTimer。';
  return config.placement === 'inside'
    ? '每次操作都包含生成输入与求和，符合端到端目标。准备成本在此是需要测量的工作。'
    : '端到端目标需要每次重新准备；循环前准备一次会遗漏每次请求的工作。';
}
