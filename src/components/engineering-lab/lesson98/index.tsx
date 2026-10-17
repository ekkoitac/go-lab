import {useId, useState} from 'react';
import {codeFor, initialSettings, normalize, policies, stateAt, type ConfigState, type CopyPolicy, type Mutation, type Settings} from './model';
import './style.css';

function References({state}:{state:ConfigState}) {
  const marker=useId().replace(/:/g,'');
  const rows:Record<string,number>={G:56,A:156,B:256};
  const mapEntries=Object.entries(state.maps);
  const mapY=Object.fromEntries(mapEntries.map(([id],i)=>[id,36+i*82]));
  const owners=[['全局', 'G', 'G'], ...(state.a ? [['请求 A',state.a,'A']] : []), ...(state.b ? [['请求 B',state.b,'B']] : [])];
  return <figure className="eg98-figure"><figcaption>引用关系 · 箭头表示引用同一个对象</figcaption>
    <div className="eg98-graph-scroll" tabIndex={0} aria-label="配置引用图，窄屏可左右滚动"><svg viewBox="0 0 390 365" role="img" aria-label="全局与请求的切片描述符、底层数组及内部 map 引用关系">
      <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#168274"/></marker></defs>
      {owners.map(([name,ref,key])=><g key={name}>
        <path d={`M105 ${rows[key]} C125 ${rows[key]} 120 ${rows[ref]} 142 ${rows[ref]}`} fill="none" stroke="#168274" strokeWidth="2" markerEnd={`url(#${marker})`}/>
        <rect x="4" y={rows[key]-28} width="101" height="56" rx="9" fill="#e3f4ed" stroke="#98c9ba"/>
        <text x="54" y={rows[key]-7} textAnchor="middle">{name}</text>
        <text x="54" y={rows[key]+13} textAnchor="middle" className="eg98-small-svg">{state.settings.policy==='readonly' && key!=='G' ? '只读入口' : 'len=1 cap=1'}</text>
      </g>)}
      {Object.entries(state.arrays).map(([id,values])=><g key={id}>
        {state.settings.kind==='maps' && <path d={`M244 ${rows[id]} C265 ${rows[id]} 263 ${mapY[values[0]]} 283 ${mapY[values[0]]}`} stroke="#168274" fill="none" strokeWidth="2" markerEnd={`url(#${marker})`}/>}
        <rect x="145" y={rows[id]-29} width="99" height="58" rx="9" fill="#fff" stroke="#168274" strokeWidth="2"/>
        <text x="194" y={rows[id]-8} textAnchor="middle">数组 {id}</text>
        <text x="194" y={rows[id]+14} textAnchor="middle" fill={values[0]==='debug' ? '#ae4d18' : '#174b42'}>[0] {values[0]}</text>
      </g>)}
      {mapEntries.map(([id,map])=><g key={id}>
        <rect x="286" y={mapY[id]-27} width="100" height="54" rx="9" fill={map.mode==='debug' ? '#fff0db' : '#e9f6f1'} stroke="#a7c6b8"/>
        <text x="336" y={mapY[id]-6} textAnchor="middle">map {id}</text>
        <text x="336" y={mapY[id]+15} textAnchor="middle">{map.mode}</text>
      </g>)}
      <text x="6" y="353" className="eg98-small-svg">对象 ID 仅用于追踪引用；不是实际内存地址。</text>
    </svg></div><div className="eg98-reference-list" data-testid="relationship-diagram" aria-label="逐个持有者追踪引用终点">{owners.map(([name,ref,key])=><article key={key}><strong>{name}{state.settings.policy==='readonly'&&key!=='G'?'（只读入口）':''}</strong><p>↓ {state.settings.policy==='readonly'&&key!=='G'?'读取':'引用'}数组 {ref}</p><code>数组 {ref}[0] = {state.arrays[ref][0]}</code>{state.settings.kind==='maps'&&<><p>↓ 指向 map {state.arrays[ref][0]}</p><b>mode = {state.maps[state.arrays[ref][0]].mode}</b></>}</article>)}<small>相同对象 ID 表示共享存储；不同变量名不代表不同对象。</small></div></figure>;
}

