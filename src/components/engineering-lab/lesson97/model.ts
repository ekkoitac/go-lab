export type Provider = 'fake' | 'warehouse' | 'remote';
export type Design = 'internal' | 'injected';
export type Contract = 'small' | 'wide';
export type Config = {design: Design; provider: Provider; contract: Contract; quantity: number};
export type State = Config & {phase: number; actual: Provider | null; count: number | null; result: 'accepted' | 'rejected' | 'blocked' | null; reason: string};
export const providers: Record<Provider, {label: string; count: number; methods: string[]}> = {
  fake: {label: '测试替身 fake', count: 3, methods: ['Count']},
  warehouse: {label: '真实仓库 warehouse', count: 99, methods: ['Count', 'Save']},
  remote: {label: 'HTTP 适配器 remote', count: 0, methods: ['Count']},
};
export const baseline: Config = {design: 'internal', provider: 'fake', contract: 'small', quantity: 4};
export function initial(config: Config = baseline): State {return {...config, phase: 0, actual: null, count: null, result: null, reason: '先连接依赖，预测订购结果，再逐步运行。'};}
export function advance(s: State): State {
  if(s.phase >= 3) return s;
  if(s.phase === 0) {
    if(s.design === 'injected' && s.contract === 'wide' && !providers[s.provider].methods.includes('Save')) return {...s, phase: 3, result: 'blocked', reason: '编译边界阻止调用：传入实现没有 Save，不能满足宽接口。业务只读库存，删掉这个多余要求即可。'};
    const actual = s.design === 'internal' ? 'warehouse' : s.provider;
    return {...s, actual, phase: 1, reason: s.design === 'internal' ? 'available 内部构造 warehouse，传入的实现没有参与本次调用。' : `构造方注入 ${s.provider}，业务仅持有接口；实际调用分派到 ${s.provider}.Count。`};
  }
  if(s.phase === 1) return {...s, phase: 2, count: providers[s.actual!].count, reason: `${s.actual}.Count() 返回 ${providers[s.actual!].count}。库存来源由上一阶段的依赖绑定决定。`};
  const accepted = s.count! >= s.quantity;
  return {...s, phase: 3, result: accepted ? 'accepted' : 'rejected', reason: `业务规则不变：库存 ${s.count} ${accepted ? '≥' : '<'} 订购量 ${s.quantity}，所以${accepted ? '接受' : '拒绝'}订单。`};
}
export function at(config: Config, phase: number): State {let state = initial(config); for(let i=0;i<phase && state.phase<3;i++) state=advance(state); return state;}
