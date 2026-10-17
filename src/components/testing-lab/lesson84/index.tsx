import { useState } from 'react';
import { baseline, observe, offsetLabel, canReveal, contractResult, type ClockConfig } from './model';
import './style.css';

function Timeline({offset, label}: {offset:number;label:string}) {
  const position = 50 + Math.max(-6, Math.min(6, offset)) * 7.5;
  return <div className="t84-timeline" aria-label={`${label}：${offsetLabel(offset)}`}>
    <div className="t84-track"><span className="t84-expiry">截止</span><span className="t84-pointer" style={{left:`${position}%`}}>●</span></div>
    <div className="t84-ticks"><span>−6 ns</span><span>0 ns</span><span>+6 ns</span></div>
    <strong>{label}：{offsetLabel(offset)}</strong>
  </div>;
}
function Prediction({prediction, reason, setPrediction, setReason, disabled=false}: {prediction:string;reason:string;setPrediction:(v:string)=>void;setReason:(v:string)=>void;disabled?:boolean}) {
 return <fieldset disabled={disabled} className="t84-prediction"><legend>先预测，再解释</legend><label>该规则会返回有效吗？<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择预测</option><option value="true">true：有效</option><option value="false">false：无效</option></select></label><label>判断理由<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明采样时刻、截止时刻与比较符号的关系" rows={2}/></label></fieldset>;
}
export default function Lab() {
 const [config, setConfig] = useState<ClockConfig>({...baseline});
 const [phase, setPhase] = useState(0);
 const [prediction, setPrediction] = useState('');
 const [reason, setReason] = useState('');
 const result = observe(config);
 const change = (patch: Partial<ClockConfig>) => {setConfig(c=>({...c,...patch}));setPhase(0);setPrediction('');setReason('');};
 const reset = () => {setConfig({...baseline});setPhase(0);setPrediction('');setReason('');};
 return <section className="t84" data-testid="testing-lab-84">
  <header><span className="t84-eyebrow">84 · 时间边界实验</span><h3>把时钟停在到期的那一刻</h3><p>契约：优惠券在截止瞬间起无效。操作时间线，逐步追踪「采样 → 比较 → 契约断言」。</p></header>
  <p className="t84-note">教学模拟：以截止时刻为 0，以整数纳秒表示相对时间。不会执行真实 sleep、Go 计时器或调度器。</p>
  <div className="t84-controls">
   <label>计划检查时刻：{offsetLabel(config.offset)}<input type="range" min={-3} max={3} step={1} value={config.offset} onChange={e=>change({offset:Number(e.target.value)})}/></label>
   <div className="t84-actions">{[-1,0,1].map(n=><button key={n} onClick={()=>change({offset:n})} aria-pressed={config.offset===n}>{offsetLabel(n)}</button>)}</div>
   <label>时钟来源<select value={config.source} onChange={e=>change({source:e.target.value as ClockConfig['source']})}><option value="fixed">注入固定 now</option><option value="live">读取运行时 now（延迟模型）</option></select></label>
   <label>检查前调度延迟：{config.delay} ns<input type="range" min={0} max={3} step={1} value={config.delay} onChange={e=>change({delay:Number(e.target.value)})}/></label>
   <label>被测规则<select value={config.rule} onChange={e=>change({rule:e.target.value as ClockConfig['rule']})}><option value="not-after">!now.After(expiry)</option><option value="before">now.Before(expiry)</option></select></label>
  </div>
  <div className="t84-model" data-testid="live-model" data-state={JSON.stringify({config,phase,sample:phase>0?result.sampledOffset:null,actual:phase>1?result.actual:null})}>
   <Timeline offset={config.offset} label="计划位置"/>
   <ol className="t84-phases"><li aria-current={phase===1?'step':undefined}>① 采样时钟</li><li aria-current={phase===2?'step':undefined}>② 比较规则</li><li aria-current={phase===3?'step':undefined}>③ 核对契约</li></ol>
   {phase>0&&<Timeline offset={result.sampledOffset} label="函数实际读取的位置"/>}
   <div aria-live="polite" className="t84-evidence">
    {phase===0&&<p>先填写预测与理由。改变任一条件会清除旧预测，避免混用不同实验的证据。</p>}
    {phase>=1&&<p>{config.source==='fixed'?`固定 now = ${config.offset} ns；即使执行延后 ${config.delay} ns，注入值也不变。`:`运行时 now = 计划 ${config.offset} + 延迟 ${config.delay} = ${result.sampledOffset} ns；检查位置随执行推迟。`}</p>}
    {phase>=2&&<><div className="t84-comparison"><div><code>now.Before(expiry)</code><strong>{String(result.before)}</strong><span>{result.sampledOffset} &lt; 0</span></div><div><code>!now.After(expiry)</code><strong>{String(result.notAfter)}</strong><span>{result.sampledOffset} ≤ 0</span></div></div><p>你的预测：{prediction}；实际：{String(result.actual)}。{prediction===String(result.actual)?'数值吻合。':'预测与采样后的比较结果不同；请沿时间线复核。'} 你的理由：{reason}</p></>}
    {phase>=3&&<p className={result.pass?'t84-pass':'t84-fail'}>契约要求 {String(result.expected)}；当前断言 {result.pass?'PASS':'FAIL'}。{result.sampledOffset===0?'相等时 Before 为 false，!After 为 true；只有严格 Before 符合本题契约。':'此时两个表达式一致；通过这个样本不能证明到期瞬间也正确，请把时间移到 0 ns。'}</p>}
   </div>
  </div>
  <Prediction prediction={prediction} reason={reason} setPrediction={setPrediction} setReason={setReason} disabled={phase>0}/>
  <div className="t84-actions"><button data-testing-action="step" disabled={phase===3||!canReveal(prediction,reason)} onClick={()=>setPhase(p=>Math.min(3,p+1))}>{phase===0?'提交预测并采样':phase===1?'比较两个表达式':phase===2?'核对业务契约':'已完成本次观察'}</button><button disabled={phase===0} onClick={()=>setPhase(p=>Math.max(0,p-1))}>回退一步</button><button data-testing-action="reset" onClick={reset}>重置到期边界</button></div>
  <p className="t84-note">对照建议：先固定在 −1 ns 并增加延迟，再切换运行时 now。固定时钟验证规则；真实计时器与 goroutine 调度仍需集成验证。等待完成应使用完成信号，而非猜测 sleep 时长。本观察不计正式成绩。</p>
 </section>;
}

