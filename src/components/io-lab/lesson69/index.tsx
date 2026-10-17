import {useState} from 'react';
import {baseline,challenges,locations,matchingWallTime,timeState,type TimeInput,type LocationId} from './model';
import './style.css';

function Clock({x,minutes,label}:{x:number;minutes:number;label:string}){
 const hour=(minutes%720)/720*2*Math.PI,minute=(minutes%60)/60*2*Math.PI;
 return <g transform={`translate(${x},66)`}><circle r="44" fill="#fff" stroke="#8eabc0" strokeWidth="2"/>{[0,3,6,9].map(h=><text key={h} x={Math.sin(h*Math.PI/6)*34} y={-Math.cos(h*Math.PI/6)*34+4} textAnchor="middle" fontSize="11">{h||12}</text>)}<line x2={Math.sin(hour)*24} y2={-Math.cos(hour)*24} stroke="#176b85" strokeWidth="4"/><line x2={Math.sin(minute)*34} y2={-Math.cos(minute)*34} stroke="#db7e29" strokeWidth="2"/><circle r="3" fill="#176b85"/><text y="64" textAnchor="middle" fontSize="14">{label}</text></g>;
}
function Board({input,step}:{input:TimeInput;step:number}){
 const s=timeState(input,step),bx=160+input.delta/780*112;
 return <div className="io69-board" data-testid="live-model" data-state={JSON.stringify(s)}>
  <svg viewBox="0 0 320 254" role="img" aria-label={`A 显示 ${s.aDisplay.clock}，B 显示 ${s.bDisplay.clock}；共同时间轴上 B 相对 A 偏移 ${input.delta} 分钟`}>
   <Clock x={80} minutes={s.aDisplay.minutes} label={`A · ${s.aDisplay.clock}`}/><Clock x={240} minutes={s.bDisplay.minutes} label={`B · ${s.bDisplay.clock}`}/>
   <text x="160" y="157" textAnchor="middle" fontSize="12">共同 UTC 时间轴（分钟差）</text><path d="M35 202 H285" stroke="#8ca6b9" strokeWidth="2"/>
   <line x1="160" y1="169" x2="160" y2="216" stroke="#176b85" strokeWidth="3"/><text x="160" y="181" textAnchor="middle" fontSize="12">A</text>
   <circle cx={bx} cy="202" r="8" fill="#db7e29"/><text x={bx} y="237" textAnchor="middle" fontSize="12">B · {input.delta>0?'+':''}{input.delta} 分</text>
  </svg>
  <div className="io69-pair"><div><strong>A · {s.aDisplay.clock}</strong><span>{s.aDisplay.date}</span><small>位置对象 {s.aDisplay.identity}</small></div><div><strong>B · {s.bDisplay.clock}</strong><span>{s.bDisplay.date}</span><small>位置对象 {s.bDisplay.identity}</small></div></div>
  <div className="io69-results" aria-live="polite"><span>Equal → <strong>{step>=2?String(s.equal):'待验证'}</strong></span><span>== → <strong>{step>=3?String(s.structEqual):'待验证'}</strong></span></div>
 </div>;
}
function LocationControl({label,value,onChange}:{label:string;value:LocationId;onChange:(v:LocationId)=>void}){return <label>{label}<select value={value} onChange={e=>onChange(e.target.value as LocationId)}>{Object.entries(locations).map(([id,zone])=><option key={id} value={id}>{zone.label}</option>)}</select></label>;}
const stepText=['准备：A 的瞬间固定为 2026-01-01 00:00 UTC；先预测比较结果。','换算：墙钟读数 = UTC 瞬间 + 固定偏移。观察日期是否跨日。','比较瞬间：只看共同时间轴的位置。Equal 判断两点是否重合。','比较结构：本模型不含单调时钟；== 还要求使用同一个位置对象。'];
function Lab({guided=false,diagram=false}:{guided?:boolean;diagram?:boolean}){
 const [input,setInput]=useState<TimeInput>(baseline),[step,setStep]=useState(0),[prediction,setPrediction]=useState(''),[reason,setReason]=useState('');
 const update=(value:TimeInput)=>{setInput(value);setStep(0);setPrediction('');setReason('');};
 const result=timeState(input),ready=prediction!==''&&reason.trim().length>0;
 return <><p>{diagram?'拖动瞬间差，把 B 在共同时间轴上的点移开或移回；切换位置对象，看钟面与时间轴如何联动。':'控制位置对象与瞬间差，区分「钟表显示相同」「同一瞬间」和「结构相等」。'}</p>
 <div className="io69-controls"><LocationControl label="A 的位置对象" value={input.a} onChange={a=>update({...input,a})}/><LocationControl label="B 的位置对象" value={input.b} onChange={b=>update({...input,b})}/><label>B 比 A 晚多少分钟：{input.delta}<input aria-label="B 相对 A 的瞬间差" type="range" min="-780" max="780" step="30" value={input.delta} onChange={e=>update({...input,delta:Number(e.target.value)})}/></label></div>
 <div className="io69-actions"><button onClick={()=>update({...input,delta:0})}>让瞬间重合</button><button onClick={()=>update(matchingWallTime(input))}>让钟面读数相同</button><button onClick={()=>update({a:'east',b:'twin',delta:0})}>反例：同偏移，不同位置对象</button></div>
 {!diagram&&<fieldset disabled={step>0}><legend>先预测，再比较</legend><label>Equal / == 结果<select aria-label="预测两个比较结果" value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">选择一组结果</option><option value="true/false">true / false</option><option value="true/true">true / true</option><option value="false/false">false / false</option></select></label><label>预测理由<input aria-label="时间比较预测理由" value={reason} onChange={e=>setReason(e.target.value)} placeholder="时间轴和位置对象各有什么作用？"/></label></fieldset>}
 <Board input={input} step={step}/>
 <ol className="io69-steps">{['输入','换算读数','Equal','=='].map((text,i)=><li key={text} aria-current={step===i?'step':undefined}>{text}</li>)}</ol>
 <p className="io69-feedback" aria-live="polite">{stepText[step]}{guided&&step===1?' 按相同瞬间做对照：In 只换表示，绝不移动 UTC 轴上的点。':''}{step===3&&!diagram?` 你预测 ${prediction}，实际 ${result.equal}/${result.structEqual}。${prediction===`${result.equal}/${result.structEqual}`?'预测一致。':'重新区分瞬间与表示，再改变一个条件验证。'}`:''}</p>
 <div className="io69-actions"><button data-io-action="back" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button data-io-action="step" disabled={step===3||(!diagram&&!ready)} onClick={()=>setStep(s=>s+1)}>单步比较</button><button data-io-action="reset" onClick={()=>update(baseline)}>重置双时钟</button></div>
 {!diagram&&!ready&&<p className="io69-note">选择预测并写下理由后，开始单步比较。</p>}
 <pre>{`base := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)\na := base.In(A位置)\nb := base.Add(${input.delta} * time.Minute).In(B位置)\na.Equal(b) // 比较瞬间\na == b    // 还比较表示信息`}</pre></>;
}
function Example(){const [sameWall,setSameWall]=useState(false);const input=sameWall?{a:'utc' as const,b:'east' as const,delta:-480}:baseline;return <><p>直播票上写着 UTC 00:00。上海观众把同一场直播记为固定 UTC+8 的 08:00。改成「两张票都写当地 00:00」，看看是否仍是同一场。</p><div className="io69-actions"><button aria-pressed={!sameWall} onClick={()=>setSameWall(false)}>同场直播：两地不同钟点</button><button aria-pressed={sameWall} onClick={()=>setSameWall(true)}>反例：两地都写 00:00</button></div><Board input={input} step={3}/><p className="io69-feedback">{sameWall?'上海的当地 00:00 比 UTC 00:00 早 8 小时，日期也在 UTC 轴上跨到前一天。相同钟点文字不足以标识瞬间。':'两个钟面不同，时间轴上的点却重合；Equal 为 true。'}</p><p>类比边界：票面不是 time.Time 的内存布局；对象身份用显式标签表示。</p></>;}
function Try(){const [index,setIndex]=useState(0),[guess,setGuess]=useState(''),[reason,setReason]=useState(''),[revealed,setRevealed]=useState(false);const input=challenges[index],s=timeState(input);const next=()=>{setIndex(i=>(i+1)%challenges.length);setGuess('');setReason('');setRevealed(false);};return <><p>新条件 {index+1}/3：A 使用 {locations[input.a].label}，B 使用 {locations[input.b].label}。B 的瞬间相对 A 偏移 {input.delta} 分钟。两者均无单调时钟。</p><fieldset disabled={revealed}><legend>不看反馈，先提交判断</legend><label>Equal / ==<select value={guess} onChange={e=>setGuess(e.target.value)}><option value="">请选择</option><option value="true/false">true / false</option><option value="true/true">true / true</option><option value="false/false">false / false</option></select></label><label>你的依据<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="分别说明瞬间和位置对象"/></label></fieldset><div className="io69-actions"><button data-io-action="step" disabled={revealed||!guess||!reason.trim()} onClick={()=>setRevealed(true)}>揭晓并核对</button><button data-io-action="reset" onClick={next}>换一组新条件</button></div>{revealed&&<><Board input={input} step={3}/><p className="io69-feedback">你预测 {guess}；观察为 {String(s.equal)}/{String(s.structEqual)}。{s.equal?'共同时间轴重合；但位置对象身份不同，所以 == 为 false。':'瞬间已经不同，Equal 和 == 都是 false；钟面或位置相同也不能补救。'} 你的理由：{reason}</p></>}<p className="io69-note">这是带反馈的迁移练习，不写入正式掌握成绩。</p></>;}
function Boundary(){return <p className="io69-note">模型边界：仅固定时区、整分钟、无单调时钟；明确的 east 与 twin 是两个独立命名位置对象，即使偏移相同也不合并。实际 time.Time 的 == 还比较单调时钟等表示信息。此模型不模拟夏令时，不能用它推导 Add(24h) 与 AddDate 的普遍关系。</p>;}
export default function Lesson69(){return <section className="io69" data-testid="io-lab-69"><h3>双时钟与共同时间轴</h3><Lab/><Boundary/></section>;}
export function Help({mode}:{mode:string}){return <section className="io69" data-testid="io-help-69">{mode==='example'?<Example/>:mode==='diagram'?<Lab diagram/>:mode==='steps'?<Lab guided/>:<Try/>}<Boundary/></section>;}

