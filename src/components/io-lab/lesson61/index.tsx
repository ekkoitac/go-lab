import {useState} from 'react';
import {cases, readState, type Policy, type ReadInput} from './model';
import './style.css';

function ByteBoard({input,policy,step}:{input:ReadInput;policy:Policy;step:number}) {
  const state=readState(input,policy,step);
  return <div className="io61-board" data-testid="live-model" data-state={JSON.stringify(state)}>
    <div className="io61-lane"><strong>Read 缓冲区 p</strong><div className="io61-bytes">{[...input.bytes].map((byte,i)=><span key={i} className={`io61-byte ${step===0?'io61-hidden':i>=input.n?'io61-stale':state.lost?'io61-lost':state.processed?'io61-consumed':'io61-valid'}`}><small>{i}</small>{step===0?'·':byte}</span>)}</div><span>{step===0?'尚未读取':`n = ${input.n}，err = ${input.error??'nil'}`}</span></div>
    <div className="io61-flow" aria-hidden="true">{state.lost?'✕':state.processed?'↓':'⋮'}</div>
    <div className="io61-lane"><strong>业务已消费 p[:n]</strong><div className="io61-bytes">{state.saved?[...state.saved].map((byte,i)=><span className="io61-byte io61-saved" key={i}>{byte}</span>):<span className="io61-empty">空 · 0 字节</span>}</div><span>{state.saved.length} 字节已交给业务</span></div>
    <p className="io61-caption">绿色：本次有效字节；灰色斜纹：p[n:]，不是本次数据；红色：提前退出遗漏的字节。</p>
  </div>;
}
const statusText:Record<string,string>={eof:'遇到 EOF，读取结束。',error:'保留本次可用数据后，上报网络错误；业务仍需决定部分数据是否可接受。','no-progress':'(0,nil) 不是 EOF。本次无进展，应采取有界重试或诊断，不能无限忙循环。',continue:'本次成功，可继续下一次 Read；这不保证完整消息已到齐。',running:'继续单步，追踪数据与错误两条信息。'};
function Experiment({transfer=false,guided=false}:{transfer?:boolean;guided?:boolean}) {
  const [caseId,setCaseId]=useState('final');
  const [policy,setPolicy]=useState<Policy>('error-first');
  const [step,setStep]=useState(0);
  const [prediction,setPrediction]=useState('');
  const [reason,setReason]=useState('');
  const input=transfer?{bytes:'Q7___',n:2,error:'network' as const}:cases[caseId];
  const state=readState(input,policy,step);
  const ready=prediction!==''&&reason.trim().length>0;
  const reset=()=>{setStep(0);setPrediction('');setReason('');};
  return <div className="io61-experiment">
    <p>{transfer?'迁移任务：新 Reader 返回 Q7___，n=2，err=network。先预测两个有效字节能否交给业务。':'目标：让同一次 Read 返回的数据与错误都得到处理。预测之后，再单步追踪字节。'}</p>
    <div className="io61-controls">{!transfer&&<label>Reader 本次返回<select value={caseId} onChange={e=>{setCaseId(e.target.value);reset();}}><option value="final">XYZ? · n=3 · EOF</option><option value="partial">AB?? · n=2 · 网络错误</option><option value="empty">???? · n=0 · nil</option><option value="eof">???? · n=0 · EOF</option><option value="normal">OK?? · n=2 · nil</option></select></label>}
      <label>处理顺序<select value={policy} onChange={e=>{setPolicy(e.target.value as Policy);reset();}}><option value="error-first">先检查 err，再处理数据</option><option value="data-first">先处理 p[:n]，再检查 err</option></select></label>
    </div>
    <fieldset disabled={step>0}><legend>运行前留下预测和理由</legend><label>最终交给业务的字节数<select aria-label="预测消费字节数" value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option>{Array.from(new Set([0,input.n,input.bytes.length])).map(n=><option key={n} value={n}>{n} 字节</option>)}</select></label><label>判断依据<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="n 和 err 各自说明了什么？"/></label></fieldset>
    <ByteBoard input={input} policy={policy} step={step}/>
    <ol className="io61-timeline">{['准备','Read 返回',policy==='data-first'?'消费 p[:n]':'检查 err',policy==='data-first'?'检查 err':'若未退出，消费数据'].map((label,i)=><li key={i} aria-current={step===i?'step':undefined} className={step===i?'io61-current':''}>{label}</li>)}</ol>
    {guided&&<p className="io61-guide">{['先区分 p 的容量与 n：只有前 n 格有效。','数据和错误已经同时返回；看清灰色尾格不是这次数据。',policy==='data-first'?'绿色字节已进入业务。接下来再看 err。':'如果 err 非空，这一行已经退出，后面的消费无法发生。','回到起点交换顺序，再对照同一组字节。'][step]}</p>}
    <div className="io61-actions"><button data-io-action="back" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button data-io-action="step" disabled={!ready||step===3} onClick={()=>setStep(s=>s+1)}>单步执行</button><button data-io-action="reset" onClick={reset}>重置实验</button></div>
    {!ready&&<p className="io61-caption">选择预测并填写理由后，即可执行。</p>}
    <div className="io61-feedback" aria-live="polite">{step===3?<><strong>{Number(prediction)===state.saved.length?'预测与观察一致。':'预测与观察不同。'}</strong> 你预测 {prediction} 字节，实际消费 {state.saved.length} 字节。{state.lost?` err 提前截断了控制流，${state.lost} 仍有效却未消费；交换顺序后重试。`:statusText[state.status]}</>:step===2&&state.lost?`err 已触发退出：${state.lost} 没有进入业务。`:statusText.running}</div>
    <p className="io61-caption">边界：仅模拟一次 ASCII 字节读取与消费顺序，不模拟解码、业务事务或无限重试。消费部分数据不表示业务成功。此处探索和迁移练习不写入正式成绩。</p>
  </div>;
}
function RouteDiagram(){
  const [policy,setPolicy]=useState<Policy>('error-first'); const [step,setStep]=useState(0);
  const state=readState(cases.final,policy,step);
  return <div><p>交换两个处理节点，再追踪同一次 (3,EOF) 返回。连线表示控制流，字节去向与流程同步。</p>
    <button onClick={()=>{setPolicy(p=>p==='data-first'?'error-first':'data-first');setStep(0);}}>交换「消费」与「检查错误」节点</button>
    <svg className="io61-svg" viewBox="0 0 320 260" role="img" aria-label={`当前${policy==='data-first'?'先消费数据':'先检查错误'}，执行到第${step}步`}>
      <path d="M160 52 V80 M160 132 V160 M160 212 V244" fill="none" stroke="#7b91aa" strokeWidth="3"/>
      {[['Read → (3, EOF)',0], [policy==='data-first'?'消费 XYZ':'err != nil → 退出',80],[policy==='data-first'?'err != nil → 结束':'消费 XYZ',160]].map(([label,y],i)=><g key={i}><rect x="30" y={Number(y)+8} width="260" height="44" rx="10" fill={step===i+1?'#c9f0df':i===2&&state.lost?'#ffe1dd':'#edf3fa'} stroke="#8babc5"/><text x="160" y={Number(y)+35} textAnchor="middle" fontSize="15" fill="#20394e">{label}</text></g>)}
      {state.lost&&<path d="M284 143 L308 167 M308 143 L284 167" stroke="#bd4539" strokeWidth="5"/>}
    </svg><div className="io61-actions"><button disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退</button><button disabled={step===3} onClick={()=>setStep(s=>s+1)}>追踪下一节点</button><button onClick={()=>setStep(0)}>重走路径</button></div><ByteBoard input={cases.final} policy={policy} step={step}/></div>;
}
function ParcelExample(){const [count,setCount]=useState(3);const [accepted,setAccepted]=useState(false);return <div><p>快递员递来最后一袋包裹，同时说「没有下一袋了」。EOF 说明后续，不会抹掉手里这一袋。</p><label>袋中包裹数<input type="range" min="0" max="4" value={count} onChange={e=>{setCount(Number(e.target.value));setAccepted(false);}}/>{count} 件</label><div className="io61-parcels"><section><strong>快递员：本袋</strong><div>{!accepted&&Array.from({length:count},(_,i)=><span key={i} aria-label="包裹">📦</span>)}</div><small>通知：EOF，无下一袋</small></section><span aria-hidden="true">→</span><section><strong>收件台</strong><div>{accepted&&Array.from({length:count},(_,i)=><span key={i} aria-label="已接收包裹">📦</span>)}</div><small>已接收 {accepted?count:0} 件</small></section></div><button disabled={accepted} onClick={()=>setAccepted(true)}>先接收本袋，再结束</button><button onClick={()=>setAccepted(false)}>放回本袋</button><p>对应：包裹 = p[:n]，结束通知 = err。真实 Reader 的分块不等于业务消息；类比不表示一字节就是一条订单。</p></div>;}
export default function Lesson61(){return <section className="io61" data-testid="io-lab-61"><h3>数据与错误：双轨交接台</h3><Experiment/></section>;}
export function Help({mode}:{mode:string}){return <section className="io61" data-testid="io-help-61">{mode==='example'?<ParcelExample/>:mode==='diagram'?<RouteDiagram/>:mode==='steps'?<Experiment guided/>:<Experiment transfer/>}</section>;}

