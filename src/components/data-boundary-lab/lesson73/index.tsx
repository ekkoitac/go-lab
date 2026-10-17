import {useState} from 'react';
import {evaluate,snapshot,validateInput,changeDigit,changedPositions,strategies,outcomeLabels,code,MIN_INT64,MAX_INT64,type Strategy,type Outcome,type Result} from './model';
import './style.css';
const initial='9007199254740993';
function StrategySelect({value,onChange,label='接收策略'}:{value:Strategy;onChange:(v:Strategy)=>void;label?:string}){return <label>{label}<select value={value} onChange={e=>onChange(e.target.value as Strategy)}>{Object.entries(strategies).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>}
function Prediction({value,onChange}:{value:string;onChange:(v:string)=>void}){return <label>预测结果<select value={value} onChange={e=>onChange(e.target.value)}><option value="">先作判断</option>{Object.entries(outcomeLabels).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>}
function Digits({raw,value}:{raw:string;value:string}){return <code className="db73-digits" aria-label={`数值 ${value}`}>{changedPositions(raw,value).map((v,i)=><span key={i} className={v.changed?'db73-changed':''}>{v.char}</span>)}</code>}
function Wire({raw,strategy}:{raw:string;strategy:Strategy}){return <code className="db73-wire">{strategy==='int64'?`{"ID":${raw}}`:strategy==='string'?`{"ID":"${raw}"}`:raw}</code>}
export default function Lesson73(){
 const [raw,setRaw]=useState(initial),[strategy,setStrategy]=useState<Strategy>('float64'),[mode,setMode]=useState('guided'),[phase,setPhase]=useState(0),[prediction,setPrediction]=useState(''),[reason,setReason]=useState(''),[recorded,setRecorded]=useState(false),[revision,setRevision]=useState(''),[reviewed,setReviewed]=useState(false),[baseline,setBaseline]=useState<Result|null>(null);
 const result=evaluate(raw,strategy),state=snapshot(raw,strategy,phase),invalid=validateInput(raw);
 const reset=()=>{setPhase(0);setPrediction('');setReason('');setRecorded(false);setRevision('');setReviewed(false)};
 const change=(r:string,s:Strategy)=>{setRaw(r);setStrategy(s);reset()};
 return <section className="db73" data-testid="data-boundary-lab-73">
  <h3>订单号穿过数字边界</h3><p>同一个订单号，经过解码和整数转换后还能逐位保持吗？先预测，再追踪变化发生在哪一步。</p>
  <div className="db73-actions"><button aria-pressed={mode==='guided'} onClick={()=>{setMode('guided');reset()}}>引导任务</button><button aria-pressed={mode==='free'} onClick={()=>{setMode('free');reset()}}>自由实验</button></div>
  <div className="db73-controls"><label>原始整数文本<input value={raw} maxLength={120} inputMode="numeric" onChange={e=>change(e.target.value,strategy)}/></label><StrategySelect value={strategy} onChange={s=>change(raw,s)}/></div>
  <div className="db73-actions">{[['2⁵³ − 1','9007199254740991'],['2⁵³','9007199254740992'],['2⁵³ + 1',initial],['int64 最大值','9223372036854775807'],['int64 溢出','9223372036854775808']].map(([name,value])=><button key={name} onClick={()=>change(value,strategy)}>{name}</button>)}</div>
  <p className="db73-note">本模型只接收 JSON 整数字面量。字符串策略同时改变发送契约，ID 会带引号。数值是否保持按整数值比较（例如 -0 与 0 相同）。</p>
  {invalid&&<p role="alert">{invalid}</p>}
  {mode==='guided'&&<fieldset disabled={recorded}><legend>预测与依据</legend><Prediction value={prediction} onChange={setPrediction}/><label>判断依据<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪一步可能改变数字？范围检查在哪里？"/></label><button disabled={!prediction||!reason.trim()||!!invalid} onClick={()=>setRecorded(true)}>提交预测</button></fieldset>}
  <div className="db73-actions"><button data-db73-action="back" disabled={phase===0} onClick={()=>setPhase(phase-1)}>回退</button><button data-db73-action="step" disabled={!!invalid||phase===3||(mode==='guided'&&!recorded)} onClick={()=>setPhase(phase+1)}>单步执行</button><button data-db73-action="reset" onClick={reset}>重置实验</button><button disabled={phase<3||!!invalid} onClick={()=>setBaseline(result)}>保存为基线</button></div>
  <div data-testid="live-model" data-state={JSON.stringify(state)} aria-live="polite">
   <ol className="db73-flow">
    <li className={phase===0?'db73-active':''}><b>① 原始请求</b><Wire raw={raw} strategy={strategy}/></li>
    <li className={phase===1?'db73-active':''}><b>② 解码表示</b>{state.decoded?<Digits raw={raw} value={state.decoded}/>:<span>等待解码</span>}</li>
    <li className={phase===2?'db73-active':''}><b>③ 转换 / 范围检查</b>{state.converted?<Digits raw={raw} value={state.converted}/>:<span>等待检查</span>}</li>
   </ol>
   <pre className="db73-code">{code[strategy][phase]}</pre>
   <p className="db73-cause">{phase===0?'当前仍是原始文本，执行后观察接收类型。':phase===1?strategy==='float64'?'数字已进入 float64；粉色下划线标记与输入不同的位。':strategy==='number'?'UseNumber 只保留文本，尚未检查 Int64 的范围。':strategy==='string'?'字符串解码保持编号文本，无数值运算。':'int64 解码已经检查整数范围。':phase===2?'检查转换值和错误。错误发生时不能继续把结果当成有效编号。':result.reason}</p>
   {phase===3&&<p className="db73-verdict">模型结果：{outcomeLabels[result.outcome]} · 数值差：{result.delta??'不可用'}{recorded&&` · 你的预测：${outcomeLabels[prediction as Outcome]}（${prediction===result.outcome?'一致':'需要修正'}）`}</p>}
  </div>
  {baseline&&<aside className="db73-baseline"><b>已保存基线 · {strategies[baseline.strategy]}</b><p>输入 {baseline.raw} → {baseline.converted} · {outcomeLabels[baseline.outcome]}</p><p>当前输入{raw===baseline.raw?'与基线相同，可控制变量比较策略':'与基线不同，请同时考虑输入变化'}。</p><button onClick={()=>setBaseline(null)}>清除基线</button></aside>}
  {phase===3&&<div><label>根据证据修正解释<textarea value={revision} onChange={e=>{setRevision(e.target.value);setReviewed(false)}} placeholder="指出改变发生在哪一步，并写出保留编号的策略。"/></label><button disabled={!revision.trim()} onClick={()=>setReviewed(true)}>记录修正</button>{reviewed&&<p role="status">修正已记录在本轮实验；不计入正式掌握成绩。</p>}</div>}
 </section>
}
function Diagram(){
 const [raw,setRaw]=useState(initial),[stage,setStage]=useState(1);const result=evaluate(raw,'float64');
 return <><h4>数字在哪变了</h4><p>把相邻整数送进同一条浮点管线；点击节点追踪表示，观察两个订单号是否落在同一个值上。</p><label>追踪的整数<input value={raw} onChange={e=>setRaw(e.target.value)} maxLength={120}/></label><div className="db73-actions"><button onClick={()=>setRaw(changeDigit(raw,-1n))}>整数 −1</button><button onClick={()=>setRaw(changeDigit(raw,1n))}>整数 +1</button></div>{validateInput(raw)?<p role="alert">{validateInput(raw)}</p>:<div data-testid="live-model" data-state={JSON.stringify({raw,stage,rounded:result.decoded})}><div className="db73-flow">{['原始整数','float64','转回整数'].map((label,i)=><button className={stage===i?'db73-active':''} onClick={()=>setStage(i)} key={label}>{label}<Digits raw={raw} value={i===0?raw:i===1?result.decoded:result.converted}/></button>)}</div><p>选中节点：{['原始数字仍可用 BigInt 精确表示。','舍入发生在转入 float64 时；并非所有相邻整数都有独立表示。','转回整数只能使用已经舍入的值。'][stage]}</p><p>与原值之差：{result.delta??'不可用'}。下划线显示改变的字符。</p></div>}</>
}
function Comparison(){
 const [raw,setRaw]=useState('9223372036854775808'),[a,setA]=useState<Strategy>('number'),[b,setB]=useState<Strategy>('string'),[show,setShow]=useState(false);
 return <><h4>比较保存策略</h4><p>同一编号超过 int64 范围。选择两种接收契约，执行后比较“保留文本”与“能转成整数”。</p><label>对照整数<input value={raw} maxLength={120} onChange={e=>{setRaw(e.target.value);setShow(false)}}/></label><div className="db73-controls"><StrategySelect label="策略 A" value={a} onChange={v=>{setA(v);setShow(false)}}/><StrategySelect label="策略 B" value={b} onChange={v=>{setB(v);setShow(false)}}/></div><button disabled={!!validateInput(raw)} onClick={()=>setShow(true)}>执行两条管线</button>{validateInput(raw)&&<p role="alert">{validateInput(raw)}</p>}{show&&<div className="db73-flow" data-testid="live-model" data-state={JSON.stringify([evaluate(raw,a),evaluate(raw,b)])}>{[a,b].map((s,i)=>{const r=evaluate(raw,s);return <article key={i}><b>{strategies[s]}</b><Wire raw={raw} strategy={s}/><p>解码：{r.decoded}</p><p>转换：{r.converted}</p><strong>{outcomeLabels[r.outcome]}</strong><p>{r.reason}</p></article>})}</div>}</>
}
function Challenge(){
 const [raw,setRaw]=useState('9007199254740995'),[prediction,setPrediction]=useState(''),[reason,setReason]=useState(''),[revealed,setRevealed]=useState(false),[hint,setHint]=useState(false),[attempt,setAttempt]=useState(0);
 const result=evaluate(raw,'float64');
 const reset=()=>{setPrediction('');setReason('');setRevealed(false);setHint(false);setAttempt(0)};
 return <><h4>寻找精度反例</h4><p>检验断言：“只要原始整数能放进 int64，经过 any 的 float64 再转回也不会变。”选择一个新输入，提交预测后才揭晓。</p><label>反例整数<input value={raw} maxLength={120} onChange={e=>{setRaw(e.target.value);reset()}}/></label><Prediction value={prediction} onChange={v=>{setPrediction(v);setRevealed(false)}}/><label>反例依据<textarea value={reason} onChange={e=>{setReason(e.target.value);setRevealed(false)}}/></label><div className="db73-actions"><button disabled={!prediction||!reason.trim()||!!validateInput(raw)} onClick={()=>{setRevealed(true);setAttempt(attempt+1)}}>提交反例并核对</button><button onClick={()=>setHint(true)}>查看提示</button><button onClick={()=>{setRaw('9007199254740997');reset()}}>换一道练习</button></div>{hint&&<p>提示：2⁵³ 以上的相邻整数并不都可被 float64 精确表示。找一个仍在 int64 范围内、却被舍入的整数。</p>}{validateInput(raw)&&<p role="alert">{validateInput(raw)}</p>}{revealed&&<div data-testid="live-model" data-state={JSON.stringify(result)}><p>{hint?'提示后完成':attempt===1?'首次尝试':'再次尝试'} · 预测{prediction===result.outcome?'一致':'不一致'} · {outcomeLabels[result.outcome]}</p><Digits raw={raw} value={result.decoded}/><p>{result.reason}</p><p>{result.outcome==='changed'&&BigInt(raw)>=MIN_INT64&&BigInt(raw)<=MAX_INT64?'这个输入构成反例：它能放进 int64，却在 float64 中被舍入。':'这个输入尚未构成所需反例。试着改变相邻位，再提交判断。'}</p><p>这是辅助练习，不计入正式掌握成绩。</p></div>}</>
}
export function Help({mode}:{mode:string}){return <section className="db73 db73-help" data-testid="data-boundary-help-73">{mode==='diagram'?<Diagram/>:mode==='steps'?<Comparison/>:<Challenge/>}</section>}

