export type ReturnMode='anonymous'|'named';
export type Operation='add'|'multiply';
export interface Config { initial:number; returnKind:'local'|'literal'; literal:number; operation:Operation; operand:number }
export interface Snapshot { mode:ReturnMode; step:number; local:number; result:number|null; caller:number|null; expression:number|null; message:string }
export const baseline:Config={initial:1,returnKind:'local',literal:5,operation:'add',operand:1};
export const modeLabels:Record<ReturnMode,string>={anonymous:'匿名返回 · 独立返回槽',named:'具名返回 · n 就是返回槽'};
export const stageLabels=['登记 defer，等待 return','求值并写入返回槽','执行 defer','真正离开，交给调用者'];
export function validateConfig(c:Config):void{
  if([c.initial,c.literal,c.operand].some(n=>!Number.isSafeInteger(n)||Math.abs(n)>99))throw new RangeError('输入需为 -99 到 99 的整数');
  if(!['local','literal'].includes(c.returnKind)||!['add','multiply'].includes(c.operation))throw new RangeError('未知运算');
}
export function modify(value:number,c:Config){return c.operation==='add'?value+c.operand:value*c.operand;}
export function returnSnapshot(c:Config,mode:ReturnMode,requestedStep:number):Snapshot{
  validateConfig(c);
  const step=Math.max(0,Math.min(3,Math.trunc(requestedStep)||0));
  const expression=step>=1?(c.returnKind==='local'?c.initial:c.literal):null;
  let local=c.initial;
  let result:number|null=mode==='named'?c.initial:null;
  if(step>=1){result=expression;if(mode==='named')local=expression!;}
  const beforeDefer=local;
  if(step>=2){local=modify(local,c);if(mode==='named')result=local;}
  const caller=step===3?result:null;
  const messages=[
    mode==='named'?'n 已初始化；它同时是局部变量和结果变量。defer 已登记，还没有执行。':'局部 n 已初始化；图中返回槽待 return 写入。defer 已登记，还没有执行。',
    'return 表达式得到 '+expression+'，先写入返回槽。'+(mode==='named'?'这次赋值也把具名 n 改为 '+expression+'。':'局部 n 仍为 '+c.initial+'，返回槽保存独立的整数副本。'),
    'defer 把 n 从 '+beforeDefer+' 改为 '+local+'。'+(mode==='named'?'因为 n 就是结果变量，返回槽同步变为 '+result+'。':'返回槽仍为 '+result+'；修改局部 n 不会重写已复制的整数。')+'调用者此时仍未收到结果。',
    '函数真正离开，调用者收到返回槽中的 '+result+'。'+(mode==='named'?'这是 defer 修改后的结果变量。':'局部 n 的后续变化没有传入返回槽。')
  ];
  return {mode,step,local,result,caller,expression,message:messages[step]};
}
export function codeLines(c:Config,mode:ReturnMode):string[]{
  return [mode==='named'?'func value() (n int) {':'func value() int {','  n '+(mode==='named'?'=':':=')+' '+c.initial,'  defer func() { n '+(c.operation==='add'?'+=':'*=')+' '+c.operand+' }()','  return '+(c.returnKind==='local'?'n':c.literal),'}'];
}