function Example() {
 const [offset,setOffset]=useState(-1);
 const result=observe({...baseline,offset});
 return <><h4>例子：电子券闸机</h4><p>截止瞬间关闸。把刷券时刻移到截止前、截止点、截止后，看两个程序如何放行。</p><div className="t84-actions">{[-1,0,1].map(v=><button key={v} aria-pressed={v===offset} onClick={()=>setOffset(v)}>{offsetLabel(v)}</button>)}</div><div data-testid="live-model" data-state={String(offset)}><Timeline offset={offset} label="刷券"/><div className="t84-comparison"><div>严格 Before<strong>{result.before?'开闸':'关闸'}</strong></div><div>非 After<strong>{result.notAfter?'开闸':'关闸'}</strong></div></div><p>{offset===0?'就在这个点，两种实现分岔：非 After 多放行了截止瞬间。':'两种实现暂时一致。要区分实现，需要选择恰好相等的输入。'}</p></div><p className="t84-note">类比只表达比较边界；实际闸机的网络、排队和时钟同步未被模拟。</p></>;
}
function Diagram() {
 const [fixed,setFixed]=useState(true);const [delay,setDelay]=useState(0);
 const result=observe({...baseline,source:fixed?'fixed':'live',offset:-1,delay,rule:'before'});
 return <><h4>图解：时间依赖从哪里进入函数？</h4><p>计划在 −1 ns 检查。切换连接，再注入检查前的延迟。</p><div className="t84-actions"><button aria-pressed={fixed} onClick={()=>setFixed(v=>!v)}>当前连接：{fixed?'固定 now':'运行时 now'}</button></div><label>调度延迟 {delay} ns<input type="range" min={0} max={3} value={delay} onChange={e=>setDelay(Number(e.target.value))}/></label><div className="t84-flow" data-testid="live-model" data-state={`${fixed}-${delay}-${result.sampledOffset}`}><div>{fixed?'测试传入 −1 ns':`运行时读取 −1 + ${delay} ns`}</div><span aria-hidden="true">↓ 时间值</span><div><code>valid(now, expiry)</code><br/>{result.sampledOffset} &lt; 0</div><span aria-hidden="true">↓ 比较结果</span><div>{String(result.actual)}</div></div><p>{fixed?'延迟改变执行时刻，但没有改变传入值。':'依赖运行时取值，延迟使输入跨越边界。'} 此图模拟输入依赖，不证明真实调度稳定。</p></>;
}
function Steps() {
 const [step,setStep]=useState(0);
 const steps=['先写契约：到期瞬间无效，不从被测实现抄预期。','固定 expiry，再构造 expiry−1ns、expiry、expiry+1ns 三个输入。','先运行错误的 !After：三个实际值为 true、true、false；中间项违反契约。','替换为 Before，三个实际值为 true、false、false，与规格一致。'];
 return <><h4>分步：用边界表定位并修复</h4><div data-testid="live-model" data-state={`step-${step}`}><ol>{steps.slice(0,step+1).map((s,i)=><li key={s} aria-current={i===step?'step':undefined}>{s}</li>)}</ol>{step>=1&&<div className="t84-table-wrap"><table><thead><tr><th>固定输入</th><th>规格预期</th>{step>=2&&<th>{step===2?'!After':'Before'} 实际</th>}</tr></thead><tbody>{[-1,0,1].map(n=><tr key={n}><td>{n} ns</td><td>{String(n<0)}</td>{step>=2&&<td>{String(step===2?n<=0:n<0)} {step===2&&n===0?'← 反例':''}</td>}</tr>)}</tbody></table></div>}</div><div className="t84-actions"><button disabled={step===0} onClick={()=>setStep(v=>v-1)}>上一步</button><button data-testing-action="step" disabled={step===3} onClick={()=>setStep(v=>v+1)}>下一步</button><button data-testing-action="reset" onClick={()=>setStep(0)}>重看</button></div></>;
}
function Try() {
 const [inclusive,setInclusive]=useState(true);const [offset,setOffset]=useState(0);const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [shown,setShown]=useState(false);
 const clear=()=>{setPrediction('');setReason('');setShown(false);};
 const expected=contractResult(offset,inclusive);
 return <><h4>迁移：换一个借阅证契约</h4><p>新场景：借阅证{inclusive?'截止当天的最后瞬间仍有效（包含截止点）':'从截止瞬间起无效（排除截止点）'}。不要直接套用优惠券规则。</p><label>契约<select value={String(inclusive)} onChange={e=>{setInclusive(e.target.value==='true');clear();}}><option value="true">包含截止瞬间</option><option value="false">排除截止瞬间</option></select></label><label>输入位置<select value={offset} onChange={e=>{setOffset(Number(e.target.value));clear();}}>{[-1,0,1].map(n=><option key={n} value={n}>{offsetLabel(n)}</option>)}</select></label><div data-testid="live-model" data-state={JSON.stringify({inclusive,offset,shown})}><Timeline offset={offset} label="借阅时刻"/><Prediction prediction={prediction} reason={reason} setPrediction={setPrediction} setReason={setReason} disabled={shown}/><button data-testing-action="step" disabled={shown||!canReveal(prediction,reason)} onClick={()=>setShown(true)}>提交并核对新契约</button>{shown&&<p aria-live="polite">你的预测 {prediction}；契约结果 {String(expected)}。{prediction===String(expected)?'判断吻合。':'请重新检查契约是否包含相等。'} 本契约应用 {inclusive?'!now.After(expiry)':'now.Before(expiry)'}。你的理由：{reason}</p>}</div><button data-testing-action="reset" onClick={clear}>重新推理</button><p className="t84-note">这是帮助区的迁移练习，已揭晓的答案与练习表现不写入正式成绩。</p></>;
}
export function Help({mode}:{mode:string}) {
 return <section className="t84 t84-help" data-testid="testing-help-84">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}</section>;
}
