import {useState} from 'react';
import {defaults, initial, labels, step, run, type Config, type Strategy} from './model';
import './style.css';
const names:Record<Strategy,string>={request:'继承请求 context',without:'WithoutCancel，无独立期限',bounded:'WithoutCancel + 1 秒超时',background:'Background，无请求关联'};
export default function Lab(){
 const [config,setConfig]=useState<Config>(defaults);const [history,setHistory]=useState(()=>[initial(defaults)]);const [prediction,setPrediction]=useState('');
 const state=history[history.length-1];
 const change=(patch:Partial<Config>)=>{const next={...config,...patch};setConfig(next);setHistory([initial(next)]);setPrediction('');};
 const reset=()=>{setHistory([initial(config)]);setPrediction('');};
 const first=history[1];
 return <section className="cl130" data-testid="concurrency-lab-130">
  <header><span className="cl130-kicker">请求已结束，谁还对任务负责？</span><h3>辅助汇总生命周期实验</h3><p>预测请求结束后的状态，再逐步走过预算、清理和服务退出。修改条件会重开实验。</p></header>
  <div className="cl130-controls"><label>上下文来源<select aria-label="上下文来源" value={config.strategy} onChange={e=>change({strategy:e.target.value as Strategy})}>{Object.entries(names).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>汇总所需时间<select aria-label="汇总所需时间" value={config.duration} onChange={e=>change({duration:Number(e.target.value)})}><option value={600}>600ms · 短任务</option><option value={1600}>1600ms · 超过预算</option><option value={10000}>持续阻塞 · 本窗口内不完成</option></select></label>
   <label>服务开始退出<select aria-label="服务开始退出" value={config.shutdownAt} onChange={e=>change({shutdownAt:Number(e.target.value)})}><option value={800}>800ms</option><option value={1800}>1800ms</option></select></label>
  </div>
  <div className="cl130-checks"><label><input type="checkbox" checked={config.owner} onChange={e=>change({owner:e.target.checked})}/>服务登记任务并持有 cancel</label><label><input type="checkbox" checked={config.wait} disabled={!config.owner} onChange={e=>change({wait:e.target.checked})}/>退出时等待任务返回</label><label><input type="checkbox" checked={config.crash} onChange={e=>change({crash:e.target.checked})}/>600ms 注入进程崩溃</label></div>
  <label className="cl130-prediction">请求在 200ms 结束后，汇总会怎样？<select aria-label="预测请求结束后任务状态" value={prediction} disabled={history.length>1} onChange={e=>setPrediction(e.target.value)}><option value="">先作出预测</option><option value="canceling">收到取消，等待清理</option><option value="running">继续运行</option></select></label>
  <div className="cl130-actions"><button data-concurrency-action="step" disabled={!prediction||step(state,config)===state} onClick={()=>setHistory([...history,step(state,config)])}>单步 +200ms</button><button data-concurrency-action="back" disabled={history.length===1} onClick={()=>setHistory(history.slice(0,-1))}>回退一步</button><button data-concurrency-action="reset" onClick={reset}>重置</button><button onClick={()=>change({strategy:'bounded',owner:true,wait:true,crash:false})}>修复：预算 + 所有者 + 等待</button></div>
  <div data-testid="live-model" data-state={JSON.stringify(state)} className="cl130-model">
   <div className="cl130-clock">{state.time} <small>ms / 2000ms 观察窗口</small></div>
   <div className="cl130-lanes"><div><b>请求</b><span>{state.requestCanceled?'已结束 / 已取消':'处理中'}</span><small>原 deadline：400ms</small></div><div className={'cl130-task cl130-'+state.status}><b>辅助汇总</b><span>{labels[state.status]}</span><small>Value：{state.value??'无关联信息'}<br/>deadline：{state.deadline===null?'无':`${state.deadline}ms`}</small></div><div><b>服务</b><span>{{serving:'运行中',waiting:'已取消，等待任务返回',exited:'已退出',crashed:'已崩溃'}[state.service]}</span><small>{config.owner?'持有 cancel 与任务登记':'无任务登记'}</small></div></div>
   <p className="cl130-reason" role="status">{state.reason}</p><ol className="cl130-log" aria-label="生命周期事件时间线">{state.log.map((line,index)=><li key={index}>{line}</li>)}</ol>
  </div>
  {first&&<p className="cl130-feedback">{prediction===first.status?'预测符合本次观察。':'预测与观察不同。'}200ms 实际：{labels[first.status]}。{config.strategy==='request'?'请求的取消沿父子传播；发出通知和任务返回是两个事件。':'分离后的 context 不继承请求取消；请继续检查 deadline、Value 和服务退出。'}</p>}
  <p className="cl130-note">模型边界：时间是确定的教学步长；假设任务每 200ms 检查取消，并用一个步长清理。Go 的 cancel 不会强行杀死 goroutine。WithoutCancel 保留 Value，但不继承 deadline；Background 不保留请求 Value。勾选服务登记时，模型表示服务显式保存自己创建的 CancelFunc；无期限来源也需额外用 WithCancel 包装，WithoutCancel 本身不返回取消函数。此实验不提供持久性，必须可靠完成的业务需要持久交接与恢复。</p>
 </section>;
}
function Practice(){
 const [budget,setBudget]=useState(false),[owner,setOwner]=useState(false),[wait,setWait]=useState(false),[checked,setChecked]=useState(false);
 const config:Config={...defaults,strategy:budget?'bounded':'without',duration:10000,shutdownAt:1800,owner,wait};
 const timeline=run(config),last=timeline.at(-1)!;
 return <div><p>辅助练习 · 不计入独立掌握：诊断汇总持续阻塞，服务在 1800ms 退出。补上独立 1 秒预算、服务取消责任与等待，再运行协议。</p>
 <div className="cl130-checks"><label><input type="checkbox" checked={budget} onChange={e=>{setBudget(e.target.checked);setChecked(false)}}/>独立超时</label><label><input type="checkbox" checked={owner} onChange={e=>{setOwner(e.target.checked);setChecked(false)}}/>服务持有 cancel</label><label><input type="checkbox" checked={wait} onChange={e=>{setWait(e.target.checked);setChecked(false)}}/>退出等待返回</label></div>
 <div className="cl130-chain"><span>请求结束</span><span>→ 汇总 {budget?'有结束预算':'无独立期限'}</span><span>→ 服务 {owner?'可主动取消':'没有取消责任人'}</span><span>→ {wait?'等待确认返回':'不确认是否退出'}</span></div>
 <button onClick={()=>setChecked(true)}>检验生命周期</button>
 {checked&&<div data-testid="live-model" data-state={JSON.stringify(timeline)}><p role="status">{budget&&owner&&wait?'三项均已补齐。仍不保证进程崩溃后完成；强可靠工作需交给持久任务系统。':!budget?'缺少独立期限：WithoutCancel 没有继承原 deadline；任务只能等服务退出或其他取消条件。':!owner?'缺少所有者：本次期限能让任务结束，但服务提前退出时谁来取消并收回资源？':'缺少完成等待：本次任务可能已因期限返回；若退出时仍在清理，cancel 不能代替完成确认。'}</p><p>本次实际结局：{last.time}ms · {labels[last.status]}。</p><ol aria-label="辅助任务运行证据">{timeline.filter((s,i)=>i===0||s.status!==timeline[i-1].status||s.service!==timeline[i-1].service).map(s=><li key={s.time}>{s.time}ms：{labels[s.status]} · {s.reason}</li>)}</ol></div>}
 </div>;
}
export function Help({mode}:{mode:string}){const [focus,setFocus]=useState('value');const [stage,setStage]=useState(0);return <section className="cl130 cl130-help" data-testid="concurrency-help-130">{mode==='example'?<><h3>一次 600ms 诊断汇总，三种结局</h3><div className="cl130-examples"><article><b>继承请求</b><p>200ms 请求结束 → 收到取消 → 400ms 清理返回，诊断未完成。</p></article><article><b>分离 + 新预算</b><p>200ms 继续 → 600ms 汇总完成 → 800ms 服务退出前确认任务已返回。</p></article><article><b>进程在 600ms 崩溃</b><p>本例崩溃事件先发生，未完成的内存任务丢失；context 不能保存任务。</p></article></div></>:mode==='diagram'?<><h3>沿哪一条关系追踪？</h3><div className="cl130-actions">{[['value','关联信息'],['cancel','请求取消'],['owner','服务责任']].map(([v,l])=><button key={v} aria-pressed={focus===v} onClick={()=>setFocus(v)}>{l}</button>)}</div><div className="cl130-chain">{(focus==='value'?['请求 Value = req-7','→ WithoutCancel 保留','→ 诊断关联 req-7']:focus==='cancel'?['请求结束 / deadline','⊣ WithoutCancel 不传播','→ 必须另设 1 秒 deadline']:['服务登记任务','→ 退出调用 cancel','→ 任务清理返回','→ 等待解除后退出']).map(x=><span key={x}>{x}</span>)}</div><p>{focus==='value'?'Background 从空上下文开始，不能自动获得 req-7。':focus==='cancel'?'WithoutCancel 的 Done 为 nil，Err 为 nil，Deadline 不存在；仍能查询父 context 的 Value。':'服务取消信号与完成等待是两条责任链；只有发出 cancel 不能证明任务已经退出。'}</p></>:mode==='steps'?<><h3>逐步建立退出协议</h3><ol className="cl130-steps">{['先界定：只对活跃请求有价值的工作，继续继承请求。','允许尽力执行的后续汇总：保留必要关联信息，分离请求取消。','立刻设置独立预算，登记服务所有者与 cancel。','服务退出时取消任务，等待清理返回，再完成退出。','若业务要求跨崩溃完成，改为持久交接与恢复。'].slice(0,stage+1).map((s,i)=><li key={s}><b>{i+1}.</b> {s}</li>)}</ol><button disabled={stage===4} onClick={()=>setStage(stage+1)}>展开下一步</button><button disabled={stage===0} onClick={()=>setStage(0)}>重新梳理</button></>:<Practice/>}</section>;}
