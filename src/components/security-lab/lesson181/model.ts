export type Role = 'reader' | 'editor' | 'unknown';
export type Action = 'read' | 'update' | 'delete' | 'export';
export interface Request { trusted: boolean; tenant: string; resourceTenant: string; role: Role; action: Action; claimedRole: Role }
export type Verdict = 'allow' | 'identity' | 'tenant' | 'permission';
export interface Prediction { value: Verdict; reason: string }
export interface State { request: Request; phase: number; prediction: Prediction | null }
export const defaults: Request = {trusted:true,tenant:'A',resourceTenant:'B',role:'reader',action:'delete',claimedRole:'editor'};
export const labels: Record<Verdict,string> = {allow:'允许执行',identity:'身份不可信，拒绝',tenant:'租户不匹配，拒绝',permission:'动作没有权限，拒绝'};
export function authorize(r: Request): Verdict {
  if (!r.trusted) return 'identity';
  if (!r.tenant || r.tenant !== r.resourceTenant) return 'tenant';
  if (r.role === 'reader' && r.action === 'read') return 'allow';
  if (r.role === 'editor' && (r.action === 'read' || r.action === 'update')) return 'allow';
  return 'permission';
}
export function initial(request: Request = defaults): State { return {request:{...request},phase:0,prediction:null}; }
export function step(s: State, prediction?: Prediction): State {
  if (s.phase >= 4) return s;
  const p = s.prediction ?? prediction;
  if (!p || !p.reason.trim() || !Object.hasOwn(labels,p.value)) throw new Error('先提交预测与理由');
  return {...s,phase:s.phase+1,prediction:{...p}};
}
export function back(s: State): State { return {...s,phase:Math.max(0,s.phase-1),prediction:s.phase<=1?null:s.prediction}; }
export function observe(s: State) {
  const r=s.request, verdict=authorize(r);
  const gates: ('pending'|'pass'|'deny'|'skip')[] = [
    s.phase<1?'pending':r.trusted?'pass':'deny',
    s.phase<2?'pending':!r.trusted?'skip':!r.tenant||r.tenant!==r.resourceTenant?'deny':'pass',
    s.phase<3?'pending':verdict==='identity'||verdict==='tenant'?'skip':verdict==='permission'?'deny':'pass',
  ];
  const completed=s.phase===4;
  const secureExecuted=completed&&verdict==='allow';
  const weakExecuted=completed&&r.trusted;
  return {gates,verdict:completed?verdict:null,secureExecuted,weakExecuted,
    secureOrder:secureExecuted&&r.action==='delete'?'已删除':secureExecuted&&r.action==='update'?'已更新':'原始订单',
    weakOrder:weakExecuted&&r.action==='delete'?'已删除':weakExecuted&&r.action==='update'?'已更新':'原始订单'};
}
