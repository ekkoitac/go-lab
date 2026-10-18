import {useState} from 'react';
import {code34,trace34,type Config34,type State34,type Strategy34} from './model';
import './style.css';
const labels:Record<Strategy34,string>={direct:'直接传参数',parameter:'有参闭包',closure:'无参闭包读取 n'};
const base:Config34={initial:0,final:10,strategy:'direct'};

const stageNames=['初始化','登记 defer','修改 n','进入退出','执行延迟调用'];
function Board({state,selected,onSelect}:{state:State34;selected?:string;onSelect?:(s:string)=>void}){
 const cells=[{key:'variable',title:'活变量 n',value:String(state.n),detail:'函数局部变量'},{key:'saved',title:'延迟调用记录',value:state.capture==='none'?'尚未登记':state.capture==='value'?'参数副本 = '+state.saved:'闭包引用 → n',detail:state.capture==='variable'?'保存调用，退出时执行闭包体':'登记时求值并保存参数'},{key:'output',title:'日志输出',value:state.output===null?'尚未执行':String(state.output),detail:state.output===null?'登记不会输出日志':'函数退出阶段执行'}];
 return <div className="cf34-board" data-testid="live-model" data-state={JSON.stringify(state)}>{cells.map((c,i)=><div className="cf34-column" key={c.key}>{i>0&&<span className="cf34-link" aria-hidden="true">{i===1?(state.capture==='variable'?'引用变量':'求值 → 保存'):'退出时调用 →'}</span>}{onSelect?<button className={'cf34-card '+(selected===c.key?'cf34-selected':'')} onClick={()=>onSelect(c.key)} aria-pressed={selected===c.key}><small>{c.title}</small><b>{c.value}</b><span>{c.detail}</span></button>:<div className="cf34-card"><small>{c.title}</small><b>{c.value}</b><span>{c.detail}</span></div>}</div>)}</div>;
}
function Runner({guided=false}:{guided?:boolean}){
 const [config,setConfig]=useState<Config34>(base);const [cursor,setCursor]=useState(0);
 const states=trace34(config);const state=states[cursor];
 const update=(patch:Partial<Config34>)=>{setConfig({...config,...patch});setCursor(0);};
 const number=(raw:string)=>Math.max(-100,Math.min(100,Number(raw)||0));
 return <div className="cf34"><p>{guided?'把登记和执行分开走：每一步先看下一条语句，再确认数字是现在读取还是稍后读取。':'下载结束记录字节数：提前保存参数的日志，能看到最终计数吗？改变初值、终值和 defer 写法验证。'}</p>
  <div className="cf34-controls"><label>初始 n<input type="number" min="-100" max="100" value={config.initial} onChange={e=>update({initial:number(e.target.value)})}/></label><label>修改后的 n<input type="number" min="-100" max="100" value={config.final} onChange={e=>update({final:number(e.target.value)})}/></label><label>defer 写法<select value={config.strategy} onChange={e=>update({strategy:e.target.value as Strategy34})}>{Object.entries(labels).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
  <ol className="cf34-timeline">{stageNames.map((s,i)=><li key={s} aria-current={i===cursor?'step':undefined}><span>{i+1}</span>{s}</li>)}</ol>
  <pre><code>{'n := '+config.initial+'\n'+code34[config.strategy]+'\nn = '+config.final+'\nreturn'}</code></pre>
  <Board state={state}/><p className="cf34-feedback" aria-live="polite">{state.reason}</p>
  {guided&&<p className="cf34-question">{cursor===0?'下一步检查：defer 语句有没有实参表达式 n？':cursor===1?'下一步检查：改 n 会不会改已保存的参数副本？':cursor===2?'下一步检查：return 是开始退出，还是已经执行 log？':cursor===3?'下一步检查：调用要使用保存的数值，还是现在读取 n？':'回退到登记时，对照两次读取时点。'}</p>}
  <div className="cf34-actions"><button disabled={cursor===0} onClick={()=>setCursor(cursor-1)}>回退一步</button><button disabled={cursor===4} onClick={()=>setCursor(cursor+1)}>单步执行</button><button onClick={()=>setCursor(0)}>重置</button></div><small>范围：一个 defer、普通整数参数和同一局部变量；不模拟指针实参、多个 defer 的顺序或 panic。改参数会从头开始。</small>
 </div>;
}
export default function Lesson34(){return <section data-testid="control-flow-lab-34"><Runner/></section>;}
function Example(){
 const [final,setFinal]=useState(12);const [step,setStep]=useState(0);
 return <><p>同一场下载，三种日志登记方式。初始计数都是 2；同步单步观察“用了闭包”是否就一定记录最终值。</p><label>最终下载计数 {final}<input type="range" min="0" max="30" value={final} onChange={e=>{setFinal(Number(e.target.value));setStep(0);}}/></label><div className="cf34-compare">{(['direct','parameter','closure'] as Strategy34[]).map(strategy=><article key={strategy}><h4>{labels[strategy]}</h4><pre><code>{code34[strategy]}</code></pre><Board state={trace34({initial:2,final,strategy})[step]}/></article>)}</div><p aria-live="polite">{stageNames[step]}{step===4?'：直接参数与有参闭包输出 2；无参闭包输出 '+final+'。':''}</p><div className="cf34-actions"><button disabled={step===0} onClick={()=>setStep(step-1)}>同步回退</button><button disabled={step===4} onClick={()=>setStep(step+1)}>同步下一步</button><button onClick={()=>setStep(0)}>重置对照</button></div></>;
}
function Diagram(){
 const [strategy,setStrategy]=useState<Strategy34>('direct');const [selected,setSelected]=useState('saved');const [step,setStep]=useState(1);
 const state=trace34({initial:3,final:9,strategy})[step];
 return <><p>探索一条数字的路径：点击变量、保存记录或输出卡，追踪它的来源。切换写法会重建登记记录。</p><div className="cf34-actions">{(['direct','parameter','closure'] as Strategy34[]).map(s=><button key={s} aria-pressed={strategy===s} onClick={()=>{setStrategy(s);setStep(1);}}>{labels[s]}</button>)}</div><pre><code>{code34[strategy]}</code></pre><Board state={state} selected={selected} onSelect={setSelected}/>
 <p className="cf34-feedback" aria-live="polite">{selected==='variable'?'n 是活变量；修改操作把 3 写成 9。保存的普通整数参数不会跟随变化。':selected==='saved'?(strategy==='closure'?(state.output===null?'记录指向闭包，闭包体引用 n；现在还没有读取它。':'闭包体已在退出时读取 n；记录引用变量，并非登记时冻结数值。'):'记录保存数值 3；它来自登记时对实参 n 的求值。'):(state.output===null?'输出尚不存在：只有执行延迟调用才生成日志。':strategy==='closure'?'输出来自退出时读取活变量 n = 9。':'输出来自登记记录中的参数 3，不是当前的 n = 9。')}</p>
 <div className="cf34-actions"><button onClick={()=>setStep(2)} disabled={step!==1}>把活变量改为 9</button><button onClick={()=>setStep(4)} disabled={step!==2}>退出并执行延迟调用</button><button onClick={()=>setStep(1)}>回到登记完成</button></div></>;
}
function Try(){
 const [round,setRound]=useState(0);const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
 const c:Config34={initial:4+round*3,final:17+round*2,strategy:(['parameter','closure','direct'] as Strategy34[])[round%3]};
 const end=trace34(c).at(-1)!;
 return <><p>新情境：任务结束时记录完成件数。先预测 log 的输出并解释读取时点，再执行核对。</p><pre><code>{'n := '+c.initial+'\n'+code34[c.strategy]+'\nn = '+c.final+'\nreturn'}</code></pre><label>预测日志数字<input type="number" value={prediction} disabled={revealed} onChange={e=>setPrediction(e.target.value)}/></label><label>为什么在这个时点读到这个值？<textarea value={reason} disabled={revealed} onChange={e=>setReason(e.target.value)} placeholder="说明是登记时求值，还是退出时执行闭包体读取。"/></label><button disabled={revealed||prediction===''||!reason.trim()} onClick={()=>setRevealed(true)}>提交预测与理由，再执行</button>
 {revealed&&<><Board state={end}/><p className="cf34-feedback" aria-live="polite">{Number(prediction)===end.output?'预测一致。':'预测 '+prediction+' 与实际 '+end.output+' 不同。'}{end.reason} 你的理由：{reason}（理由供自查，不自动评分。）</p><button onClick={()=>{setRound(round+1);setPrediction('');setReason('');setRevealed(false);}}>换一组输入与写法</button></>}<small>辅助迁移练习：首次预测与看过答案后的重试分开，不写入课程成绩。</small></>;
}
export function Help({mode}:{mode:string}){return <section className="cf34" data-testid="control-flow-help-34">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Runner guided/>:<Try/>}</section>;}
