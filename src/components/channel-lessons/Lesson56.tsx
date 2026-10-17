import {useState} from 'react';
import {applyAction, branchName, createTimeline, readyBranches, seek, type Action, type Branch, type Prediction, type Stage} from '../select-lab/model';
import './lesson56.css';

const predictions: {value: Prediction; label: string}[] = [{value:'a',label:'只执行 A'}, {value:'b',label:'只执行 B'}, {value:'both',label:'一次执行 A 和 B'}, {value:'default',label:'执行 default'}, {value:'wait',label:'继续等待'}];

export default function Lesson56() {
  const [timeline,setTimeline] = useState(()=>createTimeline(2));
  const [reason,setReason] = useState('');
  const s=timeline.states[timeline.cursor], setup=s.phase==='setup', accepting=setup||s.phase==='waiting';
  const ready=readyBranches(s.board), revealed=s.phase==='selected'||s.phase==='done';
  const act=(action:Action)=>setTimeline(t=>applyAction(t,action));
  function reset(stage:Stage=s.stage){setTimeline(createTimeline(stage));setReason('');}
  const name=(id:Branch)=>s.board.cancellation ? id==='a'?'A · 请求结果':'B · 取消信号':id.toUpperCase();
  return <section className="channel-lesson lesson56" data-testid="lesson56-lab">
    <header className="cl-heading"><small>56 / 就绪集合 → 只选一个 → 保留其余</small><h3>两个 case 都能走，谁会执行？</h3><p>给通道放入消息，圈出所有可能结果，再逐步执行。交换代码位置，检验“写在前面就优先”的猜想。</p></header>
    <div className="cl-controls">
      <label>情境 <select aria-label="56情境" value={s.stage} onChange={e=>reset(Number(e.target.value) as Stage)}><option value={2}>两个消息通道</option><option value={5}>请求结果与取消竞争</option></select></label>
      <label><input type="checkbox" checked={s.board.withDefault} disabled={!setup} onChange={e=>act({type:'default',enabled:e.target.checked})}/> 加入 default</label>
      <button disabled={!setup} onClick={()=>act({type:'swap'})}>交换 case 位置</button>
      <button onClick={()=>reset()}>重置实验</button>
    </div>
    <div className="live-model" data-testid="live-model" data-state={JSON.stringify(s)}>
      <div className="cl-board">
        {(['a','b'] as const).map(id=><div className="cl-card" key={id} data-active={revealed&&s.choice===id}>
          <h4>{name(id)}</h4><strong>{id==='b'&&s.board.cancellation ? s.board.cancelled?'已关闭：取消持续就绪':'未取消：等待信号':s.board[id]?'● 有一条消息':'○ 空通道'}</strong>
          <p>{ready.includes(id)?'当前可接收':'当前不可接收'}{revealed&&s.choice===id?' · 本次选中':''}</p>
          <button disabled={!accepting||ready.includes(id)} onClick={()=>act({type:'supply',branch:id})}>{id==='b'&&s.board.cancellation?'发出取消':`放入 ${id.toUpperCase()} 消息`}</button>
        </div>)}
        <div className="cl-card"><h4>执行位置</h4><strong>{{setup:'还未进入 select',waiting:'阻塞在 select',ready:'选择已固定，尚未揭示',selected:'揭示所选分支，待演示接收',done:'本次 select 已结束'}[s.phase]}</strong><p>{s.source==='demo'?'本轮：另一合法路径演示（非随机）':'本轮：模型抽样；多就绪时等概率选择'}</p><p>已完成 {s.runs.filter(r=>r.source==='random').length} 次抽样 / {s.runs.filter(r=>r.source==='demo').length} 次路径演示</p></div>
      </div>
      <pre className="cl-code" aria-label="随条件联动的 select 代码"><code>{'select {\n'}{s.board.order.map(id=><span className={revealed&&s.choice===id?'active':''} key={id}>{`  case ${id==='a'?'v := <-a':s.board.cancellation?'<-ctx.Done()':'v := <-b'}: // ${name(id)}${revealed&&s.choice===id?' ← 本次选择':''}\n`}</span>)}{s.board.withDefault&&<span className={revealed&&s.choice==='default'?'active':''}>{'  default: // 所有通信均不能执行时\n'}</span>}{'} // 只走一个分支，然后离开'}</code></pre>
    </div>
    <fieldset className="cl-prediction" disabled={!setup}><legend>预测：当前条件下，哪些结果可能发生？（多选）</legend><div className="l56-options">{predictions.map(p=><label key={p.value}><input type="checkbox" checked={s.prediction.includes(p.value)} onChange={()=>act({type:'predict',value:p.value})}/>{s.board.cancellation&&p.value==='a'?'只处理请求结果':s.board.cancellation&&p.value==='b'?'只响应取消':p.label}</label>)}</div><label>我的依据<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="区分：可选的分支有哪些？一次究竟执行几个？"/></label></fieldset>
    <div className="cl-controls"><button disabled={!setup||!s.prediction.length} onClick={()=>act({type:'execute'})}>提交预测并进入 select</button><button disabled={s.phase!=='ready'&&s.phase!=='selected'} onClick={()=>act({type:'next'})}>{s.phase==='selected'?'演示接收并离开':'揭示本轮选择'}</button><button disabled={s.phase!=='done'&&s.phase!=='waiting'} onClick={()=>act({type:'retry'})}>恢复相同条件再试</button><button disabled={s.phase!=='done'||!s.snapshot||readyBranches(s.snapshot).length!==2} onClick={()=>act({type:'alternative'})}>演示另一合法路径</button></div>
    <div className="cl-feedback" aria-live="polite"><p><strong>{s.label}</strong></p>{s.feedback&&<p>{s.feedback}</p>}{s.phase==='waiting'&&<p>现在可点上方投递按钮。第一个到达的消息会唤醒本轮；后到事件不能改写已经固定的选择。</p>}{s.phase==='done'&&<p>检查上方通道：只有被选中的消息被取走；取消通道关闭后仍持续可接收。</p>}</div>
    <div className="cl-history"><div className="cl-controls"><button disabled={timeline.cursor===0} onClick={()=>setTimeline(t=>seek(t,t.cursor-1))}>回退一步</button><button disabled={timeline.cursor===timeline.states.length-1} onClick={()=>setTimeline(t=>seek(t,t.cursor+1))}>重放已记录一步</button><span>记录位置 {timeline.cursor} / {timeline.states.length-1}</span></div><p className="cl-note">回退后重放保留同一抽样结果；回退后采取新操作会创建新路径。想重新抽样，请用“恢复相同条件再试”。</p>{s.runs.length>0&&<ol>{s.runs.slice(-4).map((r,i)=><li key={i}>{r.source==='demo'?'合法路径演示':'随机轮次'}：{r.outcome==='default'?'default':branchName(r.snapshot,r.outcome)}；选择时就绪 {readyBranches(r.snapshot).map(id=>branchName(r.snapshot,id)).join('、')||'无'}</li>)}</ol>}</div>
    <p className="cl-note">模型边界：每个普通通道只保留一条缓冲消息；每次只运行一个 select。选择、揭示、接收拆成教学帧，期间冻结外部事件，不代表 Go 会开放这三个独立调度窗口。随机记录不证明严格公平或时限保证。这里的预测、提示与操作不计为独立掌握证据。</p>
  </section>;
}

