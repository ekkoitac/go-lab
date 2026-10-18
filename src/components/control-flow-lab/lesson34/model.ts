export type Strategy34='direct'|'parameter'|'closure';
export interface Config34 {initial:number;final:number;strategy:Strategy34}
export interface State34 {phase:'start'|'registered'|'changed'|'returning'|'called';n:number;saved:number|null;capture:'none'|'value'|'variable';output:number|null;reason:string}
export const code34:Record<Strategy34,string>={direct:'defer log(n)',parameter:'defer func(x int) { log(x) }(n)',closure:'defer func() { log(n) }()'};
export const initial34=(c:Config34):State34=>({phase:'start',n:c.initial,saved:null,capture:'none',output:null,reason:'n 已初始化；尚未执行 defer 语句。'});
export function next34(s:State34,c:Config34):State34{
 switch(s.phase){
 case 'start':return {...s,phase:'registered',saved:c.strategy==='closure'?null:s.n,capture:c.strategy==='closure'?'variable':'value',reason:c.strategy==='closure'?'登记无参闭包：保存调用；闭包体尚未执行，之后会读取同一个变量 n。':'登记 defer：现在计算实参 n = '+s.n+'，保存数值副本；log 还没有执行。'};
 case 'registered':return {...s,phase:'changed',n:c.final,reason:'执行 n = '+c.final+'。变量 '+s.n+' → '+c.final+'；'+(s.capture==='value'?'已保存的参数仍为 '+s.saved+'。':'闭包仍引用这个变量，尚未读取它。')};
 case 'changed':return {...s,phase:'returning',reason:'执行 return，进入退出阶段。开始处理延迟调用；此刻还没有输出。'};
 case 'returning':{const output=s.capture==='variable'?s.n:s.saved;return {...s,phase:'called',output,reason:s.capture==='variable'?'现在执行闭包体，读取当前 n = '+s.n+'，log 输出 '+output+'。':'现在执行已保存的调用，参数是登记时保存的 '+s.saved+'；log 输出 '+output+'。'};}
 default:return s;
 }
}
export function trace34(c:Config34):State34[]{const states=[initial34(c)];while(states.at(-1)!.phase!=='called')states.push(next34(states.at(-1)!,c));return states;}
