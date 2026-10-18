import {useState} from 'react';
import {baseline,codeLines,inspect,type Config,type Query,type Snapshot} from './model';
import './style.css';
function Chain({state,selected,onSelect}:{state:Snapshot;selected:string;onSelect:(s:string)=>void}){
  const selection=state.nodes.find(n=>n.id===selected);const nodes=[...state.nodes].reverse();
  return <div className="cf38-chain" aria-label="错误引用链，从外层向根因">{nodes.map((node,i)=><div key={node.id}>
    <button type="button" className={(state.active===node.id?'cf38-current ':'')+(selection?.cause===node.id?'cf38-related':'')} aria-pressed={selected===node.id} onClick={()=>onSelect(node.id)}>
      <small>{node.layer===null?'原始错误 base':'第 '+(node.layer+1)+' 层 · '+(node.cause?'%w':'%v')} · {node.kind}</small>
      <strong>{node.message}</strong><span>身份：{node.id}{state.visited.includes(node.id)?' · 已检查':''}</span>
    </button>
    {i<nodes.length-1&&<div className={node.cause?'cf38-link':'cf38-cut'}>{node.cause?'↓ Unwrap：引用下方错误对象':'× 无 Unwrap：下方原对象仍存在，但从这里不可到达'}</div>}
  </div>)}</div>;
}
function Result({state,query}:{state:Snapshot;query:Query}){
  return <div className="cf38-feedback" aria-live="polite"><p>{state.message}</p><strong>{state.done?'errors.'+(query==='is'?'Is':'As')+' = '+String(state.found):'尚未得到最终结果'}</strong>{state.extracted&&<p>提取字段：SKU = {state.extracted.sku}，Missing = {state.extracted.missing}</p>}</div>;
}
function Laboratory({tutorial=false}:{tutorial?:boolean}){
  const [config,setConfig]=useState<Config>(()=>tutorial?{...baseline,rootKind:'stock',layers:[{context:'inventory',format:'w'},{context:'order',format:'w'}]}:{...baseline,layers:[...baseline.layers]});
  const [query,setQuery]=useState<Query>('is');const [step,setStep]=useState(0);const [selected,setSelected]=useState(tutorial?'wrap-1':'wrap-0');
  const state=inspect(config,query,step);
  function change(next:Config){setConfig(next);setStep(0);setSelected('wrap-'+(next.layers.length-1));}
  function changeQuery(q:Query){setQuery(q);setStep(0);}
  return <div data-testid="live-model" data-state={JSON.stringify({config,query,step,active:state.active,found:state.found})}>
    <p>{tutorial?'跟踪教程：每一步只检查一个错误对象；回退后可以看到上一层为何继续展开。':'从内向外搭建包装。上下文改变人类可读消息，%w 与 %v 决定是否保留可展开的对象引用。'}</p>
    {!tutorial&&<div className="cf38-settings"><label>根因类型<select value={config.rootKind} onChange={e=>change({...config,rootKind:e.target.value as Config['rootKind']})}><option value="sentinel">errors.New：普通哨兵错误</option><option value="stock">*StockError：带库存字段</option></select></label><label>包装层数<select value={config.layers.length} onChange={e=>{const count=Number(e.target.value);change({...config,layers:Array.from({length:count},(_,i)=>config.layers[i]??{context:['inventory','order','api'][i],format:'w'})});}}>{[1,2,3].map(n=><option key={n} value={n}>{n} 层</option>)}</select></label></div>}
    {!tutorial&&config.layers.map((layer,i)=><div className="cf38-layer" key={i}><strong>第 {i+1} 层 {i===0?'（最内层）':i===config.layers.length-1?'（最外层）':''}</strong><label>上下文 {i+1}<input maxLength={30} value={layer.context} onChange={e=>change({...config,layers:config.layers.map((l,j)=>j===i?{...l,context:e.target.value}:l)})}/></label><label>包装方式 {i+1}<select value={layer.format} onChange={e=>change({...config,layers:config.layers.map((l,j)=>j===i?{...l,format:e.target.value as 'w'|'v'}:l)})}><option value="w">%w 保留引用</option><option value="v">%v 仅保留文本</option></select></label></div>)}
    <div className="cf38-controls"><button type="button" aria-pressed={query==='is'} onClick={()=>changeQuery('is')}>Is：匹配对象身份</button><button type="button" aria-pressed={query==='as'} onClick={()=>changeQuery('as')}>As：提取 *StockError</button></div>
    {query==='is'&&<label>Is 的目标<select value={config.target} onChange={e=>change({...config,target:e.target.value as Config['target']})}><option value="same">同一个 base 对象</option><option value="twin">另建一个 errors.New("no stock")</option></select></label>}
    {config.rootKind==='stock'&&<p className="cf38-note">StockError 实现 Error() 返回 “no stock”，并携带 SKU=book-7、Missing=2；As 按类型提取这些字段。Is 的同文案目标是新对象，不是 base。</p>}
    <pre>{codeLines(config,query).join('\n')}</pre>
    <div className="cf38-controls"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button type="button" disabled={state.done} onClick={()=>{const next=Math.min(step+1,state.trace.length);setStep(next);setSelected(state.trace[next-1].nodeId);}}>检查下一层</button><button type="button" onClick={()=>setStep(0)}>重置查找</button></div>
    <p>已检查 {state.step} 个对象；蓝绿色描边表示当前检查对象，点击卡片可追踪它引用的下层。</p>
    <Chain state={state} selected={selected} onSelect={setSelected}/>
    <p>{state.nodes.find(n=>n.id===selected)?.cause?'选中对象有 Unwrap，浅绿卡片是它直接引用的下一层。':'选中对象没有 Unwrap。若它是 %v 包装，虽然消息包含根因文本，也不能通过它继续访问原错误。'}</p>
    <Result state={state} query={query}/>
    <p className="cf38-note">范围：只模拟单链、直接身份相等和 *StockError 类型匹配，不模拟自定义 Is/As 或 errors.Join 多分支。是否暴露底层错误身份属于公共契约，应明确决定。</p>
  </div>;
}
function Diagram(){
  const [cut,setCut]=useState(true);const [selected,setSelected]=useState('wrap-2');
  const config:Config={...baseline,rootKind:'stock',layers:[{context:'inventory',format:'w'},{context:'order',format:cut?'v':'w'},{context:'api',format:'w'}]};const state=inspect(config,'as',0);const node=state.nodes.find(n=>n.id===selected)!;
  return <div data-testid="live-model" data-state={JSON.stringify({cut,selected,cause:node.cause})}><h3>消息包含根因，等于链能到达根因吗？</h3><p>点击外层卡片追踪它的直接引用，再点击下层。断链以下的对象仅用于解释构造过程，查找不会自动跳过去。</p><button type="button" aria-pressed={!cut} onClick={()=>setCut(v=>!v)}>{cut?'把中间层修复为 %w':'把中间层改成 %v'}</button><Chain state={state} selected={selected} onSelect={setSelected}/><pre>{node.layer===null?'base := &StockError{SKU: "book-7", Missing: 2}':codeLines(config,'as')[node.layer+2]}</pre><p aria-live="polite">选中 {node.id}，直接后继：{node.cause??'无'}。{node.kind==='StockError'?'这里保留结构化字段，不需要从消息截取。':node.cause?'该包装持有下一层对象引用。':'这个对象只保存格式化后的文字。'}</p></div>;
}
function Example(){
  const [context,setContext]=useState('order 42');const [format,setFormat]=useState<'w'|'v'>('v');const [checked,setChecked]=useState(false);
  const config:Config={...baseline,layers:[{context,format}]};const state=inspect(config,'is',99);const message=state.nodes.at(-1)!.message;
  return <div data-testid="live-model" data-state={JSON.stringify({context,format,checked})}><h3>订单号加入错误消息，重试分类为什么失效？</h3><label>订单上下文<input maxLength={30} value={context} onChange={e=>{setContext(e.target.value);setChecked(false);}}/></label><div className="cf38-controls"><button type="button" aria-pressed={format==='v'} onClick={()=>{setFormat('v');setChecked(false);}}>只有文本 %v</button><button type="button" aria-pressed={format==='w'} onClick={()=>{setFormat('w');setChecked(false);}}>保留身份 %w</button></div><div className="cf38-message">给人看的消息<strong>{message}</strong></div><button type="button" onClick={()=>setChecked(true)}>运行两种错误识别</button>{checked&&<div role="status" className="cf38-compare"><div><strong>字符串完全相等</strong><p>err.Error() == "no stock"</p><output>{String(message==='no stock')}</output><p>增加上下文后全文改变。</p></div><div><strong>错误身份检查</strong><p>errors.Is(err, base)</p><output>{String(state.found)}</output><p>{format==='w'?'沿引用找到同一个根因，前缀变化不影响身份。':'文本仍在，但没有 Unwrap 引用，因此找不到根因。'}</p></div></div>}<p className="cf38-note">切换 %v / %w，消息文字相同，身份识别结果可能改变。身份用于分类；是否重试仍应按业务策略决定。</p></div>;
}
function TryIt(){
  const [task,setTask]=useState(0);const [predIs,setPredIs]=useState('');const [predAs,setPredAs]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
  const config:Config=task%2===0?{...baseline,rootKind:'stock',target:'same',layers:[{context:'stock',format:'w'},{context:'load',format:'v'},{context:'api',format:'w'}]}:{...baseline,rootKind:'stock',target:'twin',layers:[{context:'warehouse',format:'w'},{context:'checkout',format:'w'}]};
  const actualIs=inspect(config,'is',99).found,actualAs=inspect(config,'as',99).found;
  return <div data-testid="live-model" data-state={JSON.stringify({task,revealed})}><h3>新链路：预测两个查找结果</h3><p>根因是 *StockError。包装顺序从内到外：{config.layers.map(l=>l.context+' %'+l.format).join(' → ')}。Is 目标：{config.target==='same'?'同一个 base':'另一个 errors.New("no stock") 对象'}。As 目标：*StockError。</p><div className="cf38-settings"><label>预测 Is<select value={predIs} onChange={e=>{setPredIs(e.target.value);setRevealed(false);}}><option value="">请选择</option><option value="true">true</option><option value="false">false</option></select></label><label>预测 As<select value={predAs} onChange={e=>{setPredAs(e.target.value);setRevealed(false);}}><option value="">请选择</option><option value="true">true</option><option value="false">false</option></select></label></div><label>理由：到达哪一层，按身份还是按类型匹配？<textarea value={reason} onChange={e=>{setReason(e.target.value);setRevealed(false);}}/></label><div className="cf38-controls"><button type="button" disabled={!predIs||!predAs||!reason.trim()} onClick={()=>setRevealed(true)}>提交预测与理由，再验证</button><button type="button" onClick={()=>{setTask(t=>t+1);setPredIs('');setPredAs('');setReason('');setRevealed(false);}}>换个情境</button></div>{revealed&&<div role="status"><strong>{predIs===String(actualIs)&&predAs===String(actualAs)?'两个结果均一致':'预测存在差异'}：Is={String(actualIs)}，As={String(actualAs)}</strong><p>{task%2===0?'api 可展开到 load，load 的 %v 已断链，两个查找都无法到达 StockError。':'两层 %w 保持可达；Is 的目标是不同对象所以失败，As 按类型找到 StockError 并能提取字段。'}</p><p>你的理由：{reason}。请用上述路径证据自行核对理由。</p></div>}<p className="cf38-note">这是辅助迁移练习，不记录独立掌握成绩。</p></div>;
}
export default function Lesson38(){return <section className="cf38" data-testid="control-flow-lab-38"><h3>搭一条错误链，逐层查找根因</h3><Laboratory/></section>;}
export function Help({mode}:{mode:string}){return <section className="cf38" data-testid="control-flow-help-38">{mode==='diagram'?<Diagram/>:mode==='steps'?<Laboratory tutorial/>:mode==='try'?<TryIt/>:<Example/>}</section>;}
