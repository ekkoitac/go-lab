export type CaptureMode = 'shared' | 'iteration' | 'parameter';
export const modes: CaptureMode[] = ['shared', 'iteration', 'parameter'];
export const modeLabels: Record<CaptureMode,string> = { shared:'循环外 = · 共用变量', iteration:'循环内 := · 每轮变量', parameter:'显式传值 · 工厂参数' };
export interface Cell { id:string; value:number }
export interface Callback { id:number; cellId:string; registeredValue:number }
export interface Snapshot { mode:CaptureMode; step:number; phase:'ready'|'register'|'loop-end'|'execute'|'done'; cells:Cell[]; callbacks:Callback[]; outputs:number[]; message:string }
export function parseValues(text:string):number[] {
  const pieces=text.trim().split(/[,，\s]+/);
  if(pieces.length<2||pieces.length>4||pieces.some(p=>!/^-?\d+$/.test(p))) throw new Error('请输入 2–4 个整数，用逗号分隔。');
  const values=pieces.map(Number);
  if(values.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>999)) throw new Error('每个整数应在 -999 到 999 之间。');
  return values;
}
export const lastStep=(values:number[])=>values.length*2+1;
export function captureSnapshot(values:number[],mode:CaptureMode,requestedStep:number):Snapshot {
  if(values.length<2||values.length>4||values.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>999)) throw new RangeError('需 2–4 个范围内整数');
  const step=Math.max(0,Math.min(lastStep(values),Math.trunc(requestedStep)||0));
  const registered=Math.min(values.length,step);
  const callbacks=values.slice(0,registered).map((value,id)=>({id,cellId:mode==='shared'?'v':(mode==='iteration'?'v':'x')+(id+1),registeredValue:value}));
  const cells=mode==='shared'?[{id:'v',value:registered?values[registered-1]:0}]:callbacks.map(c=>({id:c.cellId,value:c.registeredValue}));
  const executed=Math.max(0,step-values.length-1);
  const outputs=callbacks.slice(0,executed).map(c=>cells.find(cell=>cell.id===c.cellId)!.value);
  const phase=step===0?'ready':step<=values.length?'register':step===values.length+1?'loop-end':step===lastStep(values)?'done':'execute';
  let message='尚未注册回调；闭包将在之后执行时读取所引用的变量。';
  if(phase==='register') message=mode==='shared'?'第 '+step+' 轮：v 从 '+(step===1?0:values[step-2])+' 改为 '+values[step-1]+'；新回调连接同一个 v，之前的连线不变。':'第 '+step+' 轮：新建 '+callbacks.at(-1)!.cellId+'='+values[step-1]+'；新回调连接这个独立变量。';
  if(phase==='loop-end') message='循环已结束，注册不等于执行。现在开始依次调用回调。';
  if(phase==='execute'||phase==='done') message='执行回调 '+executed+'：沿 '+callbacks[executed-1].cellId+' 的连线读到 '+outputs.at(-1)+'（登记时输入 '+callbacks[executed-1].registeredValue+'）。'+(mode==='shared'?'读取共享变量的当前值，不是登记时的快照。':'该回调引用的独立变量未被后续迭代覆盖。');
  return {mode,step,phase,cells,callbacks,outputs,message};
}
export function finalOutput(values:number[],mode:CaptureMode){return captureSnapshot(values,mode,lastStep(values)).outputs;}
