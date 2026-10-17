export type Choice = 'services' | 'modular';
export type Organization = 'independent' | 'merged';
export interface Context { organization: Organization; measuredCost: number }
export interface Record199 {
  id: string; choice: Choice; context: Context; threshold: number;
  evidence: string[]; acceptedCost: string; rationale: string;
  status: 'accepted' | 'superseded'; supersedes?: string; supersededBy?: string;
}
export interface State199 {
  context: Context; records: Record199[]; choice: Choice; threshold: number;
  evidence: { organization: boolean; measurement: boolean }; costAccepted: boolean;
  rationale: string; phase: 'draft' | 'reviewed' | 'published'; notice: string;
}
export type Action199 = { type: 'organization'; value: Organization } | { type: 'measurement' | 'threshold'; value: number } | { type: 'choice'; value: Choice } | { type: 'evidence'; key: 'organization' | 'measurement'; value: boolean } | { type: 'cost'; value: boolean } | { type: 'rationale'; value: string } | { type: 'step' };
export const choices: Record<Choice, { label: string; cost: string }> = {
  services: { label: '保留服务边界', cost: '继续承担跨服务排障、网络与部署协调成本' },
  modular: { label: '合并部署，保留模块边界', cost: '承担迁移成本，并接受共同发布与共同回退' },
};
export function initial199(): State199 {
  return {
    context: { organization: 'independent', measuredCost: 12 },
    records: [{ id: 'ADR-001', choice: 'services', context: { organization: 'independent', measuredCost: 12 }, threshold: 20, evidence: ['两团队必须独立发布', '维护基线 12 人日/月'], acceptedCost: choices.services.cost, rationale: '当时两个团队需要独立部署，因此接受分布式维护成本；超过 20 人日/月或组织要求变化时复评。', status: 'accepted' }],
    choice: 'services', threshold: 20, evidence: { organization: false, measurement: false }, costAccepted: false, rationale: '', phase: 'draft', notice: '先改变组织或成本，观察旧 ADR 的复评条件；再组织证据生成新版本。',
  };
}
export function current199(s: State199): Record199 { return s.records[s.records.length - 1]; }
export function triggers199(s: State199): string[] {
  const active = current199(s);
  return [s.context.organization !== active.context.organization ? '组织的独立发布约束已改变' : '', s.context.measuredCost > active.threshold ? `实测 ${s.context.measuredCost} 人日/月超过原阈值 ${active.threshold}` : ''].filter(Boolean);
}
export function issues199(s: State199): string[] {
  return [
    !s.evidence.organization ? '缺少当前组织约束证据' : '',
    !s.evidence.measurement ? '缺少实测成本证据' : '',
    !s.costAccepted ? '尚未明确接受所选方案的代价' : '',
    s.choice === 'modular' && s.context.organization === 'independent' ? '共同发布无法满足当前必须独立发布的硬约束' : '',
  ].filter(Boolean);
}
export function transition199(s: State199, action: Action199): State199 {
  if (action.type !== 'step') {
    const next: State199 = { ...s, phase: 'draft', notice: '输入已改变：先前复核失效，需按当前证据重新检查。' };
    switch (action.type) {
      case 'organization': next.context = { ...s.context, organization: action.value }; next.evidence = { ...s.evidence, organization: false }; break;
      case 'measurement': next.context = { ...s.context, measuredCost: Math.min(40, Math.max(0, action.value)) }; next.evidence = { ...s.evidence, measurement: false }; break;
      case 'choice': next.choice = action.value; next.costAccepted = false; break;
      case 'threshold': next.threshold = Math.min(40, Math.max(5, action.value)); break;
      case 'evidence': next.evidence = { ...s.evidence, [action.key]: action.value }; break;
      case 'cost': next.costAccepted = action.value; break;
      case 'rationale': next.rationale = action.value; break;
    }
    return next;
  }
  if (s.phase === 'published') return { ...s, notice: '此版本已发布。改变条件或方案后才会开启下一次复评。' };
  const issues = issues199(s);
  if (issues.length) return { ...s, phase: 'draft', notice: `复核未通过：${issues.join('；')}。` };
  if (s.phase === 'draft') return { ...s, phase: 'reviewed', notice: `复核通过：两类证据已绑定，${choices[s.choice].label}满足当前组织约束。下一步发布新 ADR；这不代表已证明现实迁移收益。` };
  const old = current199(s);
  const id = `ADR-${String(s.records.length + 1).padStart(3, '0')}`;
  const record: Record199 = { id, choice: s.choice, context: { ...s.context }, threshold: s.threshold, evidence: [s.context.organization === 'merged' ? '团队合并，共同发布可接受' : '两团队仍必须独立发布', `实测维护成本 ${s.context.measuredCost} 人日/月`], acceptedCost: choices[s.choice].cost, rationale: s.rationale, status: 'accepted', supersedes: old.id };
  return { ...s, records: [...s.records.map(r => r.id === old.id ? { ...r, status: 'superseded' as const, supersededBy: id } : r), record], phase: 'published', notice: `${id} 已接受，${old.id} 标为被替代。旧约束、代价和理由保持原样，可沿双向链接追溯。发布决定不会降低实测成本，若仍超阈值则继续复评。` };
}

