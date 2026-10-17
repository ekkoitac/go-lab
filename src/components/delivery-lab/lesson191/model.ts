export type Layer = 'unit' | 'integration' | 'e2e';
export type Fault = 'amount' | 'transaction' | 'route';
export interface Config { layers: Layer[]; realDependencies: boolean; faults: Fault[] }
export interface Evidence { layer: Layer; status: 'pass' | 'fail' | 'skipped'; cost: number; observed: Fault[]; detected: Fault[]; detail: string }
export const layers: Layer[] = ['unit', 'integration', 'e2e'];
export const layerNames: Record<Layer, string> = { unit: '单元：金额规则', integration: '集成：重复请求与真实约束', e2e: '端到端：首次支付旅程' };
export const faultNames: Record<Fault, string> = { amount: '金额计算错误', transaction: '提交前发消息', route: '网关路由错误' };
export const initialConfig: Config = { layers: ['unit'], realDependencies: true, faults: ['transaction'] };
export function runLayer(config: Config, layer: Layer): Evidence {
  if (!config.layers.includes(layer)) return { layer, status: 'skipped', cost: 0, observed: [], detected: [], detail: '未运行；这道边界没有新增证据。' };
  const observed: Fault[] = layer === 'unit' ? ['amount'] : layer === 'integration' ? (config.realDependencies ? ['transaction'] : []) : config.faults.includes('route') ? ['route'] : ['amount', 'route'];
  const detected = observed.filter(fault => config.faults.includes(fault));
  const detail = layer === 'unit'
    ? `输入 100 分 × 2 件；期望 200 分，实际 ${config.faults.includes('amount') ? 100 : 200} 分。数据库与消息被替换，不能验证事务。`
    : layer === 'integration'
      ? !config.realDependencies ? '替身允许重复插入，没有唯一约束：测试通过也没有验证真实事务。'
        : config.faults.includes('transaction') ? '相同支付键提交两次：数据库保留 1 条，消息却有 2 条；第二条在唯一约束拒绝前已发出。'
        : '相同支付键提交两次：数据库保留 1 条，成功提交后产生 1 条消息；冲突不会泄漏消息。'
      : config.faults.includes('route') ? '浏览器 → 网关：404，支付旅程未到达服务。'
        : config.faults.includes('amount') ? '浏览器首次支付：状态成功，但账单 100 分 ≠ 期望 200 分。'
        : '首次支付：页面成功、订单 1 条、消息 1 条、金额 200 分；此旅程未重放重复请求。';
  return { layer, status: detected.length ? 'fail' : 'pass', cost: layer === 'unit' ? 1 : layer === 'integration' ? 8 : 30, observed, detected, detail };
}
export function snapshot(config: Config, step: number) {
  const evidence = layers.slice(0, Math.max(0, Math.min(3, step))).map(layer => runLayer(config, layer));
  const observed = [...new Set(evidence.flatMap(item => item.observed))];
  return { step: Math.max(0, Math.min(3, step)), evidence, cost: evidence.reduce((sum, item) => sum + item.cost, 0), unknown: (Object.keys(faultNames) as Fault[]).filter(fault => !observed.includes(fault)), detected: [...new Set(evidence.flatMap(item => item.detected))] };
}
export function transactionFrame(afterCommit: boolean, step: number) {
  const phase = Math.max(0, Math.min(3, step));
  return { phase, rows: 1, messages: afterCommit || phase < 1 ? 1 : 2, rejected: phase >= 2, detail: phase === 0 ? '已有支付键 P1：订单 1 条、消息 1 条，准备重试 P1。' : phase === 1 ? afterCommit ? '重试先尝试写事务，消息尚未发送。' : '重试先发消息：消息从 1 条变成 2 条，事务还未提交。' : phase === 2 ? '唯一约束拒绝重复键：数据库仍只有 1 条。' : afterCommit ? '事务失败，禁止发布新消息：1 条订单对应 1 条消息。' : '数据库回滚无法收回已发送消息：1 条订单却有 2 条消息。' };
}
export function budget(units: number, integrations: number, journeys: number) {
  return { cost: units + integrations * 8 + journeys * 30, local: units > 0, constraints: integrations > 0, deployment: journeys > 0 };
}

