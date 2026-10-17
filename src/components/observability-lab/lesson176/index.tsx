import {useState} from 'react';
import {defaults,simulate,traces,transferTraces,winner,type Config,type Status} from './model';
import './style.css';
const status:Record<Status,string>={pending:'未到达',buffered:'缓存等待',kept:'保留', 'head-drop':'入口丢弃',overflow:'容量拒收',timeout:'等待超时','normal-drop':'正常未采中','budget-drop':'存储预算丢弃'};
const percent=(n:number,d:number)=>d?`${Math.round(n/d*100)}%`:'无样本';
export default function Lesson176(){
 const [config,setConfig]=useState<Config>({...defaults}),[tick,setTick]=useState(-1),[prediction,setPrediction]=useState(''),[reason,setReason]=useState(''),[selected,setSelected]=useState('B');
 const s=simulate(config,tick),finished=tick===8,started=tick>=0;
 const configure=(change:Partial<Config>)=>{setConfig(c=>({...c,...change}));setTick(-1);setPrediction('');setReason('');};
 const reset=()=>{setTick(-1);setPrediction('');setReason('');};
 const ti=traces.findIndex(t=>t.id===selected),source=traces[ti];
 const sample=s.tail.filter(r=>r.status==='kept'),fullRate=percent(s.truthErrors,s.completed),sampleRate=percent(s.tailErrors,sample.length);
 return <section className="obs176" data-testid="observability-lab-176">
 <h3>让同一批 Trace 穿过两个采样器</h3>
 <p>目标：解释入口省下的成本、等待消耗的容量，以及为什么“错误优先”仍会漏掉错误。</p>
 <div className="obs176-controls">
 <label>缓存容量（条）<select aria-label="尾采缓存容量" value={config.capacity} disabled={started} onChange={e=>configure({capacity:Number(e.target.value)})}>{[1,2,3,6].map(n=><option key={n}>{n}</option>)}</select></label>
 <label>等待窗口（秒）<select aria-label="尾采等待窗口" value={config.wait} disabled={started} onChange={e=>configure({wait:Number(e.target.value)})}>{[1,2,3,4,6].map(n=><option key={n}>{n}</option>)}</select></label>
 <label>头采阈值<select aria-label="头采比例" value={config.headPercent} disabled={started} onChange={e=>configure({headPercent:Number(e.target.value)})}><option value={20}>20%</option><option value={50}>50%</option><option value={100}>100%</option></select></label>
 <label className="obs176-check"><input type="checkbox" checked={config.prefilter} disabled={started} onChange={e=>configure({prefilter:e.target.checked})}/> 尾采之前也经过头采</label>
 </div>
 <p className="obs176-note">固定输入：A 0→1 正常，B 0→2 错误，C 1→3 正常，D 2→6 错误，E 3→4 正常，F 4→5 错误（单位秒）。入口散列分别 10/70/30/80/40/90，小于阈值即选中；这是固定示例，不是随机采样概率的实测证明。</p>
 <fieldset disabled={started}><legend>先预测终局，再运行</legend><label>最终哪一路留下更多错误 Trace？<select aria-label="采样结果预测" value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="tail">尾采更多</option><option value="head">头采更多</option><option value="same">一样多</option></select></label><label>理由（哪些错误会被容量、等待或入口丢弃？）<textarea aria-label="采样预测理由" value={reason} onChange={e=>setReason(e.target.value)} placeholder="结合 B、D、F 的到达时间推理"/></label></fieldset>
 <div className="obs176-actions"><button data-obs-action="step" disabled={tick>=8||!prediction||!reason.trim()} onClick={()=>setTick(t=>t+1)}>单步推进 1 秒</button><button data-obs-action="back" disabled={tick<0} onClick={()=>setTick(t=>t-1)}>回退</button><button data-obs-action="reset" onClick={reset}>重置实验</button></div>
 <div className="obs176-live" data-testid="live-model" data-state={JSON.stringify({tick,config,headErrors:s.headErrors,tailErrors:s.tailErrors,buffered:s.buffered,peak:s.peak,late:s.late,tail:s.tail})}>
 <p aria-live="polite">{tick<0?'待执行':`当前 t=${tick} 秒`} · 尾采缓存 {s.buffered}/{config.capacity} · 峰值 {s.peak} · 迟到 {s.late}</p>
 <div className="obs176-buffer" aria-label="尾采缓存格">{Array.from({length:config.capacity},(_,i)=><span key={i} className={i<s.buffered?'occupied':''}>{s.tail.filter(r=>r.status==='buffered')[i]?.id??'空'}</span>)}</div>
 <div className="obs176-grid">{(['head','tail'] as const).map(kind=><div className="obs176-lane" key={kind}><h4>{kind==='head'?'头部采样：入口决定':'尾部采样：等待结果'}</h4>{s[kind].map((r,i)=><button key={r.id} className={`obs176-trace ${selected===r.id?'selected':''}`} aria-pressed={selected===r.id} onClick={()=>setSelected(r.id)}><strong>{r.id}</strong><span>{status[r.status]}</span><span>{r.errorKnown?'已知错误':tick>=traces[i].end&&r.status==='kept'?'已知正常':'终态未收集'}</span></button>)}<p>已保留错误：{kind==='head'?s.headErrors:s.tailErrors} 条</p></div>)}</div>
 <p className="obs176-detail">选中 {selected} · 入口散列 {source.hash} · 头采：{s.head[ti].reason}；尾采：{s.tail[ti].reason}。</p>
 <div className="obs176-rates">{[{label:'独立全量指标：已完成请求错误率',n:s.truthErrors,d:s.completed},{label:'尾采已存样本：错误占比',n:s.tailErrors,d:sample.length}].map(v=><div key={v.label}><span>{v.label}：{v.n}/{v.d}（{percent(v.n,v.d)}）</span><div className="obs176-bar"><i style={{width:`${v.d?v.n/v.d*100:0}%`}}/></div></div>)}</div>
 <p>两种分母不同：{fullRate} 来自全部已完成请求，{sampleRate} 来自被挑选的 Trace；尾采样本不能直接作为全站错误率。</p>
 <p className="obs176-event" aria-live="polite">本步事件：{s.log.filter(v=>v.startsWith(`t=${tick} `)).join('；')||'没有新事件；仍保留已有采样决策。'}</p>
 </div>
 {finished&&<div role="status" className="obs176-feedback"><strong>{prediction===winner(s)?'预测与本次模型一致':'预测需要修正'}</strong><p>你的理由：{reason}</p><p>头采保留 {s.headErrors} 个错误，尾采保留 {s.tailErrors} 个错误。点击 B / D / F 查看各自证据；回退到丢弃前一步，检查入口、容量或等待哪个约束先发生。此结果是有提示练习，未记为独立掌握。</p></div>}
 <details><summary>模型边界与成本口径</summary><p>每条 Trace 占一个缓存槽，仅模拟入口与终态两个事件。一个时刻先接收终态（截止时刻到达算及时），再超时，再接收新 Trace。满缓存拒收新 Trace，超时后丢弃且不恢复；真实采集器策略须另行核对。正常基线采样为散列小于 20；尾采批次存储上限 3 条，错误可替换已存正常样本，这是教学批次策略。最终存储小不等于汇聚内存小。生产案例的 0.1% 错误与 5% 存储预算不能由本批次比例外推。</p></details>
 </section>;
}
export function Help({mode}:{mode:string}){
 const [wide,setWide]=useState(false),[focus,setFocus]=useState('D'),[step,setStep]=useState(0),[answer,setAnswer]=useState(''),[explanation,setExplanation]=useState(''),[submitted,setSubmitted]=useState(false),[attempts,setAttempts]=useState(0);
 const demo=simulate({...defaults,capacity:wide?6:1,wait:4},8),focusIndex=traces.findIndex(t=>t.id===focus),walk=simulate(defaults,step-1);
 return <section className="obs176 obs176-help" data-testid="observability-help-176">
 {mode==='example'?<><h3>用档案室理解汇聚容量</h3><p>每条未结束请求占一个临时档案夹；知道结果后才能决定留档。保持等待窗口 4 秒与同一批请求不变，只改变架子大小。</p><button aria-pressed={wide} onClick={()=>setWide(v=>!v)}>切换为 {wide?'1':'6'} 个缓存槽</button><div className="obs176-buffer">{demo.tail.map(r=><span key={r.id}>{r.id}<br/>{status[r.status]}</span>)}</div><p>当前 {wide?6:1} 槽，峰值 {demo.peak}，最终留下 {demo.tailErrors} 个错误。B 在 1 槽配置下被容量拒收，增大等待时间也不能恢复未入库的数据。</p></>:
 mode==='diagram'?<><h3>追踪一条 Trace 的决策路径</h3><div className="obs176-actions">{traces.map(t=><button key={t.id} aria-pressed={focus===t.id} onClick={()=>setFocus(t.id)}>{t.id}</button>)}</div><div className="obs176-flow"><span>{focus} 入口 t={traces[focusIndex].start}</span><b>↓</b><span>缓存截止 t={traces[focusIndex].start+defaults.wait}</span><b>↓</b><span>终态到达 t={traces[focusIndex].end}</span><b>↓</b><strong>{status[simulate(defaults,8).tail[focusIndex].status]}</strong></div><p>{simulate(defaults,8).tail[focusIndex].reason}</p><p>箭头表示本次事件路径；切换请求同时改变时间和决策，不表示每条请求都会进入存储。</p></>:
 mode==='steps'?<><h3>从采集器的视角逐秒判断</h3><p>每秒依次做三件事：接收终态 → 释放超时缓存 → 接收入站请求。相同时刻先处理终态，边界是明确约定。</p><button disabled={step>=9} onClick={()=>setStep(v=>v+1)}>执行下一秒</button><button disabled={step===0} onClick={()=>setStep(v=>v-1)}>退回上一秒</button><p>t={step-1}，占用 {walk.buffered}/{defaults.capacity} 槽</p><div className="obs176-buffer">{walk.tail.map(r=><span key={r.id}>{r.id}<br/>{status[r.status]}</span>)}</div><p aria-live="polite">{walk.log.filter(l=>l.startsWith(`t=${step-1} `)).join('；')||'尚无事件，等待入口到达。'}</p></>:
 <><h3>独立迁移：更慢的错误链路</h3><p>新批次 D 从 t=2 开始、t=8 才报错；B 和 F 的终态仍分别为 t=2、t=5。缓存为 6 条，无前置头采，存储预算 3 条。要保留所有 3 条错误，下面哪个是足够的最短等待窗口？提交前不显示本批结果。</p><fieldset disabled={submitted}><label>选择等待窗口<select aria-label="迁移等待窗口" value={answer} onChange={e=>setAnswer(e.target.value)}><option value="">请选择</option><option value="2">2 秒</option><option value="4">4 秒</option><option value="6">6 秒</option></select></label><label>写出等待时长的计算与容量依据<textarea aria-label="迁移推理" value={explanation} onChange={e=>setExplanation(e.target.value)}/></label></fieldset><button disabled={submitted||!answer||!explanation.trim()} onClick={()=>{setSubmitted(true);setAttempts(v=>v+1);}}>提交独立判断</button>{submitted&&<div role="status"><p>{simulate({...defaults,capacity:6,wait:Number(answer)},8,transferTraces).tailErrors===3?'判断正确':'还需修正'}：本次配置保留 {simulate({...defaults,capacity:6,wait:Number(answer)},8,transferTraces).tailErrors}/3 个错误。</p><p>D 要等待 8−2=6 秒；容量充足且没有入口丢弃，截止时刻到达的终态被接收。你的理由已记录：{explanation}。{attempts===1?'这是首次独立选择':'这是看过解析后的练习重试'}；理由供自查，不自动判定理解完整。</p><button onClick={()=>{setSubmitted(false);setAnswer('');setExplanation('');}}>练习重试（已看过解析）</button></div>}</>}
 </section>;
}

