import {useState} from 'react';
import {baseline, labels, requestState, type Input, type Outcome} from './model';
import './style.css';
const MAX_TIME=12;
function Timeline({input,time}:{input:Input;time:number}) {
  const state=requestState(input,time);
  const x=(n:number)=>42+n*21;
  return <div className="io66-model" data-testid="live-model" data-state={JSON.stringify(state)}>
    <svg viewBox="0 0 330 180" className="io66-svg" role="img" aria-label={`请求时间线：${time}秒，${state.phase}，${labels[state.outcome]}；远端${state.remote}`}>
      <text x="16" y="18">客户端等待</text><line x1="42" x2="294" y1="46" y2="46" stroke="#d5e4ea" strokeWidth="12"/>
      <line x1="42" x2={x(Math.min(time,state.terminalAt??MAX_TIME))} y1="46" y2="46" stroke={state.waiting?'#268e9d':state.outcome==='complete'?'#23845c':'#bb6d30'} strokeWidth="12"/>
      {[0,3,6,9,12].map(n=><g key={n}><line x1={x(n)} x2={x(n)} y1="55" y2="60" stroke="#6c8494"/><text x={x(n)} y="76" textAnchor="middle" fontSize="11">{n}s</text></g>)}
      {input.client>0&&<g><line x1={x(input.client)} x2={x(input.client)} y1="24" y2="58" stroke="#aa5b32" strokeWidth="2"/><text x={x(input.client)} y="20" textAnchor="middle" fontSize="10">C</text></g>}
      {input.context>0&&<g><line x1={x(input.context)} x2={x(input.context)} y1="24" y2="58" stroke="#794ea6" strokeWidth="2"/><text x={x(input.context)} y="92" textAnchor="middle" fontSize="10">ctx</text></g>}
      <text x="16" y="118">远端业务（独立轨道）</text><line x1="42" x2="294" y1="144" y2="144" stroke="#d5e4ea" strokeWidth="7"/>
      <circle cx={x(2)} cy="144" r="9" fill={state.remote==='已提交副作用'?'#23845c':'#d5e4ea'}/><text x={x(2)} y="171" textAnchor="middle" fontSize="11">2s 提交</text>
      <line x1={x(time)} x2={x(time)} y1="31" y2="155" stroke="#19394e" strokeWidth="2" strokeDasharray="3 3"/>
    </svg>
    <div className="io66-states"><div><small>本地 · {time}s</small><strong>{labels[state.outcome]}</strong><span>{state.phase}</span></div><div><small>远端 · 独立状态</small><strong>{state.remote}</strong><span>本地取消不自动回滚</span></div></div>
    <p className="io66-note">C = Client 总预算，ctx = context 截止。虚线是当前逻辑时间；响应头在 3s 到达，响应体{input.bodyAt===null?'持续停滞':`在 ${input.bodyAt}s 才能读完`}。</p>
  </div>;
}
function Experiment({transfer=false,guided=false}:{transfer?:boolean;guided?:boolean}) {
  const [input,setInput]=useState<Input>(transfer?{client:10,context:6,bodyAt:9,cancelAt:null}:baseline);
  const [time,setTime]=useState(0); const [prediction,setPrediction]=useState(''); const [reason,setReason]=useState('');
  const state=requestState(input,time); const ready=!!prediction&&!!reason.trim();
  const reset=()=>{setTime(0);setPrediction('');setReason('');setInput(i=>({...i,cancelAt:null}));};
  const change=(patch:Partial<Input>)=>{setInput(i=>({...i,...patch,cancelAt:null}));setTime(0);setPrediction('');setReason('');};
  const rewind=()=>{const prev=Math.max(0,time-1);setTime(prev);if(input.cancelAt!==null&&input.cancelAt>prev)setInput(i=>({...i,cancelAt:null}));};
  return <div>
    <p>{transfer?'迁移：导出接口 3s 返回响应头，9s 才读完文件。Client=10s，context=6s。先预测哪条预算结束等待，再改变条件复验。':'给库存请求配置预算，先预测 12 秒观察窗内的结果，再让逻辑时钟前进。零值不是立即失败。'}</p>
    <div className="io66-controls"><label>Client.Timeout（秒）<select value={input.client} onChange={e=>change({client:Number(e.target.value)})}>{[0,1,4,5,6,8,10].map(n=><option key={n} value={n}>{n===0?'0 · 无总体超时':`${n}s`}</option>)}</select></label>
      <label>context 截止（秒）<select value={input.context} onChange={e=>change({context:Number(e.target.value)})}>{[0,1,4,5,6,8,10].map(n=><option key={n} value={n}>{n===0?'不设截止':`${n}s 后截止`}</option>)}</select></label>
      <label>响应体完成时间<select value={input.bodyAt??'stalled'} onChange={e=>change({bodyAt:e.target.value==='stalled'?null:Number(e.target.value)})}><option value="8">8s · 慢响应体</option><option value="9">9s · 导出文件</option><option value="5">5s · 边界样例</option><option value="stalled">持续停滞</option></select></label></div>
    <fieldset disabled={time>0}><legend>运行前：预测 + 理由</legend><label>预测等待结果<select aria-label="预测等待结果" value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">选择你的判断</option>{(Object.keys(labels) as Outcome[]).filter(k=>k!=='cancel').map(k=><option value={k} key={k}>{labels[k]}</option>)}</select></label><label>预测依据<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="比较哪个截止时间？响应头之后呢？"/></label></fieldset>
    <Timeline input={input} time={time}/>
    {guided&&<div className="io66-guide"><strong>第 {time===0?1:time<3?2:state.waiting?3:4} 步 · {time===0?'先找有效预算':time<3?'追踪请求送达':state.waiting?'头已返回，预算继续计时':'分开核对两条结果'}</strong><p>{time===0?'0 表示未设置。若两项都设置，较早的时间先限制等待。':time<3?'远端可在返回响应头前提交。请求的本地状态不能代替远端业务状态。':state.waiting?'Do 返回响应后，Client.Timeout 仍覆盖后续 Body 读取。':'观察本地等待何时结束，再看远端是否提交。超时不是撤销交易。'}</p></div>}
    <div className="io66-actions"><button data-io-action="back" disabled={time===0} onClick={rewind}>回退一秒</button><button data-io-action="step" disabled={!ready||time===MAX_TIME} onClick={()=>setTime(t=>t+1)}>单步推进 1s</button><button data-io-action="reset" onClick={reset}>重置实验</button><button disabled={!ready||!state.waiting||time===0} onClick={()=>setInput(i=>({...i,cancelAt:time}))}>现在取消请求</button></div>
    <div className="io66-feedback" aria-live="polite">{!ready?'先选择预测并写下依据，才能推进时钟。':time===0?'预测已准备；单步观察预算贯穿响应头与响应体。':input.cancelAt!==null?`你在 ${input.cancelAt}s 注入了取消，已改变原预测条件。${labels[state.outcome]}；远端${state.remote}。继续推进可检查远端工作。`:(!state.waiting||time===MAX_TIME)?<><strong>{prediction===state.outcome?'预测符合观察。':'预测与观察不同。'}</strong> 你预测「{labels[prediction as Outcome]}」，当前「{labels[state.outcome]}」。{state.outcome==='waiting'?'12s 只是观察窗结束，不是自动超时；没有预算且响应体停滞时仍可持续等待。':state.outcome==='race'?'完成与截止同一时刻，真实调度与网络竞争不能由本模型决定；把预算改成 4s 或 6s 对照。':state.outcome==='complete'?'响应体在有效截止前读完，等待正常结束。':'较早生效的预算结束了本地等待，远端已执行的操作不会因此撤销。'}</>:`当前 ${time}s：${state.phase}。${time>=3?'响应头已返回；读取 Body 的时间仍在总预算内。':'继续推进，分开看本地与远端。'}`}</div>
    <p className="io66-note">模型边界：逻辑秒从 Do 开始，context 同时创建；固定 1s 送达、2s 提交、3s 返回头。假定远端忽略取消继续执行；真实服务器可能响应取消。等时送达与取消按“先送达”抽象，不能推断真实竞争结果。总预算覆盖连接、重定向及 Body 读取；此处不模拟重定向与 Transport 分阶段超时。长流应单独设计预算。探索与迁移均不记正式成绩。</p>
  </div>;
}
function BudgetDiagram(){
  const [input,setInput]=useState<Input>({client:8,context:5,bodyAt:9,cancelAt:null});const [time,setTime]=useState(0);
  const toggle=(key:'client'|'context')=>{setInput(i=>({...i,[key]:i[key]===0?(key==='client'?8:5):0}));setTime(0);};
  return <div><p>点击预算节点（或聚焦后按 Enter / 空格），接通或移除一条截止约束；然后推进时间，看哪条约束真正结束等待。</p><svg className="io66-svg" viewBox="0 0 330 190" aria-label="可切换预算的请求约束图">
    <path d="M85 60 L165 110 M245 60 L165 110 M165 110 V140" fill="none" stroke="#8ca5b3" strokeWidth="3"/>
    {(['client','context'] as const).map((key,i)=><g key={key} role="button" tabIndex={0} aria-label={`切换 ${key} 预算`} aria-pressed={input[key]>0} className="io66-node" onClick={()=>toggle(key)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(key);}}}><rect x={i*160+12} y="12" width="146" height="52" rx="10" fill={input[key]>0?'#d1eee4':'#edf1f4'} stroke="#718e9e"/><text x={i*160+85} y="33" textAnchor="middle" fontSize="14">{key==='client'?'Client.Timeout':'context deadline'}</text><text x={i*160+85} y="51" textAnchor="middle" fontSize="12">{input[key]===0?'未设置':`${input[key]}s`}</text></g>)}
    <rect x="55" y="138" width="220" height="40" rx="10" fill="#e1edf8"/><text x="165" y="163" textAnchor="middle" fontSize="14">最早预算约束整个请求等待</text></svg>
    <Timeline input={input} time={time}/><div className="io66-actions"><button disabled={time===0} onClick={()=>setTime(t=>t-1)}>回退图中时钟</button><button disabled={time===12} onClick={()=>setTime(t=>t+1)}>推进图中时钟</button><button onClick={()=>setTime(0)}>重置图中时钟</button></div><p className="io66-note">两条预算都移除后，9s 可以正常读完；这来自本样例的完成时间，不是零值带来的保证。</p></div>;
}
function Example(){const [time,setTime]=useState(0);const [leave,setLeave]=useState<number|null>(null);const input:Input={client:5,context:0,bodyAt:8,cancelAt:leave};const state=requestState(input,time);return <div><p>取餐类比：你最多等 5 分钟；厨房在第 2 分钟已经做完订单，但取餐通知很慢。提前离开不会自动把做好的饭变回原材料。</p><Timeline input={input} time={time}/><div className="io66-actions"><button disabled={time>=10} onClick={()=>setTime(t=>t+1)}>推进排队过程</button><button disabled={time===0||!state.waiting} onClick={()=>setLeave(time)}>主动离开队伍</button><button onClick={()=>{setTime(0);setLeave(null);}}>重新排队</button></div><p>对应关系：等待预算 → Client.Timeout；主动离开 → cancel；已做好饭 → 远端副作用。图中保持 HTTP 秒刻度；排队只是类比。真实取消可能通知服务器，但不保证撤销已提交事务。</p></div>;}
export default function Lesson66(){return <section className="io66" data-testid="io-lab-66"><h3>HTTP 等待预算：两条独立时间线</h3><Experiment/></section>;}
export function Help({mode}:{mode:string}){return <section className="io66" data-testid="io-help-66">{mode==='example'?<Example/>:mode==='diagram'?<BudgetDiagram/>:mode==='steps'?<Experiment guided/>:<Experiment transfer/>}</section>;}

