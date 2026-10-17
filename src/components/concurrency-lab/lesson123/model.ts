export type Policy = 'all' | 'critical';
export type Fault = 'recommendation' | 'account' | 'none';
export type Outcome = 'waiting' | 'failed' | 'degraded' | 'complete';
export type TaskState = 'idle' | 'running' | 'success' | 'failed' | 'cancel-pending' | 'cancelled';
export type TaskId = 'account' | 'orders' | 'recommendation';
export interface Config { policy: Policy; fault: Fault; recommendationRequired: boolean; acknowledgement: 1 | 2 }
export interface Task { id: TaskId; name: string; required: boolean; status: TaskState }
export interface Snapshot { tick: number; tasks: Task[]; cancellation: boolean; settled: number; outcome: Outcome; note: string }
export const initialConfig: Config = {policy:'critical',fault:'recommendation',recommendationRequired:false,acknowledgement:2};
export const outcomeLabels: Record<Outcome,string> = {waiting:'等待子任务结束',failed:'整体失败',degraded:'核心可用，推荐明确降级',complete:'完整成功'};
export const stateLabels: Record<TaskState,string> = {idle:'尚未启动',running:'执行中',success:'成功',failed:'失败', 'cancel-pending':'已收到取消，正在清理',cancelled:'取消后已退出'};
export const finalTick = 4;
// Fixed logical events: start=1, fault=2, account success=3, others success=4.
export function snapshot(config: Config, requestedTick: number): Snapshot {
 const tick = Math.max(0, Math.min(finalTick, Math.trunc(requestedTick)));
 const failedId: TaskId | null = config.fault === 'none' ? null : config.fault;
 const cancellation = tick >= 2 && failedId !== null && (config.policy === 'all' || failedId === 'account' || config.recommendationRequired);
 const tasks: Task[] = (['account','orders','recommendation'] as TaskId[]).map(id => {
  let status: TaskState = tick === 0 ? 'idle' : 'running';
  if(tick >= 2 && id === failedId) status = 'failed';
  else if(cancellation) status = tick >= 2 + config.acknowledgement ? 'cancelled' : 'cancel-pending';
  else if(tick >= (id === 'account' ? 3 : 4)) status = 'success';
  return {id,name:id === 'account'?'账户':id === 'orders'?'订单':'推荐',required:id !== 'recommendation'||config.recommendationRequired,status};
 });
 const settled = tasks.filter(t=>['success','failed','cancelled'].includes(t.status)).length;
 const outcome: Outcome = settled < 3 ? 'waiting' : cancellation ? 'failed' : failedId ? 'degraded' : 'complete';
 let note = '账户、订单与推荐准备并行启动。先预测最终响应。';
 if(tick === 1) note = '三个任务都已启动；推荐有自己的有限子预算。';
 if(tick >= 2 && failedId) note = cancellation
  ? settled < 3 ? '失败触发组取消，但取消只是信号；其他任务仍在清理，必须等待它们退出。' : '取消范围内的任务均已退出，等待完成后返回整体失败。'
  : settled < 3 ? '推荐子预算耗尽，只结束推荐；账户和订单继续，不把可选错误返回给必需组。' : '账户和订单成功，推荐显示降级占位；返回的是明确的部分结果。';
 if(tick >= 2 && !failedId) note = settled < 3 ? '没有失败，继续等待尚未完成的任务。' : '三个任务均成功且已结束，返回完整响应。';
 return {tick,tasks,cancellation,settled,outcome,note};
}

