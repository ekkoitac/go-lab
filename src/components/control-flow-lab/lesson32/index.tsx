import {useState} from 'react';
import {captureSnapshot,finalOutput,lastStep,modeLabels,modes,parseValues,type CaptureMode,type Snapshot} from './model';
import './style.css';
const code:Record<CaptureMode,string>={
  shared:'var v int\nfor _, v = range ids {\n  fs = append(fs, func() int { return v })\n}',
  iteration:'for _, v := range ids {\n  fs = append(fs, func() int { return v })\n}',
  parameter:'makeFn := func(x int) func() int {\n  return func() int { return x }\n}\nvar v int\nfor _, v = range ids {\n  fs = append(fs, makeFn(v))\n}'
};
function Graph({state,selected,onSelect}:{state:Snapshot;selected:number;onSelect:(n:number)=>void}){
  const active=state.callbacks.find(c=>c.id===selected);
  return <div className="cf32-graph">
    <svg viewBox="0 0 300 220" role="img" aria-label="左侧回调通过箭头引用右侧变量，连线不是值的复制">
      <text x="12" y="18">回调（登记后等待）</text><text x="203" y="18">变量</text>
      {state.callbacks.map((c,i)=>{const target=state.cells.findIndex(cell=>cell.id===c.cellId);return <g key={c.id} className={active?.cellId===c.cellId?'cf32-linked':''}>
        <path d={'M 100 '+(48+i*44)+' C 152 '+(48+i*44)+', 150 '+(48+target*44)+', 195 '+(48+target*44)}/><path d={'M 188 '+(44+target*44)+' L 195 '+(48+target*44)+' L 188 '+(52+target*44)}/>
        <rect x="10" y={30+i*44} width="90" height="34" rx="8"/><text x="20" y={52+i*44}>回调 {i+1}</text>
      </g>;})}
      {state.cells.map((cell,i)=><g key={cell.id} className={active?.cellId===cell.id?'cf32-linked':''}><rect x="198" y={30+i*44} width="94" height="34" rx="8"/><text x="206" y={52+i*44}>{cell.id} = {cell.value}</text></g>)}
    </svg>
    <div className="cf32-controls" aria-label="追踪回调引用">{state.callbacks.map(c=><button type="button" key={c.id} aria-pressed={selected===c.id} onClick={()=>onSelect(c.id)}>追踪回调 {c.id+1}</button>)}</div>
    <p>{active?'回调 '+(active.id+1)+' → '+active.cellId+' → 当前可读值 '+state.cells.find(c=>c.id===active.cellId)?.value+'；同样引用它的回调：'+state.callbacks.filter(c=>c.cellId===active.cellId).map(c=>c.id+1).join('、')+'。':'执行登记步骤后，点击回调追踪它引用的变量。'}</p>
  </div>;
}
function Lab({compare=true}:{compare?:boolean}){
  const [draft,setDraft]=useState('1,2,3');const [values,setValues]=useState([1,2,3]);const [step,setStep]=useState(0);const [mode,setMode]=useState<CaptureMode>('shared');const [selected,setSelected]=useState(0);const [error,setError]=useState('');
  const state=captureSnapshot(values,mode,step);
  function apply(){try{setValues(parseValues(draft));setStep(0);setSelected(0);setError('');}catch(e){setError((e as Error).message);}}
  return <div data-testid="live-model" data-state={JSON.stringify({values,mode,step,outputs:state.outputs})}>
    <div className="cf32-controls"><label>商品编号 <input value={draft} onChange={e=>setDraft(e.target.value)} aria-label="商品编号"/></label><button type="button" onClick={apply}>应用输入并重置</button></div>
    {error&&<p role="alert">{error}</p>}
    <div className="cf32-controls">{modes.map(m=><button type="button" key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{modeLabels[m]}</button>)}</div>
    <p>输入固定，切换声明方式可对照同一时刻；以下模型按 Go 1.22+ 的语言语义运行。没有并发调度。</p>
    <pre>{'ids := []int{'+values.join(',')+'}\n'+code[mode]+'\n// 循环结束后才依次调用 fs'}</pre>
    <div className="cf32-controls"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>回退一步</button><button type="button" disabled={step===lastStep(values)} onClick={()=>setStep(s=>s+1)}>{step<values.length?'登记回调 '+(step+1):step===values.length?'结束注册循环':step<lastStep(values)?'执行回调 '+(step-values.length):'全部执行完毕'}</button><button type="button" onClick={()=>{setStep(0);setSelected(0);}}>重置过程</button></div>
    <p aria-live="polite">步骤 {step}/{lastStep(values)} · {state.message}</p>
    <Graph state={state} selected={selected} onSelect={setSelected}/>
    <p><strong>已经执行的输出：</strong><output>{state.outputs.length?state.outputs.join(', '):'无，登记时未调用回调'}</output></p>
    {compare&&<div className="cf32-comparison">{modes.map(m=>{const s=captureSnapshot(values,m,step);return <div key={m}><strong>{modeLabels[m]}</strong><span>被回调引用的变量数 {s.cells.length} · 已登记 {s.callbacks.length}</span><output>已输出 {s.outputs.join(', ')||'无'}</output></div>;})}</div>}
    <p className="cf32-note">边界：演示的是整数。独立的指针变量也可能指向同一个对象；:= 不会深复制对象。模块的语言版本也需要满足 Go 1.22+。</p>
  </div>;
}
function Diagram(){
  const [mode,setMode]=useState<CaptureMode>('shared');const [selected,setSelected]=useState(0);const state=captureSnapshot([4,7,9],mode,4);
  return <div data-testid="live-model" data-state={JSON.stringify({mode,selected,phase:'registered'})}><p>三个按钮都已登记，尚未执行。选择回调，追踪变量、关联回调与代码读取位置；再切换声明方式比较连线。</p><div className="cf32-controls">{modes.map(m=><button key={m} type="button" aria-pressed={m===mode} onClick={()=>setMode(m)}>{modeLabels[m]}</button>)}</div><Graph state={state} selected={selected} onSelect={setSelected}/><pre>{code[mode]}</pre><p aria-live="polite">选中回调 {selected+1} 的 return 读取 {state.callbacks[selected].cellId}；{mode==='parameter'?'makeFn(v) 在登记时被调用，x 获得当时的整数副本。':'回调函数体直到调用时才读取引用的变量。'}</p></div>;
}
function Example(){
  const [mode,setMode]=useState<CaptureMode>('shared');const [clicked,setClicked]=useState<number|null>(null);
  const [values,setValues]=useState([12,24,36]);const [draft,setDraft]=useState('12,24,36');const [error,setError]=useState('');
  const outputs=finalOutput(values,mode);
  return <div data-testid="live-model" data-state={JSON.stringify({values,mode,clicked,read:clicked===null?null:outputs[clicked]})}>
    <h3>商品按钮为什么打开了最后一件商品？</h3><p>三个按钮已完成注册。你来点击任意商品，比较按钮上登记的编号与回调实际读取的编号，再修复声明方式。</p>
    <div className="cf32-controls"><label>登记的商品编号<input value={draft} onChange={e=>setDraft(e.target.value)}/></label><button type="button" onClick={()=>{try{setValues(parseValues(draft));setClicked(null);setError('');}catch(e){setError((e as Error).message);}}}>重新登记按钮</button></div>{error&&<p role="alert">{error}</p>}
    <div className="cf32-controls">{modes.map(m=><button key={m} type="button" aria-pressed={m===mode} onClick={()=>{setMode(m);setClicked(null);}}>{modeLabels[m]}</button>)}</div>
    <div className="cf32-comparison">{values.map((v,i)=><button type="button" key={i} onClick={()=>setClicked(i)}>打开商品 {v}<br/>回调 {i+1}</button>)}</div>
    <p role="status">{clicked===null?'点击一个商品按钮，执行它保存的回调。':'点击编号 '+values[clicked]+' 的按钮 → 回调 '+(clicked+1)+' 读到 '+outputs[clicked]+'。'+(outputs[clicked]===values[clicked]?'这次与按钮编号一致；再点击其他按钮检查。':'读取结果与按钮编号不同。追踪下图，找出共享变量。')}</p>
    <Graph state={captureSnapshot(values,mode,values.length+1)} selected={clicked??0} onSelect={setClicked}/>
    <pre>{code[mode]}</pre><p>显式传值时 makeFn(v) 在登记按钮时运行，给参数 x 一个整数副本；返回的闭包以后读取 x。</p>
  </div>;
}
function TryIt(){
  const [task,setTask]=useState(0);const [mode,setMode]=useState<CaptureMode>('shared');const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
  const values=task%2===0?[8,-2,5]:[6,0,-4,2];const actual=finalOutput(values,mode);let correct=false;try{correct=JSON.stringify(parseValues(prediction))===JSON.stringify(actual);}catch{/* Feedback follows submission. */}
  return <div data-testid="live-model" data-state={JSON.stringify({task,mode,revealed})}><p>新输入 [{values.join(', ')}]：先推导所有回调在循环结束后依次执行的输出，再说明它们引用几个变量。</p><label>声明方式 <select value={mode} onChange={e=>{setMode(e.target.value as CaptureMode);setRevealed(false);}}>{modes.map(m=><option value={m} key={m}>{modeLabels[m]}</option>)}</select></label><pre>{code[mode]}</pre><label>预测输出 <input value={prediction} onChange={e=>{setPrediction(e.target.value);setRevealed(false);}} placeholder="用逗号分隔"/></label><label>预测理由 <textarea value={reason} onChange={e=>{setReason(e.target.value);setRevealed(false);}} placeholder="回调引用谁？后续迭代会修改谁？"/></label><div className="cf32-controls"><button type="button" disabled={!prediction.trim()||!reason.trim()} onClick={()=>setRevealed(true)}>提交预测与理由，再验证</button><button type="button" onClick={()=>{setTask(t=>t+1);setPrediction('');setReason('');setRevealed(false);}}>换组输入</button></div>{revealed&&<div role="status"><strong>{correct?'输出预测一致':'输出与预测不同'}：实际 {actual.join(', ')}</strong><p>{mode==='shared'?'所有回调连接唯一的 v；最后一轮把它写成 '+values.at(-1)+'。':'每次'+(mode==='iteration'?'迭代声明':'工厂调用')+'建立一个独立变量，后续迭代没有覆盖前面的变量。'} 请把这个证据与你的理由对照，理由需要你自行核对。</p><p>你的理由：{reason}</p></div>}<p className="cf32-note">这是带帮助的迁移练习，不写入独立掌握成绩。</p></div>;
}
export default function Lesson32(){return <section className="cf32" data-testid="control-flow-lab-32"><h3>登记回调，与执行回调分开看</h3><Lab/></section>;}
export function Help({mode}:{mode:string}){return <section className="cf32" data-testid="control-flow-help-32">{mode==='diagram'?<Diagram/>:mode==='try'?<TryIt/>:mode==='steps'?<><h3>跟着变量走一遍</h3><p>先登记、再结束循环、最后调用。每一步都可以回退，观察引用是否改变。</p><Lab compare={false}/></>:<Example/>}</section>;}
