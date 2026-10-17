import {useState} from 'react';
import {available51, deadlocked51, initial51, step51, type Action51, type Mode51, type Outcome51, type State51} from './model51';
import './lesson51.css';

const actions: {id:Action51; label:string}[] = [{id:'send',label:'发送者：发送 7'},{id:'receive',label:'接收者：接收订单'},{id:'process',label:'接收者：完成开票并关闭 done'},{id:'waitDone',label:'发送者：等待 done 确认'}];
const outcomes: {id:Outcome51;label:string}[] = [{id:'waiting',label:'当前操作等待'},{id:'handoff',label:'订单交接完成，业务尚未完成'},{id:'processed',label:'开票完成并发出 done'},{id:'confirmed',label:'立即确认业务已完成'}];
const senderText = {ready:'尚未发送',waiting:'阻塞在 ch <- 7',sent:'发送通信已完成'};
const receiverText = {ready:'尚未接收',waiting:'阻塞在 <-ch',processing:'已收到 7，待开票',done:'开票完成，done 已关闭'};

function Board51({state:s}:{state:State51}) {
  return <div className="cl-board l51-board" data-testid="live-model" data-state={JSON.stringify(s)}>
    <div className="cl-card" data-active={s.sender==='waiting'}><h4>{s.mode==='same'?'唯一 goroutine':'发送者 goroutine'}</h4><p>{senderText[s.sender]}</p><code>ch &lt;- 7</code><p>业务确认：{s.confirmation==='confirmed'?'已确认':s.confirmation==='waiting'?'等待 done':'尚未确认'}</p></div>
    <div className="cl-card l51-channel"><h4>无缓冲通道</h4><strong>容量 0 · 没有存储槽</strong><p>{s.sender==='waiting'?'7 在发送者手上 → 等待交接':s.sender==='sent'?'7 已交给接收者 →':'等待双方到场'}</p><p>交接次数：{s.sender==='sent'?1:0}</p></div>
    <div className="cl-card" data-active={s.receiver==='processing'}><h4>{s.mode==='same'?'同一 goroutine 的后续代码':'接收者 goroutine'}</h4><p>{s.mode==='same'?'接收行位于发送之后，无法到达':receiverText[s.receiver]}</p><code>v := &lt;-ch → invoice(v) → close(done)</code></div>
  </div>;
}