export default function Lesson98() {
  const [settings,setSettings]=useState<Settings>(initialSettings);
  const [step,setStep]=useState(0);
  const [prediction,setPrediction]=useState('');
  const [reason,setReason]=useState('');
  const [locked,setLocked]=useState(false);
  const state=stateAt(settings,step);
  const reset=()=>{setStep(0);setPrediction('');setReason('');setLocked(false);};
  const configure=(change:Partial<Settings>)=>{setSettings(normalize({...settings,...change}));reset();};
  const labels=['A 取得配置','A 尝试修改','B 取得配置并读取'];
  return <section className="eg98" data-testid="engineering-lab-98">
    <header><span className="eg98-eyebrow">98 / 所有权与引用传播</span><h3>这次修改，会传到下一个请求吗？</h3><p>保持 A → 修改 → B 的顺序不变，改变复制层级，观察写入究竟到达哪一个对象。</p></header>
    <div className="eg98-settings">
      <label>配置类型<select aria-label="配置类型" value={settings.kind} onChange={e=>configure({kind:e.target.value as Settings['kind']})}><option value="strings">[]string：字符串元素</option><option value="maps">[]map：元素引用内部 map</option></select></label>
      <label>获取配置的方式<select aria-label="获取配置的方式" value={settings.policy} onChange={e=>configure({policy:e.target.value as CopyPolicy})}>{Object.entries(policies).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>A 的写入位置<select aria-label="A 的写入位置" value={settings.mutation} onChange={e=>configure({mutation:e.target.value as Mutation})}><option value="element">替换第 0 个元素</option>{settings.kind==='maps' && <option value="nested">修改内部 map 的 mode</option>}</select></label>
    </div>
    <pre className="eg98-code"><code>{codeFor(settings)}</code></pre>
    <div className="eg98-predict"><label>先预测：B 最后读到什么？<select aria-label="B 的读取预测" value={prediction} disabled={locked} onChange={e=>setPrediction(e.target.value)}><option value="">选择一个结果</option><option value="stable">stable</option><option value="debug">debug</option></select></label><label>你的理由<textarea aria-label="98题预测理由" value={reason} disabled={locked} onChange={e=>setReason(e.target.value)} placeholder="A 写入的对象，是否也被全局引用？" rows={2}/></label><button type="button" data-eg-action="commit" disabled={locked || !prediction || !reason.trim()} onClick={()=>setLocked(true)}>{locked?'预测已锁定':'锁定预测，开始观察'}</button></div>
    <div className="eg98-actions"><button type="button" data-eg-action="step" disabled={!locked || step===3} onClick={()=>setStep(s=>s+1)}>{step===3?'观察完成':labels[step]}</button><button type="button" data-eg-action="back" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button type="button" data-eg-action="reset" onClick={reset}>重置本轮</button><span>步骤 {step} / 3</span></div>
    <div className="eg98-live" data-testid="live-model" data-state={JSON.stringify(state)}>
      <References state={state}/><div className="eg98-evidence"><h4>谁看到了什么</h4><dl><div><dt>全局默认值</dt><dd>{state.globalValue}</dd></div><div><dt>请求 A</dt><dd>{state.aValue ?? '尚未获取'}</dd></div><div><dt>请求 B</dt><dd>{state.bValue ?? '尚未获取'}</dd></div></dl><p className="eg98-cause" aria-live="polite">{state.explanation}</p>{step===3 && <p className="eg98-result">你预测 {prediction}，实际 {state.bValue}。{prediction===state.bValue?'预测与本次模型一致。':'沿图中的箭头回看：独立变量不一定拥有独立底层对象。'}<br/>你的理由：{reason}</p>}</div>
    </div>
    <p className="eg98-boundary">只模拟一个元素、map 值为 string、顺序请求；不模拟 append 扩容、并发调度或竞态检测。深层值若仍含引用，还需继续定义复制范围。只读共享本身合理；切换条件会重开预测，帮助练习不记为独立测验成绩。</p>
  </section>;
}

function Example() {
  const [copy,setCopy]=useState(false);
  const state=stateAt({...initialSettings,policy:copy?'elements':'descriptor'},3);
  return <><h4>房规副本，还是共用白板？</h4><p>给 A 一个新变量，不代表给它一份新数据。对照同样的 a[0] = "debug"：</p><label className="eg98-check"><input type="checkbox" checked={copy} onChange={e=>setCopy(e.target.checked)}/>为 A 复制字符串元素</label><References state={state}/><p>A = {state.aValue}；全局 = {state.globalValue}；B = {state.bValue}。{state.explanation}</p><p>类比边界：Go 的描述符是值，底层数组才是这里的“白板”；字符串内容不会被原地改写，改变的是数组中的字符串元素。</p></>;
}
function Diagram() {
  const [policy,setPolicy]=useState<CopyPolicy>('elements');
  return <><h4>复制后，还有哪条引用连在一起？</h4><label>选择图中的复制层级<select aria-label="帮助图复制层级" value={policy} onChange={e=>setPolicy(e.target.value as CopyPolicy)}>{(['descriptor','elements','deep'] as const).map(key=><option key={key} value={key}>{policies[key]}</option>)}</select></label><References state={stateAt({kind:'maps',policy,mutation:'nested'},1)}/><p>只看箭头终点：外层数组分开，不能推出内部 map 分开。图中 A 和全局若到达同一个 map，内部键值写入就会共享。</p></>;
}
function Steps() {
  const [step,setStep]=useState(0);
  const state=stateAt({kind:'maps',policy:'elements',mutation:'nested'},step);
  return <><h4>追踪一次浅复制的内部写入</h4><p>此引导固定为：复制 []map 外层元素，再修改 a[0]["mode"]。</p><ol className="eg98-sequence">{['建立全局数组 G → map M0','复制数组：A → map M0','写入 M0.mode = debug','B 再取配置，读全局值'].map((text,i)=><li key={text} aria-current={i===step?'step':undefined}>{text}{i===step?' ← 当前':''}</li>)}</ol><div className="eg98-actions"><button type="button" disabled={step===3} onClick={()=>setStep(s=>s+1)}>下一步追踪</button><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>返回上一步</button><button type="button" onClick={()=>setStep(0)}>从头追踪</button></div><References state={state}/><p aria-live="polite">{state.explanation}</p></>;
}
function TryIt() {
  const [mutation,setMutation]=useState<Mutation>('element');
  const [prediction,setPrediction]=useState('');
  const [reason,setReason]=useState('');
  const [revealed,setRevealed]=useState(false);
  const settings:Settings={kind:'maps',policy:'elements',mutation};
  const state=stateAt(settings,revealed?3:1);
  const reset=()=>{setRevealed(false);setPrediction('');setReason('');};
  return <><h4>边界挑战：复制一层，能隔离哪种写入？</h4><p>已给 A 复制 []map 的外层元素。只改变写入位置，再预测 B 的值。</p><label>挑战中的写入位置<select aria-label="挑战中的写入位置" value={mutation} onChange={e=>{setMutation(e.target.value as Mutation);reset();}}><option value="element">a[0] = 新 map</option><option value="nested">a[0]["mode"] = "debug"</option></select></label><label>B 会读到<select aria-label="挑战预测" disabled={revealed} value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">先做预测</option><option value="stable">stable</option><option value="debug">debug</option></select></label><label>为什么？<textarea aria-label="挑战理由" disabled={revealed} value={reason} onChange={e=>setReason(e.target.value)} rows={2}/></label><div className="eg98-actions"><button type="button" disabled={revealed || !prediction || !reason.trim()} onClick={()=>setRevealed(true)}>验证这次写入</button><button type="button" onClick={reset}>重新预测</button></div><References state={state}/>{revealed && <p role="status">预测 {prediction}，实际 {state.bValue}。{state.explanation} {mutation==='nested'?'要隔离这次写入，还需要复制内部 map。':'替换的是 A 私有数组里的引用，原 map 无需被改写。'}<br/>你的理由：{reason}</p>}<p>这是有提示的局部练习，不写入正式测验成绩。</p></>;
}
export function Help({mode}:{mode:string}) {
  return <section className="eg98 eg98-help" data-testid="engineering-help-98">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<TryIt/>}</section>;
}

