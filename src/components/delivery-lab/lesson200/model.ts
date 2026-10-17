export type Plan = 'split' | 'repair' | 'modular';
export type Config = { investment: number; bottleneck: 'database' | 'coordination'; teams: number; isolation: boolean; maxCost: number };
export const defaults: Config = { investment: 12, bottleneck: 'database', teams: 2, isolation: false, maxCost: 55 };
export const names: Record<Plan, string> = { split: '直接拆服务的小切片', repair: '修热点与补回滚', modular: '模块化单体与交付治理' };
export const plans: Plan[] = ['split', 'repair', 'modular'];
export type Metrics = { latency: number; delivery: number; incidents: number };
export type Outcome = { plan: Plan; baseline: Metrics; observed: Metrics; migration: number; dual: number; operations: number; total: number; isolationMet: boolean; latencyGain: number; deliveryGain: number; reasons: string[]; decision: 'expand' | 'rollback' | 'hold' };
const round = (n: number) => Math.round(n * 10) / 10;
export function evaluate(c: Config, plan: Plan): Outcome {
  const effort = Math.max(4, Math.min(24, c.investment));
  const teams = Math.max(1, Math.min(6, c.teams));
  const readiness = Math.min(1, effort / 16);
  const baseline = { latency: c.bottleneck === 'database' ? 400 : 160, delivery: 2 + teams * 1.5, incidents: c.bottleneck === 'database' ? 8 : 3 };
  const latency = plan === 'repair' ? baseline.latency * (1 - (c.bottleneck === 'database' ? .55 : .05) * readiness) : plan === 'split' ? baseline.latency + 50 - 30 * readiness : baseline.latency * .95;
  const deliveryGain = plan === 'split' ? (teams >= 4 ? .55 : .06) * readiness : plan === 'modular' ? (teams <= 3 ? .35 : .2) * readiness : .1 * readiness;
  const observed = { latency: round(latency), delivery: round(baseline.delivery * (1 - deliveryGain)), incidents: round(plan === 'repair' ? baseline.incidents * (1 - .65 * readiness) : plan === 'split' ? baseline.incidents + 1 : baseline.incidents * (1 - .2 * readiness)) };
  const migration = round(effort * (plan === 'split' ? 1 : plan === 'repair' ? .5 : .7));
  const dual = plan === 'split' ? 8 : plan === 'repair' ? 2 : 3;
  const operations = plan === 'split' ? 8 : plan === 'repair' ? 2 : 3;
  const total = round(migration + dual + operations * 3);
  // This scenario defines isolation as independently deployed identity and data boundaries.
  // Merely naming a service does not meet it: the pilot needs the full validation effort.
  const isolationMet = !c.isolation || (plan === 'split' && effort >= 16);
  const latencyGain = round((baseline.latency - observed.latency) / baseline.latency * 100);
  const actualDeliveryGain = round((baseline.delivery - observed.delivery) / baseline.delivery * 100);
  const reasons: string[] = [];
  let decision: Outcome['decision'] = 'hold';
  if (!isolationMet) reasons.push('硬性身份与数据隔离尚未通过，不能靠性能或成本抵消。');
  if (observed.latency > baseline.latency * 1.2) reasons.push('延迟恶化超过预设20%回退线。');
  if (total > c.maxCost) reasons.push('三个月总投入超过预设预算。');
  const benefit = c.bottleneck === 'database' ? latencyGain >= 15 : actualDeliveryGain >= 25;
  if (!benefit) reasons.push(c.bottleneck === 'database' ? '数据库目标：延迟至少改善15%，本方案未达到。' : '协作目标：交付周期至少改善25%，本方案未达到。');
  if (observed.latency > baseline.latency * 1.2 || total > c.maxCost || (!benefit && !c.isolation)) decision = 'rollback';
  else if (isolationMet && (benefit || c.isolation)) decision = 'expand';
  if (decision === 'expand') reasons.push(c.isolation ? '硬隔离通过且未越过预算/延迟护栏，可扩大受控验证；仍需记录未改善指标。' : '目标改善且护栏通过，可扩大下一小切片，尚非全面迁移证明。');
  return { plan, baseline, observed, migration, dual, operations, total, isolationMet, latencyGain, deliveryGain: actualDeliveryGain, reasons, decision };
}
export type State = { config: Config; plan: Plan; phase: number; prediction: string; reason: string; outcome: Outcome | null; traffic: string };
export const phases = ['建立基线与假设', '核算迁移及双维护', '运行相同负载的小试验', '对照目标与停止线', '执行后续动作'];
export function initial(config: Config = defaults, plan: Plan = 'split', prediction = '', reason = ''): State { return { config: { ...config }, plan, phase: 0, prediction, reason, outcome: null, traffic: '基线' }; }
export function advance(s: State): State {
  if (s.phase >= 4) return s;
  const phase = s.phase + 1;
  const outcome = phase >= 2 ? evaluate(s.config, s.plan) : null;
  const traffic = phase < 2 ? '基线' : phase < 4 ? '10%试验' : outcome?.decision === 'expand' ? '扩大至20%继续验证' : outcome?.decision === 'rollback' ? '回切原流量，保留证据' : '停止扩大，补齐硬隔离';
  return { ...s, phase, outcome, traffic };
}