export default function Lesson51() {
  const [history,setHistory] = useState<State51[]>([initial51()]);
  const [action,setAction] = useState<Action51>('send');
  const [prediction,setPrediction] = useState<Outcome51|''>('');
  const [reason,setReason] = useState('');
  const [feedback,setFeedback] = useState('');
  const s=history[history.length-1];
  function reset(mode:Mode51=s.mode) {setHistory([initial51(mode)]);setPrediction('');setReason('');setFeedback('');setAction('send');}
  function run() {
    const next=step51(s,action);
    setHistory([...history,next]);
    setFeedback(`${prediction===next.outcome?'预测符合本步结果。':'预测与本步不同。'}你预测“${outcomes.find(o=>o.id===prediction)?.label}”${reason?`，理由：${reason}`:''}。${next.message}`);
    setPrediction('');setReason('');
    const nextAction = actions.find(a=>available51(next,a.id));
    if(nextAction)setAction(nextAction.id);
  }
  return <section className="channel-lesson lesson51" data-testid="lesson51-lab">
    <div className="cl-heading"><h3>订单交接调度台</h3><p>扮演调度器，安排哪一方先执行；区分“数据已接收”和“开票已完成”。</p></div>
    <div className="cl-controls"><label>程序结构 <select value={s.mode} onChange={e=>reset(e.target.value as Mode51)}><option value="concurrent">两个 goroutine 并发交接</option><option value="same">同一 goroutine 先发后收</option></select></label><button onClick={()=>reset()}>重置</button><button disabled={history.length===1} onClick={()=>{const previous=history[history.length-2];setHistory(history.slice(0,-1));setFeedback('已回退到上一步，可重新选择调度路径。');setPrediction('');setReason('');const nextAction=actions.find(a=>available51(previous,a.id));if(nextAction)setAction(nextAction.id);}}>回退一步</button></div>
    <Board51 state={s}/>
    <div className="cl-code"><pre>{s.mode==='same'?'ch := make(chan int)\nch <- 7  // 等接收，但唯一 goroutine 卡在这里\nv := <-ch // 无法到达':`ch := make(chan int)\ndone := make(chan struct{})\ngo func() {\n  v := <-ch  // ${s.receiver==='ready'?'待执行':s.receiver==='waiting'?'等待发送':'已收到 7'}\n  invoice(v) // ${s.receiver==='done'?'已完成':'尚未完成'}\n  close(done)\n}()\nch <- 7     // ${senderText[s.sender]}\n<-done      // ${s.confirmation==='confirmed'?'已返回':s.confirmation==='waiting'?'等待业务完成':'尚未执行'}`}</pre></div>
    <fieldset className="cl-prediction"><legend>预测 → 调度一步 → 对照证据</legend><label>下一操作 <select aria-label="第51题下一操作" value={action} onChange={e=>{setAction(e.target.value as Action51);setPrediction('');}}>{actions.map(a=><option key={a.id} value={a.id} disabled={!available51(s,a.id)}>{a.label}</option>)}</select></label><label>预测本步结果 <select aria-label="第51题预测" value={prediction} onChange={e=>setPrediction(e.target.value as Outcome51| '')}><option value="">先作预测</option>{outcomes.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label><label>预测理由（可选）<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪一方已到场？通信后还有什么工作？"/></label><button disabled={!prediction||!available51(s,action)} onClick={run}>执行所选操作</button></fieldset>
    <p className="cl-feedback" aria-live="polite">{feedback||s.message}</p>
    {deadlocked51(s)&&<p className="cl-note">死锁证据：唯一执行者停在发送；后续接收无法运行。切换为“两个 goroutine”重新实验，验证修复。</p>}
    <ol className="cl-history" aria-label="第51题执行记录">{history.slice(1).map((entry,i)=><li key={i}>{entry.message}</li>)}</ol>
    <p className="cl-note">模型边界：固定一条订单、一个发送者与一个接收者；每次点击是一项逻辑事件，不表示真实耗时或 Go 调度顺序。通信配对后双方都可继续；业务需额外 done 信号。此处操作和提示不计入独立掌握证据。</p>
  </section>;
}

export function Help51({mode}:{mode:string}) {
  const [focus,setFocus]=useState<'handoff'|'business'>('handoff');
  const [step,setStep]=useState(0);
  const [challenge,setChallenge]=useState(initial51());
  const [tried,setTried]=useState(false);
  let content;
  if(mode==='diagram') content=<><p>选择一条关系，追踪它真正保证的终点。</p><div className="cl-controls"><button aria-pressed={focus==='handoff'} onClick={()=>setFocus('handoff')}>追踪通信同步</button><button aria-pressed={focus==='business'} onClick={()=>setFocus('business')}>追踪业务确认</button></div><div className="l51-diagram" role="img" aria-label="发送和接收配对之后，接收者执行业务，关闭done，等待done返回"><div data-active={focus==='handoff'}>发送 ch &lt;- 7 ⇄ 接收 &lt;-ch<br/><strong>双方到场 → 交接完成</strong></div><span>接收者继续 ↓</span><div data-active={focus==='business'}>invoice(7) 完成 → close(done)<br/>↓<br/>发送者 &lt;-done 返回</div></div><p>{focus==='handoff'?'这个同步点只交付数据；不能推出 invoice 已完成。':'done 放在 invoice 之后，等待 done 返回才能确认业务结束。箭头表示先后依赖，不代表耗时。'}</p></>;
  else if(mode==='steps') {const steps=['先检查容量：make(chan int) 没有缓冲槽。','检查接收能否并发到达；同一 goroutine 的后续接收无法救活当前发送。','观察配对后的两个状态：发送已完成，接收者刚拿到订单。','把业务完成放在独立事件上；invoice 后 close(done)，发送者再 <-done。'];content=<><ol className="cl-steps">{steps.slice(0,step+1).map((text,i)=><li key={text} aria-current={i===step?'step':undefined}>{text}</li>)}</ol><div className="cl-controls"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button><button disabled={step===3} onClick={()=>setStep(step+1)}>展开下一推理</button></div></>;}
  else if(mode==='try') content=<><p>小挑战：构造一个反例，让“发送已完成，但业务未完成”同时成立。选择到场顺序，并停在目标状态。</p><div className="cl-controls"><button disabled={!available51(challenge,'send')} onClick={()=>{setChallenge(step51(challenge,'send'));setTried(false);}}>让发送者到场</button><button disabled={!available51(challenge,'receive')} onClick={()=>{setChallenge(step51(challenge,'receive'));setTried(false);}}>让接收者到场</button><button disabled={!available51(challenge,'process')} onClick={()=>{setChallenge(step51(challenge,'process'));setTried(false);}}>继续开票</button><button onClick={()=>setTried(true)}>检查当前反例</button><button onClick={()=>{setChallenge(initial51());setTried(false);}}>重试</button></div><p>发送：{senderText[challenge.sender]}；接收：{receiverText[challenge.receiver]}</p><p aria-live="polite">{tried?(challenge.sender==='sent'&&challenge.receiver==='processing'?'反例成立：交接已完成，开票尚未执行。再等待业务须另设完成信号。':challenge.receiver==='done'?'走过了目标状态：开票也完成了。重试并停在数据交接之后。':'还未完成交接；让缺席的一方到场，再检查。'):challenge.message}</p></>;
  else content=<><p>开票服务把订单 7 交给 worker。无缓冲通道像当面递交纸单：对方没伸手，发送就停住；接过纸单后，开票仍需另一段工作。</p><div className="cl-controls"><button aria-pressed={focus==='handoff'} onClick={()=>setFocus('handoff')}>只确认订单收到</button><button aria-pressed={focus==='business'} onClick={()=>setFocus('business')}>需要确认票已开好</button></div><pre className="cl-code">{focus==='handoff'?'ch <- 7\n// 只知道配对接收发生了':'ch <- 7\n<-done\n// worker 在 invoice(7) 后 close(done)'}</pre><p>{focus==='handoff'?'收到不等于办完：发送返回后，不应直接认定开票成功。':'额外等待把业务完成纳入协议；真实业务还需单独传递失败结果。'}</p><p className="cl-note">类比边界：Go 调度可能让任一方先继续；面对面交接不意味着接收方后续工作同步结束。</p></>;
  return <section className="cl-help lesson51" data-testid="lesson51-help">{content}</section>;
}
