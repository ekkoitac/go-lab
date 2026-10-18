import {useState} from 'react';
import {canStep,initialState,observation,runSchedule,step,type Action,type Policy,type State} from './model';
import './style.css';
const policyName=(p:Policy)=>p==='split'?'分两段加同一把锁':'整体持有同一把锁';
function Board({s}:{s:State}) {
  return <div className="sync44-board" data-testid="live-model" data-state={JSON.stringify(s)}>
    <article><h4>锁内工作区 · 内部状态</h4><div className="sync44-accounts"><span>A <strong>{s.a}</strong></span><span>→ {s.amount} →</span><span>B <strong>{s.b}</strong></span></div><p>当前和：<b>{s.a+s.b}</b> / 目标 {s.total}</p><p>{s.a+s.b===s.total?'总额成立':'扣入之间的临时状态'}</p></article>
    <article><h4>共同 mutex</h4><strong>{s.locked?'转账持有 · 监控需等待':'空闲 · 监控可获取'}</strong><p>{policyName(s.policy)}</p><small>所有读写使用同一把锁。差别在于何时释放。</small></article>
    <article><h4>监控最后读到的快照</h4><strong>{s.observed?`${s.observed.a} + ${s.observed.b} = ${s.observed.total}`:'尚未读取'}</strong><p>{s.observed ? s.observed.total===s.total?'这份快照满足约束':'这份快照违反约束':'内部状态不等于外部已读取的值'}</p><small>成功读取 {s.reads} 次 · 阻塞尝试 {s.blocked} 次</small></article>
  </div>;
}
export default function Lab() {
  const [history,setHistory]=useState<State[]>([initialState()]);
  const [prediction,setPrediction]=useState('');
  const [reason,setReason]=useState('');
  const [feedback,setFeedback]=useState('');
  const s=history[history.length-1];
  function reset(policy=s.policy,amount=s.amount) {setHistory([initialState(policy,amount)]);setPrediction('');setReason('');setFeedback('');}
  function act(action:Action) {
    if (action==='observe'&&!prediction) return;
    const next=step(s,action);
    if(next===s)return;
    if(action==='observe')setFeedback(`${prediction===observation(s)?'预测吻合':'预测需要修正'}：你预测 ${prediction==='blocked'?'阻塞':prediction}，实际${observation(s)==='blocked'?'阻塞，没有新快照':`读到 ${observation(s)}`}。${reason?`你的理由：${reason}。`:''} ${next.message}`);
    else setFeedback(next.message);
    setHistory([...history,next]);setPrediction('');setReason('');
  }
  return <section className="sync44" data-testid="lesson44-lab"><h3>让监控插入转账中间</h3><p>目标是 A+B 始终对外呈现 100。先尝试「扣款 → 监控 → 入账」，再把临界区改成整体，重放同一顺序。</p>
    <div className="sync44-controls"><label>锁的范围<select value={s.policy} onChange={e=>reset(e.target.value as Policy)}><option value="split">分两段加同一把锁</option><option value="whole">扣款与入账整体加锁</option></select></label><label>转账金额<select value={s.amount} onChange={e=>reset(s.policy,Number(e.target.value))}>{[5,10,20,30,60].map(n=><option key={n}>{n}</option>)}</select></label></div><small>改变参数会重新开始。此模型仅协调一个进程内、遵守共同锁的读写。</small>
    <Board s={s}/><div className="sync44-actions"><button disabled={!canStep(s,'debit')} onClick={()=>act('debit')}>转账：扣款</button><button disabled={!canStep(s,'credit')} onClick={()=>act('credit')}>转账：入账并解锁</button></div>
    <fieldset><legend>调度监控前，先预测</legend><label>本次读取会怎样？<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择预测</option><option value="100">读到 100</option><option value={String(100-s.amount)}>读到 {100-s.amount}</option><option value="blocked">阻塞，不产生快照</option></select></label><label>你的理由（可选）<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="观察时谁持锁？"/></label><button disabled={!prediction} onClick={()=>act('observe')}>验证：监控读取</button></fieldset>
    <p role="status" className="sync44-feedback">{feedback||s.message}</p><div className="sync44-actions"><button disabled={history.length===1} onClick={()=>{setHistory(history.slice(0,-1));setPrediction('');setReason('');setFeedback('已回退，可以改变后续调度。');}}>回退一步</button><button onClick={()=>reset()}>重置实验</button></div><p className="sync44-note">不变量允许在受保护的操作内部暂时不成立；关键是共同锁要阻止其他参与者观察到这个中间状态。监控阻塞后需再次调度才能获得新快照。</p>
  </section>;
}
function Example(){
  const [amount,setAmount]=useState(12);const [policy,setPolicy]=useState<Policy>('split');
  const result=runSchedule(policy,amount,['debit','observe'],70,10);
  return <><h3>换成仓库：可售 + 预占 = 80</h3><p>把 {amount} 件货从可售区移入预占区。每个区单独更新完就开放查询，会暴露搬到一半的库存。</p><div className="sync44-controls"><label>预占件数<input type="range" min="1" max="30" value={amount} onChange={e=>setAmount(Number(e.target.value))}/>{amount} 件</label><label>查询开放时机<select value={policy} onChange={e=>setPolicy(e.target.value as Policy)}><option value="split">可售减少后立即开放</option><option value="whole">等预占也增加后开放</option></select></label></div><div className="sync44-warehouse" data-testid="live-model" data-state={JSON.stringify(result)}><article>可售：<b>{result.a}</b></article><span>搬运中：{amount}</span><article>预占：<b>{result.b}</b></article></div><p role="status">此刻查询：{result.locked?'等待完整操作，不能读到搬运中间值':`得到 ${result.a}+${result.b}=${result.a+result.b}，比 80 少 ${amount}`}。</p><p>类比边界：这里的「关门」对应所有参与者共同遵守的 mutex；它不代表跨服务库存事务。</p></>;
}
function Diagram(){
  const [policy,setPolicy]=useState<Policy>('split');const [stage,setStage]=useState(1);
  const actions:Action[]=['debit','credit'];const s=runSchedule(policy,10,actions.slice(0,stage));
  return <><h3>把临界区画出来</h3><label>观察哪种边界<select value={policy} onChange={e=>setPolicy(e.target.value as Policy)}><option value="split">两段临界区</option><option value="whole">完整临界区</option></select></label><div className="sync44-flow" aria-label="锁范围和监控路径" data-testid="live-model" data-state={JSON.stringify(s)}><div className="sync44-lane"><b>转账</b>{policy==='split'?<><span>Lock → A−10 → Unlock</span><span>开放窗口：监控可插入</span><span>Lock → B+10 → Unlock</span></>:<div className="sync44-boundary"><b>共同锁持有区间</b><span>Lock → A−10</span><span>仍持锁 → B+10 → Unlock</span></div>}</div><div className="sync44-lane"><b>监控</b><span>请求同一把锁</span><span>{s.locked?'↓ 等待，无法进入读取区':'↓ 可进入读取区'}</span><span>{s.locked?'没有新快照':`A+B = ${s.a+s.b}`}</span></div></div><label>把观察点移动到<select value={stage} onChange={e=>setStage(Number(e.target.value))}><option value="0">扣款前</option><option value="1">扣款后、入账前</option><option value="2">入账后</option></select></label><p role="status">当前内部：A={s.a}、B={s.b}。{s.locked?'锁把内部暂态挡在外部观察之外。':'监控此时能获得锁并读取这两个值。'}</p></>;
}
const trace:Action[]=['debit','observe','credit','observe'];
const traceNames=['起点','扣款','监控请求读取','入账并解锁','监控再次读取'];
function Steps(){
  const [cursor,setCursor]=useState(0);const [policy,setPolicy]=useState<Policy>('split');
  const s=runSchedule(policy,10,trace.slice(0,cursor));
  return <><h3>沿同一条调度对照</h3><label>对照锁范围<select value={policy} onChange={e=>setPolicy(e.target.value as Policy)}><option value="split">分段加锁</option><option value="whole">整体加锁</option></select></label><ol className="sync44-trace">{traceNames.map((name,i)=><li key={name} aria-current={i===cursor?'step':undefined}>{name}</li>)}</ol><Board s={s}/><p role="status">第 {cursor} 步 · {s.message}</p><div className="sync44-actions"><button disabled={cursor===0} onClick={()=>setCursor(cursor-1)}>退回上一步</button><button disabled={cursor===4} onClick={()=>setCursor(cursor+1)}>执行下一步</button><button onClick={()=>setCursor(0)}>重播此路径</button></div><p>这是带提示的演练。切换锁范围保留观察点，比较同一次监控究竟读取还是等待。</p></>;
}
function Try(){
  const [caseId,setCaseId]=useState(0);const [answer,setAnswer]=useState('');const [repair,setRepair]=useState('');const [submitted,setSubmitted]=useState(false);
  const cases=[{a:45,b:35,n:7},{a:52,b:28,n:13},{a:61,b:19,n:9}];const c=cases[caseId];const actual=c.a+c.b-c.n;
  const passed=Number(answer)===actual&&answer.trim()!==''&&repair==='whole';
  return <><h3>换个库存情境：补全报告并修复</h3><p>新库存：可售 {c.a}，预占 {c.b}，总计 80。本次预占 {c.n}。现有代码分别加锁更新两字段；监控在可售减少后、预占增加前持同一锁整体读取。</p><label>预测监控读到的总量<input inputMode="numeric" value={answer} disabled={submitted} onChange={e=>setAnswer(e.target.value)}/></label><label>为了让任意时机查询都得到总量 80，选择修改<select value={repair} disabled={submitted} onChange={e=>setRepair(e.target.value)}><option value="">选择方案</option><option value="whole">两项更新共用完整临界区；查询也用同一锁整体读取</option><option value="writer">只修改写者；查询绕过锁以免等待</option><option value="split">两项更新继续分别加锁，多读几次</option></select></label><button disabled={submitted||!answer.trim()||!repair} onClick={()=>setSubmitted(true)}>提交预测与修复</button>{submitted&&<div className="sync44-feedback" role="status"><strong>{passed?'本次迁移证据成立':'本次迁移还需修正'}</strong><p>你的预测 {answer}；实际：({c.a}−{c.n})+{c.b}={actual}。这段临界区在预占增加前就结束了。</p><p>{repair==='whole'?'修复边界正确：更新整体持锁，查询同样持锁，才能挡住半成品。':'修复尚不完整：查询也必须遵守共同锁，重复读取不保证避开中间状态。'}</p><small>这是帮助内的迁移练习，不写入独立掌握记录；看过反馈后的重做属于巩固练习。</small></div>}<button onClick={()=>{setCaseId((caseId+1)%cases.length);setAnswer('');setRepair('');setSubmitted(false);}}>换一组输入</button></>;
}
export function Help({mode}:{mode:string}) {return <section className="sync44 sync44-help" data-testid="lesson44-help">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}</section>;}