function Example56(){
  const [cancelled,setCancelled]=useState(true),[result,setResult]=useState(true),[guess,setGuess]=useState(''),[checked,setChecked]=useState(false);
  const expected=cancelled&&result?'either':cancelled?'cancel':result?'result':'wait';
  return <><h4>付款结果和取消同时到达</h4><p>代码把取消写在第一行。改变事件，判断哪些业务分支有机会执行。</p><div className="cl-controls"><label><input type="checkbox" checked={cancelled} onChange={e=>{setCancelled(e.target.checked);setChecked(false);}}/>取消已发出</label><label><input type="checkbox" checked={result} onChange={e=>{setResult(e.target.checked);setChecked(false);}}/>付款结果已到达</label></div><pre className="cl-code">{'select {\n  case <-ctx.Done(): cancel()\n  case r := <-result: record(r)\n}'}</pre><label>预测 <select value={guess} onChange={e=>{setGuess(e.target.value);setChecked(false);}}><option value="">选择合法结果</option><option value="cancel">只可能取消</option><option value="result">只可能记录结果</option><option value="either">取消或记录均可能，但只走一个</option><option value="wait">等待事件</option></select></label><button disabled={!guess} onClick={()=>setChecked(true)}>验证业务路径</button><div className="cl-feedback" aria-live="polite">{checked?<><strong>{guess===expected?'符合当前就绪条件。':'再检查两个事件的状态。'}</strong><p>当前可能：{{either:'取消或记录结果',cancel:'取消',result:'记录结果',wait:'等待事件'}[expected]}。case 顺序不会赋予取消优先级。</p><p>必须禁止超时后落库时，需要在业务提交协议中检查截止状态并保证原子性；提前检查取消也无法消除后续竞争。</p></>:'先选择预测，再核对。'}</div></>;
}

