export type Tenant = 'A' | 'B';
export type Policy = 'global' | 'dual';
export type Job = {id:number; tenant:Tenant; status:'running'|'rejected'|'completed'|'cancelled'};
export type QuotaState = {policy:Policy; jobs:Job[]; tick:number; note:string};
export type Action = {type:'submit'; tenant:Tenant} | {type:'complete'|'cancel'; id:number};
export const initialQuota = (policy:Policy):QuotaState => ({policy,jobs:[],tick:0,note:'尚未申请；两种策略接受相同操作。'});
export const running = (state:QuotaState, tenant?:Tenant) => state.jobs.filter(j=>j.status==='running' && (!tenant || j.tenant===tenant));
export function applyQuota(state:QuotaState, action:Action):QuotaState {
  const tick=state.tick+1;
  if(action.type==='submit') {
    const full=running(state).length>=4;
    const tenantFull=state.policy==='dual' && running(state,action.tenant).length>=2;
    const denied=full || tenantFull;
    return {...state,tick,jobs:[...state.jobs,{id:tick,tenant:action.tenant,status:denied?'rejected':'running'}],note:denied?`${action.tenant}${tick} 拒绝：${full?'全局已满4槽':'该租户已满2槽'}；两个计数均不增加。`:`${action.tenant}${tick} 获准：同时登记全局与租户占用。`};
  }
  const job=state.jobs.find(j=>j.id===action.id);
  if(!job || job.status!=='running') return {...state,tick,note:`任务 #${action.id} 没有运行中的预留；重复或无效释放不改变计数。`};
  return {...state,tick,jobs:state.jobs.map(j=>j.id===action.id?{...j,status:action.type==='complete'?'completed':'cancelled'}:j),note:`${job.tenant}${job.id} ${action.type==='complete'?'完成':'取消'}：全局与租户占用同时减1。`};
}
export const compareActions=(actions:Action[])=>actions.reduce((pair,action)=>({global:applyQuota(pair.global,action),dual:applyQuota(pair.dual,action)}),{global:initialQuota('global'),dual:initialQuota('dual')});
