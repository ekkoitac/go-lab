export type Strategy = 'rolling' | 'blueGreen' | 'canary';
export interface Config { strategy: Strategy; extraCapacity: number; representative: boolean; pricingBug: boolean; threshold: number; compatible: boolean }
export interface State { config: Config; phase: 'setup' | 'ready' | 'observe' | 'paused' | 'complete' | 'rolledBack'; traffic: number; stage: number; observedError: number | null; badOrders: number; samples: number; note: string }
export const defaults: Config = { strategy: 'canary', extraCapacity: 20, representative: true, pricingBug: true, threshold: 1, compatible: true };
export const strategies: Record<Strategy, { label: string; extra: number; stages: number[] }> = {
  rolling: { label: '滚动发布', extra: 10, stages: [25, 50, 75, 100] },
  blueGreen: { label: '蓝绿发布', extra: 100, stages: [100] },
  canary: { label: '金丝雀发布', extra: 20, stages: [5, 20, 50, 100] },
};
export function initial(config: Config = defaults): State { return { config: { ...config }, phase: 'setup', traffic: 0, stage: -1, observedError: null, badOrders: 0, samples: 0, note: '先预测：有折扣定价缺陷时，这个方案会在多少流量处停下？' }; }
export function advance(s: State): State {
  if (['paused', 'complete', 'rolledBack'].includes(s.phase)) return s;
  const plan = strategies[s.config.strategy];
  if (s.phase === 'setup') {
    if (s.config.extraCapacity < plan.extra) return { ...s, phase: 'paused', note: `容量不足：需要额外 ${plan.extra} 单位，预算只有 ${s.config.extraCapacity}。尚未切入真实流量。` };
    if (!s.config.compatible) return { ...s, phase: 'paused', note: '状态不兼容：旧版本不能读取新写入。先设计兼容与恢复协议，不能把回切当安全退路。' };
    return { ...s, phase: 'ready', note: `新版本已准备；额外容量 ${plan.extra} 单位。下一步切入 ${plan.stages[0]}% 流量。` };
  }
  if (s.phase === 'ready') {
    const stage = s.stage + 1;
    return { ...s, stage, phase: 'observe', traffic: plan.stages[stage], observedError: null, note: `新版本流量 ${s.traffic}% → ${plan.stages[stage]}%。下一步执行一批订单，再比较同类客群的金额。` };
  }
  const samples = s.traffic * 10;
  // Representative batches contain 20% discount customers; 40% of their prices are wrong.
  const error = s.config.pricingBug && s.config.representative ? 8 : 0;
  // At 100% all customer cohorts are exposed even if the observation sample remains internal-only.
  const actualError = s.config.pricingBug && (s.config.representative || s.traffic === 100) ? 8 : 0;
  const badOrders = s.badOrders + Math.round(samples * actualError / 100);
  const measured = { ...s, samples: s.samples + samples, observedError: error, badOrders };
  if (!s.config.representative) return { ...measured, phase: 'paused', note: `内部账户金额异常率 ${error}%，CPU 正常，但没有折扣客群对照；证据不足，禁止继续放量。${actualError ? '全量流量已产生折扣错误订单。' : ''}` };
  if (error > s.config.threshold) return { ...measured, phase: 'paused', note: `业务门禁暂停：新版本金额异常 ${error}% > 阈值 ${s.config.threshold}%，旧版本同类客群 0%。CPU 正常不改变这个结论。` };
  const complete = s.stage === plan.stages.length - 1;
  return { ...measured, phase: complete ? 'complete' : 'ready', note: `${error}% 金额异常未超过 ${s.config.threshold}% 阈值。${error > 0 ? '阈值过宽已容忍错误，查看累计错误订单。' : '业务对照通过。'}${complete ? '已全量。' : `下一档 ${plan.stages[s.stage + 1]}%。`}` };
}
export function pause(s: State): State { return ['ready', 'observe'].includes(s.phase) ? { ...s, phase: 'paused', note: '操作者暂停放量，当前流量保持。可回切或回退观察历史。' } : s; }
export function rollback(s: State): State { return s.traffic > 0 && s.config.compatible ? { ...s, traffic: 0, phase: 'rolledBack', note: `未来流量回到旧版本；已经写入的 ${s.badOrders} 笔错误订单仍保留，需要另做核对与补偿。` } : s; }
