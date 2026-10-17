import { useState } from 'react';
import { defaults, inspect, record, rewind, type Config, type Reading, type Direction, type Observation } from './model';
import './styles.css';
const names = {lower:'降低',same:'不变',higher:'升高',infeasible:'模型无稳态解'};
const fmt = (value: number | null) => value === null ? '无法估算' : Number(value.toFixed(2)).toString();
function Boundary() { return <p className="ops165-boundary">模型边界：固定存活堆和分配率，以增长空间估计稳态 GC 频率；扫描量只是 CPU 工作代理，不是 CPU 百分比、吞吐或 P99。把软限制剩余额度近似为增长空间，不复刻 Go pacer、GC CPU 限制器与瞬时超限；软限制不是硬上限。根占用与其他运行时内存在本模型单独记账，真实进程 RSS 还受堆外内存等影响。<a href="https://go.dev/doc/gc-guide" target="_blank" rel="noreferrer">Go GC 指南</a></p>; }
function Controls({value,onChange,compact=false}:{value:Config;onChange:(v:Config)=>void;compact?:boolean}) {
  const fields: [keyof Config,string,number,number,number][] = compact ? [['gogc','GOGC',50,400,50],['allocation','分配率 MiB/s',55,440,55]] : [['gogc','GOGC',50,400,50],['live','存活堆 MiB',100,400,50],['roots','GC 根 MiB',0,80,20],['allocation','分配率 MiB/s',55,440,55],['softLimit','软内存预算 MiB',200,2000,20]];
  return <div className="ops165-controls">{fields.map(([key,label,min,max,step])=><label key={key}>{label} <strong>{value[key]}</strong><input aria-label={label} type="range" min={min} max={max} step={step} value={value[key]} onChange={e=>onChange({...value,[key]:Number(e.target.value)})}/></label>)}</div>;
}
function ReadingView({reading,title}:{reading:Reading;title:string}) {
  const [focus,setFocus]=useState('growth');
  const pieces = [{id:'live',label:'存活堆',value:reading.config.live},{id:'roots',label:'GC 根',value:reading.config.roots},{id:'growth',label:'增长空间',value:reading.growth},{id:'other',label:'其他运行时',value:80}];
  return <section className="ops165-reading"><h4>{title}</h4><div className="ops165-bar" aria-label={`${title}内存构成`}>{pieces.map(p=><button type="button" key={p.id} aria-pressed={focus===p.id} onClick={()=>setFocus(p.id)} style={{flexGrow:Math.max(p.value,1)}} title={`${p.label} ${fmt(p.value)} MiB`} className={`ops165-piece ops165-${p.id}`}>{p.label}</button>)}</div><p className="ops165-linked">选中：{pieces.find(p=>p.id===focus)?.label} = {pieces.find(p=>p.id===focus)?.value} MiB。{focus==='live'?'可达对象不能靠提高 GC 频率清除。':focus==='roots'?'根参与目标增长计算和扫描；根不等于存活堆。':focus==='growth'?'可新分配的空间越小，同分配率下回收越频繁。':'此处固定为 80 MiB，真实运行时需测量。'}</p><dl><div><dt>堆目标</dt><dd>{fmt(reading.target)} MiB</dd></div><div><dt>模型内记账总量</dt><dd>{fmt(reading.accountedMemory)} MiB</dd></div><div><dt>稳态 GC 频率</dt><dd>{fmt(reading.cyclesPerSecond)} 次/s</dd></div><div><dt>扫描工作代理</dt><dd>{fmt(reading.scanWork)} MiB/s</dd></div></dl><p>{reading.infeasible?'可达对象与固定开销已占满预算；调 GOGC 无法创造空闲空间。':reading.constrained?'软预算正在压缩增长空间，提高 GOGC 的收益受限。':'当前增长空间由 GOGC 决定。'}</p></section>;
}
export default function Lab() {
  const [draft,setDraft]=useState<Config>({...defaults});
  const [history,setHistory]=useState<Observation[]>([]);
  const [prediction,setPrediction]=useState<Direction|'infeasible'|' '>(' ');
  const [reason,setReason]=useState('');
  const last=history.at(-1);
  const reading=inspect(last?.config ?? defaults);
  function change(c:Config) {setDraft(c);setPrediction(' ');setReason('');}
  function back() {const previous=rewind(history);setHistory(previous);setDraft({...(previous.at(-1)?.config ?? defaults)});setPrediction(' ');setReason('');}
  return <div className="ops165" data-testid="operations-lab-165"><h3>用多少增长空间，换多少扫描工作？</h3><p>固定基线：存活堆 200 MiB、根 20 MiB、分配 220 MiB/s、GOGC 100、软预算 1000 MiB。每次只改一个变量，先预测，再执行一组稳态观察。</p><Controls value={draft} onChange={change}/><fieldset className="ops165-predict"><legend>相对固定基线，扫描工作会怎样变化？</legend>{(['lower','same','higher','infeasible'] as const).map(d=><label key={d}><input type="radio" name="ops165-prediction" checked={prediction===d} onChange={()=>setPrediction(d)}/>{names[d]}</label>)}<label className="ops165-reason">预测理由<textarea aria-label="预测理由" value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明增长空间、分配率或软预算怎样影响频率"/></label></fieldset><div className="ops165-actions"><button data-ops-action="step" disabled={prediction===' '||!reason.trim()} onClick={()=>{if(prediction!==' '){setHistory(record(history,draft,prediction,reason));setReason('');setPrediction(' ');}}}>执行本组观察</button><button data-ops-action="back" disabled={!history.length} onClick={back}>回退一组</button><button data-ops-action="reset" onClick={()=>{setHistory([]);change({...defaults});}}>重置实验</button></div><div data-testid="live-model" data-state={JSON.stringify({...reading,observations:history.length})} className="ops165-compare"><ReadingView reading={inspect(defaults)} title="固定基线"/><ReadingView reading={reading} title={last?'最近执行的方案':'等待执行的对照'}/></div><div className="ops165-feedback" aria-live="polite">{last?<><strong>你预测{names[last.prediction]}，模型结果：{names[last.actual]}。</strong><p>当时理由：{last.reason}</p><p>增长空间 {fmt(reading.growth)} MiB → 分配率 {reading.config.allocation} MiB/s ÷ 增长空间 → {fmt(reading.cyclesPerSecond)} 次/s → 每轮扫描存活堆和根。{last.actual==='infeasible'?'先减少保留或重新分配预算，再测量真实 GC 行为。':'对照两张图，区分减少分配与增大目标各自改变了哪一项。'}</p></>:<p>先选择预测并写下理由，执行后才显示候选方案的计算结果。</p>}</div><p>共记录 {history.length} 组辅助观察；本模块不写入独立掌握成绩。输入变化只修改待执行方案，下面仍保留上一次结果。</p><Boundary/></div>;
}
function Example() {
 const [limited,setLimited]=useState(false);
 const config={...defaults,softLimit:limited?420:2000};
 return <><h4>同一个 GOGC 改动，换一套内存条件</h4><button onClick={()=>setLimited(!limited)}>{limited?'恢复宽裕预算 2000 MiB':'施加紧预算 420 MiB'}</button><div className="ops165-compare"><ReadingView title="GOGC 100" reading={inspect(config)}/><ReadingView title="GOGC 400" reading={inspect({...config,gogc:400})}/></div><p>{limited?'两侧增长空间都是 120 MiB；提高 GOGC 没有降低模型扫描工作。':'预算宽裕时，GOGC 400 用更多增长空间换较低频率。'}其余条件相同，比较才可归因。</p></>;
}
function Diagram() {
 const [config,setConfig]=useState<Config>({...defaults});
 return <><h4>从根到堆目标：编辑与联动</h4><label>调整根 MiB <input type="range" aria-label="图示根大小" min="0" max="80" step="20" value={config.roots} onChange={e=>setConfig({...config,roots:Number(e.target.value)})}/></label><p className="ops165-formula">堆目标 = {config.live} + ({config.live} + <strong>{config.roots}</strong>) × {config.gogc}/100 = {inspect(config).target} MiB</p><ReadingView title="点击色块追踪公式中的量" reading={inspect(config)}/><p>只改变根：目标与扫描对象一起变化；根增大不是新增同样大小的存活堆。</p></>;
}
function Steps() {
 const [step,setStep]=useState(0);
 const [limited,setLimited]=useState(true);
 const c={...defaults,gogc:400,softLimit:limited?420:2000}; const r=inspect(c);
 const phases=['读入测量：存活堆 200，根 20，分配率 220。',`计算期望增长：(200 + 20) × 400 / 100 = ${r.requestedGrowth} MiB。`,`检查剩余额度：${c.softLimit} − 80 − 20 − 200 = ${r.availableGrowth} MiB，实际取 ${r.growth} MiB。`,`计算稳态频率：220 ÷ ${r.growth} = ${fmt(r.cyclesPerSecond)} 次/s。`,`计算扫描工作：频率 × (200 + 20) = ${fmt(r.scanWork)} MiB/s；下一步应测实际 CPU、RSS 与 P99。`];
 return <><h4>扮演调参审查员：一步一步追踪</h4><button onClick={()=>{setLimited(!limited);setStep(0);}}>切到{limited?'宽裕':'紧张'}预算并从头推导</button><ol className="ops165-steps">{phases.slice(0,step+1).map((p,i)=><li key={i} aria-current={i===step?'step':undefined}>{p}</li>)}</ol><div className="ops165-progress" aria-label="推导进度"><span style={{width:`${(step+1)*20}%`}}/></div><div className="ops165-actions"><button disabled={step===4} onClick={()=>setStep(step+1)}>执行下一步推导</button><button disabled={!step} onClick={()=>setStep(step-1)}>回退推导</button><button onClick={()=>setStep(0)}>重置推导</button></div></>;
}
function Try() {
 const [config,setConfig]=useState<Config>({...defaults,gogc:400,softLimit:420});
 const [reason,setReason]=useState(''); const [result,setResult]=useState<Reading|null>(null);
 const pass=!!result && result.scanWork!==null && result.scanWork<=220 && result.accountedMemory<=420;
 return <><h4>修复挑战：预算 420 MiB，扫描工作不超过 220 MiB/s</h4><p>固定存活堆 200、根 20、其他运行时 80。可以调 GOGC，也可以降低分配率。选择方案并预测它为什么满足两项约束。</p><Controls compact value={config} onChange={c=>{setConfig(c);setResult(null);setReason('');}}/><label>修复预测与理由<textarea aria-label="修复预测与理由" value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!reason.trim()} onClick={()=>setResult(inspect(config))}>验证修复方案</button>{result&&<div aria-live="polite"><p>{pass?'模型两项约束均满足。继续用生产负载测量吞吐与 P99。':'约束未满足。比较分配率和增长空间：只提高 GOGC 是否还能扩展空间？'}</p><ReadingView title="本次修复结果" reading={result}/></div>}</>;
}
export function Help({mode}:{mode:string}) {return <div className="ops165" data-testid="operations-help-165" data-mode={mode}>{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}<p className="ops165-assistance">这是辅助理解；使用示例、推导或提示后的结果不计入独立掌握。</p><Boundary/></div>;}

