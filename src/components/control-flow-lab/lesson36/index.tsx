import {useEffect,useState} from 'react';
import {baseline,codeLines,modeLabels,returnSnapshot,stageLabels,validateConfig,type Config,type ReturnMode,type Snapshot} from './model';
import './style.css';
type Part='local'|'result'|'caller';
function ReturnGraph({state,part,onPart}:{state:Snapshot;part:Part;onPart:(p:Part)=>void}){
  const named=state.mode==='named';
  const related=(p:Part)=>part===p||(named&&part!=='caller'&&p!=='caller');
  return <div className="cf36-graph">
    <div className="cf36-nodes">
      <button type="button" aria-pressed={related('local')} onClick={()=>onPart('local')}><small>{named?'具名局部变量':'普通局部变量'}</small><strong>n = {state.local}</strong></button>
      <div className="cf36-edge">{named?'⇔ 同一变量':'→ return 时复制'}</div>
      <button type="button" aria-pressed={related('result')} onClick={()=>onPart('result')}><small>{named?'返回槽就是 n':'独立返回槽'}</small><strong>{state.result??'待赋值'}</strong></button>
      <div className="cf36-edge">{state.step===3?'→ 已交付':'⇢ 离开时交付'}</div>
      <button type="button" aria-pressed={related('caller')} onClick={()=>onPart('caller')}><small>调用者</small><strong>{state.caller??'尚未收到'}</strong></button>
    </div>
    <p aria-live="polite">{part==='caller'?'调用者只在函数真正离开后得到结果；return 语句后仍有 defer 要执行。':named?'高亮的 n 与返回槽是同一变量的两种角色，不是两个独立对象；defer 改 n 也改最终结果。':part==='local'?'defer 闭包引用局部 n；它没有访问独立返回槽。':'return 只在赋值阶段把整数复制到这里；随后修改局部 n 不会重复复制。'}</p>
  </div>;
}
function Settings({config,onChange}:{config:Config;onChange:(c:Config)=>void}){
  const [initial,setInitial]=useState(String(config.initial));const [literal,setLiteral]=useState(String(config.literal));const [operand,setOperand]=useState(String(config.operand));const [error,setError]=useState('');
  useEffect(()=>{setInitial(String(config.initial));setLiteral(String(config.literal));setOperand(String(config.operand));setError('');},[config.initial,config.literal,config.operand]);
  function apply(){try{
    if([initial,literal,operand].some(s=>!/^-?\d+$/.test(s.trim())))throw new Error('请填写完整整数，再应用。');
    const next={...config,initial:Number(initial),literal:Number(literal),operand:Number(operand)};validateConfig(next);onChange(next);setError('');
  }catch(e){setError((e as Error).message);}}
  return <><div className="cf36-settings">
    <label>n 初始值<input inputMode="numeric" value={initial} onChange={e=>setInitial(e.target.value)}/></label>
    <label>return 表达式<select value={config.returnKind} onChange={e=>onChange({...config,returnKind:e.target.value as Config['returnKind']})}><option value="local">return n</option><option value="literal">return 指定整数</option></select></label>
    {config.returnKind==='literal'&&<label>return 的整数<input inputMode="numeric" value={literal} onChange={e=>setLiteral(e.target.value)}/></label>}
    <label>defer 运算<select value={config.operation} onChange={e=>onChange({...config,operation:e.target.value as Config['operation']})}><option value="add">n += 操作数</option><option value="multiply">n *= 操作数</option></select></label>
    <label>操作数<input inputMode="numeric" value={operand} onChange={e=>setOperand(e.target.value)}/></label>
  </div><button type="button" onClick={apply}>应用数值并重置</button><p className="cf36-note">整数范围 -99 至 99；编辑数值后点击应用，代码和图中显示已应用的数据。</p>{error&&<p role="alert">{error}</p>}</>;
}
function Code({config,mode,step}:{config:Config;mode:ReturnMode;step:number}){
  return <pre>{codeLines(config,mode).map((line,i)=><span key={i} className={(step===0&&i===2)||(step===1&&i===3)||(step===2&&i===2)||(step===3&&i===4)?'cf36-code-active':''}>{line+'\n'}</span>)}</pre>;
}
function Laboratory({tutorial=false}:{tutorial?:boolean}){
  const [config,setConfig]=useState<Config>({...baseline});const [mode,setMode]=useState<ReturnMode>('anonymous');const [step,setStep]=useState(0);const [part,setPart]=useState<Part>('local');
  const state=returnSnapshot(config,mode,step);
  return <div data-testid="live-model" data-state={JSON.stringify({config,mode,step,local:state.local,result:state.result,caller:state.caller})}>
    <p>{tutorial?'教程：先停在 return 赋值后比较两个位置，再执行 defer，最后才把值交给调用者。':'同一输入对照匿名与具名返回。修改参数会回到登记阶段；切换签名保留当前步骤。'}</p>
    <Settings config={config} onChange={c=>{setConfig(c);setStep(0);}}/>
    <div className="cf36-controls">{(['anonymous','named'] as const).map(m=><button type="button" key={m} aria-pressed={m===mode} onClick={()=>setMode(m)}>{modeLabels[m]}</button>)}</div>
    <Code config={config} mode={mode} step={step}/>
    <ol className="cf36-timeline">{stageLabels.map((s,i)=><li key={s} aria-current={i===step?'step':undefined}>{i+1}. {s}</li>)}</ol>
    <div className="cf36-controls"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button type="button" disabled={step===3} onClick={()=>setStep(s=>s+1)}>{step===3?'已返回调用者':'下一步：'+stageLabels[step+1]}</button><button type="button" onClick={()=>{setStep(0);setPart('local');}}>重置过程</button><button type="button" onClick={()=>{setConfig({...baseline});setStep(0);setMode('anonymous');}}>恢复基线</button></div>
    <p className="cf36-feedback" aria-live="polite">{state.message}</p>
    <ReturnGraph state={state} part={part} onPart={setPart}/>
    {!tutorial&&<div className="cf36-compare">{(['anonymous','named'] as const).map(m=>{const s=returnSnapshot(config,m,step);return <div key={m}><strong>{modeLabels[m]}</strong><p>n：{s.local} · 返回槽：{s.result??'待赋值'}</p><output>调用者：{s.caller??'尚未收到'}</output></div>;})}</div>}
    <p className="cf36-note">模型仅讨论整数返回和一次 defer。匿名返回槽是辅助示意位置；具名图的两个高亮角色表示同一个 n。可变对象的共享引用需要另行分析。</p>
  </div>;
}
function Diagram(){
  const [mode,setMode]=useState<ReturnMode>('anonymous');const [part,setPart]=useState<Part>('result');const [phase,setPhase]=useState(1);
  const config:Config={initial:2,returnKind:'literal',literal:7,operation:'multiply',operand:3};const state=returnSnapshot(config,mode,phase);
  return <div data-testid="live-model" data-state={JSON.stringify({mode,part,phase,local:state.local,result:state.result})}>
    <h3>谁与返回槽是同一个变量？</h3><p>初始 n=2，return 7，defer 把 n 乘 3。点击对象追踪其关系，再选择阶段查看它的数据来源。</p>
    <div className="cf36-controls">{(['anonymous','named'] as const).map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{modeLabels[m]}</button>)}</div>
    <ReturnGraph state={state} part={part} onPart={setPart}/>
    <div className="cf36-controls">{[1,2,3].map(i=><button type="button" key={i} aria-pressed={phase===i} onClick={()=>setPhase(i)}>{stageLabels[i]}</button>)}</div>
    <Code config={config} mode={mode} step={phase}/><p aria-live="polite">{state.message}</p>
  </div>;
}
function Example(){
  const [mode,setMode]=useState<ReturnMode>('anonymous');const [stage,setStage]=useState(1);const [bonus,setBonus]=useState(2);
  const config:Config={initial:10,returnKind:'local',literal:10,operation:'add',operand:bonus};const state=returnSnapshot(config,mode,stage);
  return <div data-testid="live-model" data-state={JSON.stringify({mode,stage,bonus,caller:state.caller})}>
    <h3>报表送出前的最后一次签核</h3><p>报表原值 10。return 先准备交付内容，签核 defer 再加修正值。选择签核修改的是草稿还是返回结果，观察收件人得到多少。</p>
    <label>签核修正值<select value={bonus} onChange={e=>{setBonus(Number(e.target.value));setStage(1);}}>{[-3,0,2,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <div className="cf36-controls"><button type="button" aria-pressed={mode==='anonymous'} onClick={()=>{setMode('anonymous');setStage(1);}}>匿名返回：先复制交付件</button><button type="button" aria-pressed={mode==='named'} onClick={()=>{setMode('named');setStage(1);}}>具名返回：签核直接改交付件</button></div>
    <div className="cf36-report"><div>草稿 n<strong>{state.local}</strong></div><div>准备交付的报表<strong>{state.result}</strong></div><div>收件人<strong>{state.caller??'尚未收到'}</strong></div></div>
    <div className="cf36-controls"><button type="button" disabled={stage!==1} onClick={()=>setStage(2)}>执行签核 defer</button><button type="button" disabled={stage!==2} onClick={()=>setStage(3)}>真正交付</button><button type="button" onClick={()=>setStage(1)}>重新准备报表</button></div>
    <p aria-live="polite">{state.message}</p><Code config={config} mode={mode} step={stage}/>
    <p className="cf36-note">类比只说明整数返回的位置与时点；defer 不负责网络发送或事务提交。生产代码应保持返回逻辑清楚。</p>
  </div>;
}
function TryIt(){
  const [task,setTask]=useState(0);const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
  const config:Config=task%2===0?{initial:4,returnKind:'literal',literal:9,operation:'multiply',operand:2}:{initial:3,returnKind:'literal',literal:-5,operation:'add',operand:4};
  const expected=(['anonymous','named'] as const).map(m=>returnSnapshot(config,m,3).caller!);
  const predicted=prediction.trim().split(/[,，\s]+/);const correct=predicted.length===2&&predicted.every((p,i)=>/^-?\d+$/.test(p)&&Number(p)===expected[i]);
  return <div data-testid="live-model" data-state={JSON.stringify({task,revealed})}>
    <h3>先预测，两种签名各返回什么？</h3><p>新案例：n={config.initial}；return {config.literal}；defer 中 n {config.operation==='multiply'?'乘':'加'} {config.operand}。</p>
    <label>调用者结果，按「匿名、具名」顺序<input value={prediction} placeholder="两个整数，逗号分隔" onChange={e=>{setPrediction(e.target.value);setRevealed(false);}}/></label>
    <label>理由：return 与 defer 分别改了哪个位置？<textarea value={reason} onChange={e=>{setReason(e.target.value);setRevealed(false);}}/></label>
    <div className="cf36-controls"><button type="button" disabled={!prediction.trim()||!reason.trim()} onClick={()=>setRevealed(true)}>提交预测和理由，再验证</button><button type="button" onClick={()=>{setTask(t=>t+1);setPrediction('');setReason('');setRevealed(false);}}>换个案例</button></div>
    {revealed&&<div role="status"><strong>{correct?'两个输出均一致':'输出存在差异'}：匿名 {expected[0]}，具名 {expected[1]}</strong><p>匿名返回槽先保存 {config.literal}，defer 改的是局部 n；具名 n 先被 return 写为 {config.literal}，然后 defer 继续修改同一个结果变量。</p><p>你的理由：{reason}</p><p>输出已核对；请用上述位置变化自行检查理由，系统不自动评价理由。</p></div>}
    <p className="cf36-note">这是辅助迁移练习，不写入独立掌握成绩。</p>
  </div>;
}
export default function Lesson36(){return <section className="cf36" data-testid="control-flow-lab-36"><h3>return 赋值 → defer 修改 → 真正返回</h3><Laboratory/></section>;}
export function Help({mode}:{mode:string}){return <section className="cf36" data-testid="control-flow-help-36">{mode==='diagram'?<Diagram/>:mode==='steps'?<Laboratory tutorial/>:mode==='try'?<TryIt/>:<Example/>}</section>;}
