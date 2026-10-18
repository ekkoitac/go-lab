export type Format='w'|'v';
export type Query='is'|'as';
export interface Layer { context:string; format:Format }
export interface Config { rootKind:'sentinel'|'stock'; layers:Layer[]; target:'same'|'twin'; sku:string; missing:number }
export interface ErrorNode { id:string; kind:'errorString'|'StockError'|'wrapError'; message:string; cause:string|null; layer:number|null }
export interface Visit { nodeId:string; matched:boolean; message:string }
export interface Snapshot { nodes:ErrorNode[]; trace:Visit[]; step:number; visited:string[]; active:string|null; done:boolean; found:boolean|null; extracted:{sku:string;missing:number}|null; message:string }
export const baseline:Config={rootKind:'sentinel',layers:[{context:'order',format:'v'}],target:'same',sku:'book-7',missing:2};
export function validate(c:Config){
  if(c.layers.length<1||c.layers.length>3)throw new RangeError('需 1–3 层包装');
  if(c.layers.some(l=>!['w','v'].includes(l.format)||l.context.length>30))throw new RangeError('上下文不超过 30 字符');
  if(!Number.isInteger(c.missing)||c.missing<1||c.missing>99)throw new RangeError('库存缺少数量需为 1–99');
}
export function buildChain(c:Config):ErrorNode[]{
  validate(c);
  const nodes:ErrorNode[]=[{id:'root',kind:c.rootKind==='stock'?'StockError':'errorString',message:'no stock',cause:null,layer:null}];
  c.layers.forEach((l,i)=>{const child=nodes.at(-1)!;nodes.push({id:'wrap-'+i,kind:l.format==='w'?'wrapError':'errorString',message:l.context+': '+child.message,cause:l.format==='w'?child.id:null,layer:i});});
  return nodes;
}
export function searchTrace(c:Config,query:Query):Visit[]{
  const nodes=buildChain(c);const trace:Visit[]=[];let current:ErrorNode|undefined=nodes.at(-1);
  while(current){
    const matched=query==='is'?current.id==='root'&&c.target==='same':current.kind==='StockError';
    const why=query==='is'?(matched?'对象身份与 base 相同。':current.id==='root'?'已到原始错误，但目标是另一个同文案对象；身份不同。':'当前包装对象不是目标 base。'):(matched?'类型匹配 *StockError，可提取 SKU 与 Missing。':'当前类型 '+current.kind+' 不是 *StockError。');
    trace.push({nodeId:current.id,matched,message:why+(matched?' 查找成功，停止。':current.cause?' 沿 Unwrap 连线继续。':current.layer!==null?' 这里使用 %v，只剩文本，没有下一条 Unwrap 连线；查找失败。':' 已到链尾，查找失败。')});
    if(matched||!current.cause)break;
    current=nodes.find(n=>n.id===current!.cause);
  }
  return trace;
}
export function inspect(c:Config,query:Query,requestedStep:number):Snapshot{
  const nodes=buildChain(c),trace=searchTrace(c,query);const step=Math.max(0,Math.min(trace.length,Math.trunc(requestedStep)||0));const done=step===trace.length;const found=done?trace.at(-1)!.matched:null;
  return {nodes,trace,step,visited:trace.slice(0,step).map(v=>v.nodeId),active:step?trace[step-1].nodeId:null,done,found,extracted:done&&found&&query==='as'?{sku:c.sku,missing:c.missing}:null,message:step?trace[step-1].message:'查找尚未开始；从最外层错误对象开始检查。'};
}
export function codeLines(c:Config,query:Query):string[]{
  const lines=c.rootKind==='stock'?['base := &StockError{SKU: '+JSON.stringify(c.sku)+', Missing: '+c.missing+'}']:['base := errors.New("no stock")'];
  lines.push('err := error(base)');
  c.layers.forEach(l=>lines.push('err = fmt.Errorf("%s: %'+l.format+'", '+JSON.stringify(l.context)+', err)'));
  if(query==='is')lines.push(c.target==='same'?'errors.Is(err, base)':'other := errors.New("no stock")\nerrors.Is(err, other)');
  else lines.push('var stock *StockError\nerrors.As(err, &stock)');
  return lines;
}
