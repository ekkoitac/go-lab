import {useState} from 'react';
import {code31,trace31,type Config31,type State31,type Strategy31} from './model';
import './style.css';
const names:Record<Strategy31,string>={copy:'改副本 Price',index:'按下标改 Price',reference:'沿指针改库存'};
const base:Config31={prices:[100,200],stock:5,percent:90,strategy:'copy'};
function Memory({state,focus,select}:{state:State31;focus?:string;select?:(v:string)=>void}){
 return <div className="cf31-memory" data-testid="live-model" data-state={JSON.stringify(state)}>
  <div className="cf31-lane"><strong>原切片 items</strong>{state.items.map((x,i)=><button key={i} type="button" disabled={!select} className={'cf31-cell '+(state.index===i?'cf31-active ':'')+(focus==='source'?'cf31-linked':'')} onClick={()=>select?.('source')}><small>items[{i}]</small><b>Price = {x.price}</b><span>Stock → {x.stockRef}</span></button>)}</div>
  <div className="cf31-lane"><strong>迭代变量 item · 副本</strong><button type="button" disabled={!select} className={'cf31-cell '+(focus==='copy'?'cf31-linked':'')} onClick={()=>select?.('copy')}><small>{state.current?'字段复制，不是元素别名':'等待复制 / 已结束'}</small><b>Price = {state.current?.price??'—'}</b><span>Stock → {state.current?.stockRef??'—'}</span></button><span className="cf31-arrow">Stock 地址相同 ↓</span></div>
  <div className="cf31-lane"><strong>共享整数（指针目标）</strong>{Object.entries(state.heap).map(([ref,value])=><button key={ref} type="button" disabled={!select} className={'cf31-cell '+(focus==='heap'?'cf31-linked':'')} onClick={()=>select?.('heap')}><small>{ref}</small><b>库存 = {value}</b></button>)}</div>
 </div>;
}
function Runner({guided=false}:{guided?:boolean}){
 const [config,setConfig]=useState<Config31>(base);const [step,setStep]=useState(0);const [focus,setFocus]=useState('');
 const states=trace31(config);const state=states[Math.min(step,states.length-1)];
 const update=(patch:Partial<Config31>)=>{setConfig({...config,...patch});setStep(0);};
 return <div className="cf31"><p>{guided?'扮演 range：先复制字段，再执行循环体。每轮两个动作，回退检查写入前后的差异。':'给商品改价格：写在副本还是原切片？再试试副本里的指针。'}</p>
  <div className="cf31-controls"><label>首件原价<input type="number" min="10" max="500" step="10" value={config.prices[0]} onChange={e=>update({prices:[Math.max(10,Math.min(500,Number(e.target.value)||10)),200]})}/></label><label>保留原价百分比<input type="range" min="10" max="100" step="10" value={config.percent} onChange={e=>update({percent:Number(e.target.value)})}/><span>{config.percent}%</span></label><label>循环体策略<select value={config.strategy} onChange={e=>update({strategy:e.target.value as Strategy31})}>{Object.entries(names).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label></div>
  <pre><code>{'type Item struct { Price int; Stock *int }\nfor i, item := range items {\n  '+code31[config.strategy]+'\n}'}</code></pre>
  {guided&&<ol className="cf31-process">{['准备原存储','复制当前元素','执行一次写入','复制下一元素 / 结束'].map((s,i)=><li key={s} aria-current={i===({ready:0,copy:1,write:2,done:3}[state.phase])?'step':undefined}>{s}</li>)}</ol>}
  <Memory state={state} focus={focus} select={setFocus}/><p className="cf31-feedback" aria-live="polite">第 {step} / {states.length-1} 步 · {state.reason}</p>
  <div className="cf31-actions"><button onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}>回退一步</button><button onClick={()=>setStep(Math.min(states.length-1,step+1))} disabled={state.phase==='done'}>单步执行</button><button onClick={()=>setStep(0)}>重置</button></div><small>模型边界：整数运算截断小数；两个结构体各自引用一个库存整数。改变参数从头开始，不计入掌握成绩。</small>
 </div>;
}
export default function Lesson31(){return <section data-testid="control-flow-lab-31"><Runner/></section>;}
function Example(){
 const [percent,setPercent]=useState(90);const [run,setRun]=useState(false);
 return <><p>同一组商品，同时给“复印件”和“原账本”打折。观察相同输入怎样产生不同结算价格。</p><label>保留原价 {percent}%<input type="range" min="10" max="100" step="10" value={percent} onChange={e=>{setPercent(Number(e.target.value));setRun(false);}}/></label><button onClick={()=>setRun(!run)}>{run?'回到折扣前':'并排执行折扣'}</button><div className="cf31-compare">{(['copy','index'] as Strategy31[]).map(strategy=>{const t=trace31({...base,percent,strategy});const state=run?t.at(-1)!:t[0];return <div key={strategy}><h4>{names[strategy]}</h4><Memory state={state}/><p aria-live="polite">原切片合计 {state.items.reduce((s,x)=>s+x.price,0)} 元{run&&(strategy==='copy'?' · 副本改动已丢弃':' · 原存储已写入')}</p></div>;})}</div></>;
}
function Diagram(){
 const [strategy,setStrategy]=useState<Strategy31>('copy');const [written,setWritten]=useState(false);const [focus,setFocus]=useState('copy');const t=trace31({...base,prices:[100],strategy});
 return <><p>选择写入的落点，查看它连接到哪块存储。复制 Price 不会形成写回通道；复制 Stock 地址保留指向库存的连接。</p><div className="cf31-actions">{(['copy','index','reference'] as Strategy31[]).map(s=><button key={s} aria-pressed={strategy===s} onClick={()=>{setStrategy(s);setWritten(false);setFocus(s==='reference'?'heap':s==='index'?'source':'copy');}}>{names[s]}</button>)}</div><pre><code>{code31[strategy]}</code></pre><Memory state={t[written?2:1]} focus={focus} select={setFocus}/><p className="cf31-feedback" aria-live="polite">{written?t[2].reason:focus==='heap'?'items[0].Stock → stock0 ← item.Stock：两份地址指向同一整数。':focus==='source'?'items[0].Price 是原存储；下标写入直接落在这里。':'items[0].Price → 复制 → item.Price：数值相等，存储位置不同。'}</p><button onClick={()=>setWritten(!written)}>{written?'撤销这次写入':'执行所选写入'}</button></>;
}
function Try(){
 const [round,setRound]=useState(0);const [price,setPrice]=useState('');const [stock,setStock]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
 const origin=80+round*20;const c:Config31={prices:[origin],stock:7+round,percent:50,strategy:round%2===0?'reference':'copy'};const result=trace31(c).at(-1)!;
 return <><p>新情境：仓库只有一项物资，Price = {origin}，Stock 指向库存 {c.stock}。预测循环后原切片可读到的价格和库存。</p><pre><code>{'for _, item := range items {\n  '+(c.strategy==='reference'?'*item.Stock += 1':'item.Price = item.Price / 2')+'\n}'}</code></pre>
 <div className="cf31-controls"><label>原元素 Price<input type="number" value={price} disabled={revealed} onChange={e=>setPrice(e.target.value)}/></label><label>沿原元素 Stock 读取库存<input type="number" value={stock} disabled={revealed} onChange={e=>setStock(e.target.value)}/></label></div><label>先解释写入落点<textarea value={reason} disabled={revealed} onChange={e=>setReason(e.target.value)} placeholder="改的是副本字段、原元素还是共享整数？"/></label><button disabled={revealed||!price||!stock||!reason.trim()} onClick={()=>setRevealed(true)}>提交预测与理由，再揭晓</button>
 {revealed&&<><Memory state={result}/><p className="cf31-feedback" aria-live="polite">{Number(price)===result.items[0].price&&Number(stock)===result.heap.stock0?'预测一致。':'对照结果修正预测：'}原 Price = {result.items[0].price}，库存 = {result.heap.stock0}。{c.strategy==='reference'?'复制地址仍指向同一整数，所以库存增加。':'Price 是普通字段，只改副本不会写回原元素。'}你的理由：{reason}（理由供自查，不自动判定掌握。）</p><button onClick={()=>{setRound(round+1);setRevealed(false);setPrice('');setStock('');setReason('');}}>换个情境再预测</button></>}<small>辅助迁移练习：结果仅在提交后揭晓；看过答案后的重试不作为独立掌握证据，不写入课程成绩。</small></>;
}
export function Help({mode}:{mode:string}){return <section className="cf31" data-testid="control-flow-help-31">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Runner guided/>:<Try/>}</section>;}
