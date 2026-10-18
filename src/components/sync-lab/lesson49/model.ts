export type Placement = 'inside' | 'outside';
export type RequestPhase = 'new' | 'initializing' | 'waiting' | 'business' | 'done';
export interface OnceState {
  placement: Placement; requests: RequestPhase[]; once: 'unused' | 'running' | 'done';
  owner: number | null; progress: number; duration: number; initCount: number; operations: number; message: string;
}
export type Action = {type:'request'; id:number} | {type:'initialize'};
export function initialState(placement: Placement = 'inside', count = 3, duration = 2): OnceState {
  return {placement, requests:Array.from({length:Math.max(2,Math.min(5,Math.trunc(count)))},()=> 'new'), once:'unused', owner:null, progress:0, duration:Math.max(1,Math.min(3,Math.trunc(duration))), initCount:0, operations:0, message:'请选择一个请求调用 Do，再让另一个请求进入，观察等待。'};
}
export function transition(state: OnceState, action: Action): OnceState {
  const s = {...state, requests:[...state.requests]};
  if (action.type === 'initialize') {
    if(s.once !== 'running') return state;
    s.progress++;
    if(s.progress < s.duration) {s.message=`初始化推进到 ${s.progress}/${s.duration}；Do 尚未返回，等待者不能执行业务。`;return s;}
    s.once='done';
    const owner=s.owner!;
    s.requests[owner]=s.placement==='inside'?'done':'business';
    if(s.placement==='inside') s.operations++;
    s.message=`请求 ${owner+1} 完成初始化，Once 标记完成。${s.placement==='inside'?'同一函数体中的业务执行一次。':'初始化者离开 Do，可以执行外部业务。'}等待者现在可以返回 Do。`;
    return s;
  }
  const id=action.id, phase=s.requests[id];
  if(phase===undefined || phase==='done' || phase==='initializing') return state;
  if(phase==='business') {s.requests[id]='done';s.operations++;s.message=`请求 ${id+1} 执行 Do 外的业务；累计业务 ${s.operations} 次，初始化仍为 ${s.initCount} 次。`;return s;}
  if(s.once==='unused') {s.once='running';s.owner=id;s.initCount++;s.requests[id]='initializing';s.message=`请求 ${id+1} 首先进入 Do，开始初始化；初始化未完成时，其他 Do 必须等待。`;return s;}
  if(s.once==='running') {s.requests[id]='waiting';s.message=`请求 ${id+1} 在 Do 内等待：请求 ${s.owner!+1} 尚未完成初始化，不能提前返回。`;return s;}
  s.requests[id]=s.placement==='inside'?'done':'business';
  s.message=`请求 ${id+1} ${phase==='waiting'?'结束等待并返回':'调用'} Do，跳过已执行的函数体。${s.placement==='inside'?'业务也在函数体中，所以这次业务丢失。':'外部业务仍需执行。'}`;
  return s;
}
export function runAll(placement: Placement, count:number, duration=2): OnceState {
  let s=initialState(placement,count,duration);
  for(let id=0;id<s.requests.length;id++) s=transition(s,{type:'request',id});
  for(let step=0;step<s.duration;step++) s=transition(s,{type:'initialize'});
  for(let id=0;id<s.requests.length;id++) {
    s=transition(s,{type:'request',id});
    s=transition(s,{type:'request',id});
  }
  return s;
}
export const phaseLabel: Record<RequestPhase,string>={new:'尚未调用 Do',initializing:'执行初始化',waiting:'等待 Do 返回',business:'待执行外部业务',done:'请求结束'};
