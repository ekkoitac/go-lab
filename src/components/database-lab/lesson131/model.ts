export type Config = { capacity: number; reserve: number; replicas: number; surge: number; pool: number; demand: number };
export const defaults: Config = {capacity:240,reserve:60,replicas:12,surge:3,pool:30,demand:20};
export const stages = ['原有 6 副本','扩容到目标副本','滚动发布峰值','发布完成'] as const;
export type Snapshot = ReturnType<typeof inspect>;
export type Prediction = {total:number;reason:string};
export type Run = {stage:number;prediction:Prediction;actual:Snapshot};
export type Timeline = {config:Config;stage:number;runs:Run[]};
export function validate(c:Config): void {
  for(const value of Object.values(c)) if(!Number.isFinite(value)||!Number.isInteger(value)||value<0) throw new Error('参数必须为非负整数');
  if(c.capacity<1||c.replicas<1||c.pool<1||c.reserve>c.capacity) throw new Error('容量、副本和池须为正数，预留不能超过容量');
}
export function inspect(config:Config,stage:number){
  validate(config);
  if(!Number.isInteger(stage)||stage<0||stage>3) throw new Error('未知阶段');
  const replicas=stage===0?6:config.replicas+(stage===2?config.surge:0);
  const budget=config.capacity-config.reserve;
  const poolCeiling=replicas*config.pool;
  return {replicas,budget,poolCeiling,total:poolCeiling+config.reserve,over:Math.max(0,poolCeiling-budget),headroom:Math.max(0,budget-poolCeiling),safePerPool:Math.floor(budget/(config.replicas+config.surge)),localWaiting:Math.max(0,config.demand-config.pool)*replicas,demand:config.demand*replicas};
}
export function initial(config:Config={...defaults}):Timeline {validate(config);return {config:{...config},stage:0,runs:[]};}
export function step(state:Timeline,prediction:Prediction):Timeline {
  if(state.stage===3)return state;
  if(!Number.isInteger(prediction.total)||prediction.total<0||!prediction.reason.trim())throw new Error('先记录预测总上限及理由');
  const stage=state.stage+1;
  return {...state,stage,runs:[...state.runs,{stage,prediction:{...prediction},actual:inspect(state.config,stage)}]};
}
export function back(state:Timeline):Timeline {return state.stage===0?state:{...state,stage:state.stage-1,runs:state.runs.slice(0,-1)};}