function Diagram56(){
  const [a,setA]=useState(true),[b,setB]=useState(false),[useDefault,setDefault]=useState(false),[mark,setMark]=useState<string[]>([]),[check,setCheck]=useState(false);
  const actual=[...(a?['A']:[]),...(b?['B']:[])];if(!actual.length)actual.push(useDefault?'default':'等待');
  const change=(f:()=>void)=>{f();setCheck(false);setMark([]);};
  return <><h4>画出“就绪集合”的出口</h4><p>调整左侧条件，再点亮所有合法出口。箭头表示候选关系；一次只会经过一个出口。</p><div className="cl-controls"><label><input type="checkbox" checked={a} onChange={e=>change(()=>setA(e.target.checked))}/>A 有消息</label><label><input type="checkbox" checked={b} onChange={e=>change(()=>setB(e.target.checked))}/>B 有消息</label><label><input type="checkbox" checked={useDefault} onChange={e=>change(()=>setDefault(e.target.checked))}/>有 default</label></div><div className="cl-flow"><div className="cl-card">A：{a?'就绪':'空'}<br/>B：{b?'就绪':'空'}</div><span aria-hidden="true">→</span><div className="cl-card">圈出候选出口<br/>{['A','B','default','等待'].map(v=><button key={v} aria-pressed={mark.includes(v)} onClick={()=>{setMark(m=>m.includes(v)?m.filter(x=>x!==v):[...m,v]);setCheck(false);}}>{mark.includes(v)?'●':'○'} {v}</button>)}</div></div><button onClick={()=>setCheck(true)}>核对标注</button><p className="cl-feedback" aria-live="polite">{check?`${mark.length===actual.length&&actual.every(v=>mark.includes(v))?'出口标注正确':'请修正出口'}：合法出口为 ${actual.join(' 或 ')}。${a||b?'只要有通信就绪，default 就不是候选。':'没有通信就绪，有 default 才能立即离开。'}`:'图中的出口标记由你决定；核对后可改变一个条件再试。'}</p></>;
}

function Steps56(){
  const stages=['列出所有可立即完成的通信','从就绪通信中选择一个','只执行该分支并离开'];
  const [picked,setPicked]=useState<number[]>([]),[feedback,setFeedback]=useState('');
  function pick(n:number){if(picked.includes(n))return;const next=[...picked,n];setPicked(next);setFeedback(next.length===3?next.every((v,i)=>v===i)?'顺序正确。A、B 都就绪时，两者先共同进入候选集合，然后只选一个；代码第一行不会先抢走执行权。':'检查第一步：不能先按代码位置挑选，再去确认其他通信是否就绪。重排后再试。':'');}
  return <><h4>给 select 排一遍执行步骤</h4><p>已知 A、B 都有消息且没有 default。按执行顺序点击三个步骤。</p><div className="cl-controls">{[2,0,1].map(n=><button key={n} disabled={picked.includes(n)} onClick={()=>pick(n)}>{stages[n]}</button>)}</div><ol className="cl-steps">{picked.map(n=><li key={n}>{stages[n]}</li>)}</ol><button onClick={()=>{setPicked([]);setFeedback('');}}>重新排序</button><p className="cl-feedback" aria-live="polite">{feedback||`已放置 ${picked.length} / 3 步。`}</p><p className="cl-note">这是规则拆解，不把三个步骤当作可插入外部事件的真实调度窗口。无就绪通信时另走 default 或等待路径。</p></>;
}

function Try56(){
  const [a,setA]=useState(true),[b,setB]=useState(false),[order,setOrder]=useState(false),[attempt,setAttempt]=useState(false);
  return <><h4>构造“第一行一定优先”的反例</h4><p>目标：让两个 case 同时可执行，再展示排在第二行的合法结果。可调整消息和顺序。</p><div className="cl-controls"><label><input type="checkbox" checked={a} onChange={e=>{setA(e.target.checked);setAttempt(false);}}/>A 有消息</label><label><input type="checkbox" checked={b} onChange={e=>{setB(e.target.checked);setAttempt(false);}}/>B 有消息</label><button onClick={()=>{setOrder(!order);setAttempt(false);}}>交换顺序</button></div><pre className="cl-code">{`select {\n  case <-${order?'b':'a'}: // 第一行\n  case <-${order?'a':'b'}: // 第二行\n}`}</pre><button onClick={()=>setAttempt(true)}>验证并演示第二行路径</button><div className="cl-board" aria-label="反例执行后的消息位置"><div className="cl-card">A 缓冲<strong>{a && !(attempt && a && b && order) ? '[A]' : '[]'}</strong></div><div className="cl-card">B 缓冲<strong>{b && !(attempt && a && b && !order) ? '[B]' : '[]'}</strong></div><div className="cl-card">本次接收<strong>{attempt && a && b ? order ? 'A' : 'B' : '尚未执行'}</strong></div></div><div className="cl-feedback" aria-live="polite">{attempt?a&&b?<><strong>反例成立：选择第二行 {order?'A':'B'} 合法。</strong><p>只取走 {order?'A':'B'}，第一行 {order?'B':'A'} 的消息保留。交换后仍成立。</p><p>这是确定的合法路径演示，不是随机抽样记录。</p></>:<p>还不能检验“同时就绪时第一行优先”：请给两个通道都放入消息。只有一个就绪时，可选集合只有一个。</p>:'先布置条件，再验证。'}</div></>;
}

export function Help56({mode}:{mode:string}){
  return <section className="cl-help lesson56-help" data-testid="lesson56-help">{mode==='example'?<Example56/>:mode==='diagram'?<Diagram56/>:mode==='steps'?<Steps56/>:<Try56/>}<p className="cl-note">帮助中的练习用于理解与修正；独立掌握请到未揭示答案的测验中验证。</p></section>;
}

