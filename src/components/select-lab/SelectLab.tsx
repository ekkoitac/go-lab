import {useState,type CSSProperties} from 'react';
import {ArrowRight,ChevronLeft,RotateCcw} from 'lucide-react';
import {applyAction,branchName,createTimeline,readyBranches,seek,type Action,type Board,type Branch,type Prediction,type SelectState,type Stage} from './model';
import './select-lab.css';

const stages: {id: Stage; title: string; task: string; hint: string}[] = [
  {id: 1, title: '认识就绪', task: '先只放入 A，再执行 select。追踪这张消息最后去了哪里。', hint: '就绪 = 现在执行这个通信操作，不需要等待。先观察槽位和 case 的状态，再单步执行。'},
  {id: 2, title: '两个都能执行', task: '往 A、B 各放入一张消息，预测所有可能的结果，再执行一次。', hint: '观察结束后：两个分支是否都执行了？没被选中的消息还在哪里？'},
  {id: 3, title: '交换代码顺序', task: '让 A、B 都就绪。交换 case 的位置，再比较相同条件下的选择。', hint: '通道的位置和颜色不会交换。可反复随机执行，也可查看明确标注的另一种合法路径。'},
  {id: 4, title: '改变到达顺序', task: '先做「放入 A → 执行」，再清空通道做「放入 A → 放入 B → 执行」。', hint: '比较每轮的选择前快照：决定选择范围的是当时谁已就绪，而不是跨通道谁先到达。'},
  {id: 5, title: '结果与取消', task: '让结果到达，再发出取消。取消 case 已放在前面，这次一定会取消吗？', hint: '取消来自信号通道的关闭。它会持续生效，不是一张取走就消失的普通消息。'},
];

function describe(board: Board) {
  return `${board.cancellation ? '结果' : 'A'}：${board.a ? '有消息' : '空'}；${board.cancellation ? `取消：${board.cancelled ? '已发出' : '未发出'}` : `B：${board.b ? '有消息' : '空'}`}；${board.withDefault ? '有' : '无'} default`;
}

function status(s: SelectState, id: Branch) {
  const ready = readyBranches(s.board).includes(id);
  if (s.phase === 'done' && s.choice === id) return s.board.cancellation && id === 'b' ? '已响应取消 · 信号仍然就绪' : '已接收 · 槽位变空';
  if (s.phase === 'selected' && s.choice === id) return '本次选中 · 即将接收';
  if ((s.phase === 'selected' || s.phase === 'done') && ready) return '就绪 · 本次未选中';
  return ready ? '可以接收 · 已就绪' : s.board.cancellation && id === 'b' ? '尚未取消 · 不能接收' : '暂无消息 · 不能接收';
}

function SelectCode({state: s}: {state: SelectState}) {
  const chosen = s.phase === 'selected' || s.phase === 'done';
  return <div className="select-code" aria-label="与实验同步的 Go 代码">
    <div className="select-code-heading"><strong>代码执行位置</strong><span>{s.phase === 'done' ? '已离开 select' : s.phase === 'setup' ? '尚未进入 select' : s.phase === 'waiting' ? '停在 select 等待' : '正在 select 中'}</span></div>
    <pre><code><span className={['waiting','ready'].includes(s.phase) ? 'select-code-line active' : 'select-code-line'}>select {'{'}</span>
      {s.board.order.map(id => <span key={id} data-testid={`case-${id}`} className={`select-code-case ${chosen && s.choice === id ? 'chosen' : ''}`}>
        <span className="select-code-line">{s.board.cancellation && id === 'b' ? 'case <-ctx.Done():' : `case v := <-${s.board.cancellation ? 'result' : id}:`}</span>
        <span className="select-code-line">{'    '}{s.board.cancellation && id === 'b' ? 'show("已取消")' : 'show(v)'}</span>
        <span className="select-code-status">{status(s,id)}</span>
      </span>)}
      {s.board.withDefault && <span className={`select-code-case ${chosen && s.choice === 'default' ? 'chosen' : ''}`}><span className="select-code-line">default:</span><span className="select-code-line">{'    '}show("暂无可执行通信")</span></span>}
      <span className="select-code-line">{'}'}</span><span className={`select-code-line ${s.phase === 'done' ? 'active' : ''}`}>afterSelect()</span>
    </code></pre>
    <p>show / afterSelect 是教学占位函数。{s.board.cancellation ? 'result 容量为 1；ctx.Done() 在取消时关闭。' : 'a、b 都是容量为 1 的独立缓冲通道。'}</p>
  </div>;
}

function Transfer({state: s}: {state: SelectState}) {
  const visible = (s.phase === 'selected' || s.phase === 'done') && (s.choice === 'a' || s.choice === 'b');
  const id = s.choice === 'b' ? 'b' : 'a';
  return <svg className="select-transfer" viewBox="0 0 400 92" role="img" aria-label="消息从选中的通道进入接收方">
    <path d="M100 8 C100 48 200 42 200 80" className={visible && id === 'a' ? 'selected-path' : ''}/>
    <path d="M300 8 C300 48 200 42 200 80" className={visible && id === 'b' ? 'selected-path' : ''}/>
    <path d="M194 73 L200 81 L206 73"/>
    {visible && <g key={`${s.phase}-${id}`} className={`select-moving-token ${id} ${s.phase === 'done' ? 'arrived' : ''}`} style={{'--origin-x': `${id === 'a' ? 100 : 300}px`} as CSSProperties}>
      <rect x="-25" y="-13" width="50" height="26" rx="8"/>
      <text textAnchor="middle" dy="5">{s.board.cancellation ? id === 'a' ? '结果' : '通知' : id.toUpperCase()}</text>
    </g>}
  </svg>;
}

export default function SelectLab() {
  const [timeline,setTimeline] = useState(()=>createTimeline());
  const [supplement,setSupplement] = useState(false);
  const s = timeline.states[timeline.cursor], stage = stages[s.stage - 1];
  const setup = s.phase === 'setup', canSupply = setup || s.phase === 'waiting';
  const revealing = s.phase === 'ready' || s.phase === 'selected';
  const ready = readyBranches(s.board);
  const randomRuns = s.runs.filter(run=>run.source === 'random');
  function act(action: Action) {
    // Sample outside the React updater, so Strict Mode re-evaluation is deterministic.
    const sample = Math.random();
    setTimeline(previous=>applyAction(previous,action,()=>sample));
  }
  function changeStage(id: Stage) {if(id === s.stage)return;setTimeline(createTimeline(id));setSupplement(false);}
  const options: {id: Prediction; text: string}[] = [
    {id:'a',text:s.board.cancellation?'处理请求结果':'收到 A'},
    {id:'b',text:s.board.cancellation?'响应取消':'收到 B'},
    {id:'both',text:'两个分支都执行'}, {id:'wait',text:'继续等待'},
    ...(s.board.withDefault ? [{id:'default' as const,text:'执行 default'}] : []),
  ];
  const snapshot = s.snapshot ?? s.runStart;
  return <section className="experiment-panel select-lab" data-testid="select-lab">
    <header className="select-heading"><span>SELECT · 由你布置条件</span><h3>谁能执行，谁被选中？</h3><p>改变消息、代码顺序和执行时机，亲手验证 select 的选择规则。</p></header>
    <nav className="select-stages" aria-label="select 实验阶段">{stages.map(item=><button key={item.id} className={s.stage === item.id ? 'selected' : 'ghost'} aria-current={s.stage === item.id ? 'step' : undefined} onClick={()=>changeStage(item.id)}><span>{item.id}</span>{item.title}</button>)}</nav>
    <div className="select-task"><strong>第 {s.stage} 步 · {stage.title}</strong><p>{stage.task}</p><small>{stage.hint}</small></div>
    <div className="select-board" data-testid="live-model" data-state={JSON.stringify(s)}>
      <div className="select-channels">{(['a','b'] as Branch[]).map(id=>{
        const isSignal = s.board.cancellation && id === 'b';
        const occupied = id === 'a' ? s.board.a : s.board.b;
        return <article key={id} data-testid={`channel-${id}`} className={`select-channel branch-${id} ${ready.includes(id) ? 'ready' : ''}`}>
          <h4>{s.board.cancellation ? isSignal ? '取消信号' : '请求结果' : `通道 ${id.toUpperCase()}`}</h4>
          <small>{isSignal ? '关闭后持续就绪' : '容量 1 · 一个消息槽位'}</small>
          <div className={`select-slot ${isSignal ? 'signal' : ''}`}>
            {isSignal ? <span className={s.board.cancelled ? 'select-signal on' : 'select-signal'}>{s.board.cancelled ? '已取消' : '未取消'}</span> : occupied ? <span className={`select-message ${id}`}>{s.board.cancellation ? '结果' : id.toUpperCase()}</span> : <span className="select-empty">空</span>}
          </div>
          <p className="select-channel-status">{status(s,id)}</p>
          <button disabled={!canSupply || ready.includes(id)} onClick={()=>act({type:'supply',branch:id})}>{isSignal ? '发出取消' : s.board.cancellation ? '放入请求结果' : `放入 ${id.toUpperCase()} 消息`}</button>
        </article>;
      })}</div>
      <Transfer state={s}/>
      <div className={`select-receiver ${s.phase === 'done' ? 'done' : ''}`}>
        <small>接收方 goroutine</small><strong>{s.phase === 'setup' ? '尚未执行 select' : s.phase === 'waiting' ? '等待中 · 还没有可以执行的通信' : s.phase === 'ready' ? '已确定就绪范围 · 尚未揭示选择' : s.phase === 'selected' ? s.choice === 'default' ? '本次执行 default' : `本次选中：${branchName(s.board,s.choice!)}` : s.choice === 'default' ? '执行了 default · 已离开 select' : s.choice === 'b' && s.board.cancellation ? '已响应取消 · 已离开 select' : `v = ${s.board.cancellation ? '请求结果' : s.choice?.toUpperCase()} · 已离开 select`}</strong>
        <span>{s.phase === 'done' ? '本次执行已结束。剩余消息不会被自动接收。' : s.phase === 'waiting' ? '现在放入消息或发出取消，会唤醒这次 select。' : '每次 select 只执行一个分支。'}</span>
      </div>
    </div>
    {s.stage > 1 && <fieldset className="select-prediction"><legend>执行前预测：选出所有可能的结果</legend><p>判断“可能发生哪些”，不用猜这一轮会抽中谁。可先预测，也可先观察。</p><div>{options.map(option=><label key={option.id}><input type="checkbox" checked={s.prediction.includes(option.id)} disabled={!setup} onChange={()=>act({type:'predict',value:option.id})}/>{option.text}</label>)}</div><button className="ghost" disabled={!setup} onClick={()=>act({type:'check'})}>检查预测</button>{s.feedback && <p className="select-prediction-feedback" role="status">{s.feedback}</p>}</fieldset>}
    <div className="select-observation-steps" aria-label="本轮观察进度">{['谁能执行','本次选中','执行结束'].map((label,i)=><span key={label} aria-current={s.phase === ['ready','selected','done'][i] ? 'step' : undefined}>{i+1}. {label}</span>)}</div>
    <div className="select-controls">
      <button disabled={!setup} onClick={()=>act({type:'execute'})}>执行 select<ArrowRight size={15}/></button>
      <button className="secondary" disabled={!revealing} onClick={()=>act({type:'next'})}>{s.phase === 'selected' ? s.choice === 'default' ? '执行 default 并离开' : s.choice === 'b' && s.board.cancellation ? '响应取消并离开' : '完成接收并离开' : '揭示本次选择'}</button>
      {s.stage >= 3 && <button className="ghost" disabled={!setup} onClick={()=>act({type:'swap'})}>交换 case 位置</button>}
    </div>
    <div className="select-controls select-retry">
      <button className="secondary" disabled={s.phase !== 'done' && s.phase !== 'waiting'} onClick={()=>act({type:'retry'})}>恢复相同条件再试</button>
      {s.stage > 1 && <button className="ghost" disabled={s.phase !== 'done' || !s.snapshot || readyBranches(s.snapshot).length !== 2} onClick={()=>act({type:'alternative'})}>演示另一种合法结果</button>}
      <button className="ghost" disabled={revealing} onClick={()=>act({type:'clear'})}>清空通道，安排新条件</button>
    </div>
    <div className={`select-feedback ${s.source === 'demo' ? 'demo' : ''}`} role="status"><strong>{s.source === 'demo' ? '合法路径演示 · 非随机运行' : '当前观察'}</strong><p>{s.label}</p>{revealing && <small>本次选择已经固定。条件修改已锁定；继续分步观察不会重新选择。</small>}</div>
    <SelectCode state={s}/>
    {snapshot && <div className="select-snapshot"><strong>{s.snapshot ? '选择前快照' : '进入 select 时的快照'}</strong><p>{describe(snapshot)}</p><small>代码从上到下：{snapshot.order.map(id=>branchName(snapshot,id)).join(' → ')}。{s.runStart && s.snapshot && describe(s.runStart)!==describe(s.snapshot) ? '进入时没有就绪通信；等待期间的新事件改变了选择条件。' : '这份快照用于恢复相同条件，不受接收后的槽位变化影响。'}</small></div>}
    {!!s.runs.length && <details className="select-records" open><summary>已完成的对照记录 · 随机执行 {randomRuns.length} 次 · 合法路径演示 {s.runs.length-randomRuns.length} 次</summary><p>每条记录都包含当时的条件；样本次数不保证各分支次数相等，也不保证轮流执行。</p><ol>{s.runs.map((run,i)=><li key={i}><strong>{i+1}. {run.source === 'demo' ? '演示' : '随机执行'} → {run.outcome === 'default' ? 'default' : branchName(run.snapshot,run.outcome)}</strong><span>{describe(run.snapshot)}；代码顺序：{run.snapshot.order.map(id=>branchName(run.snapshot,id)).join(' → ')}</span></li>)}</ol></details>}
    <details className="select-supplement" open={supplement} onToggle={event=>setSupplement(event.currentTarget.open)}><summary>补充实验：没有分支就绪时，default 做什么？{s.board.withDefault ? '（已开启）' : ''}</summary><p>清空通道后执行，对比有无 default。再放入消息，观察 default 是否还会被选中。</p><label><input type="checkbox" checked={s.board.withDefault} disabled={!setup} onChange={event=>act({type:'default',enabled:event.target.checked})}/>加入 default 分支</label><small>修改需要处于执行前；等待或结束后，可清空通道开始新条件。</small></details>
    <div className="select-history"><h4>操作时间线 <small>{timeline.cursor} / {timeline.states.length-1}</small></h4><div className="select-controls"><button className="ghost" disabled={!timeline.cursor} onClick={()=>setTimeline(t=>seek(t,t.cursor-1))}><ChevronLeft size={15}/>回退一步</button><button className="ghost" disabled={timeline.cursor===timeline.states.length-1} onClick={()=>setTimeline(t=>seek(t,t.cursor+1))}>前进一步<ArrowRight size={15}/></button><button className="ghost" onClick={()=>setTimeline(createTimeline(s.stage))}><RotateCcw size={15}/>重置本阶段</button></div><input aria-label="操作时间线" type="range" min="0" max={timeline.states.length-1} value={timeline.cursor} onChange={event=>setTimeline(t=>seek(t,+event.target.value))}/><p>回看保留当时的选择。回退后做新操作，会替换后面的路径。切换阶段会开始新实验。</p><ol>{timeline.states.slice(0,timeline.cursor+1).map((entry,i)=><li key={i}><button className="ghost" aria-current={i === timeline.cursor ? 'step' : undefined} onClick={()=>setTimeline(t=>seek(t,i))}>{i}. {entry.label}</button></li>)}</ol></div>
    {s.stage < 5 && <button className="select-next-stage" onClick={()=>changeStage((s.stage+1) as Stage)}>继续：{stages[s.stage].title}<ArrowRight size={15}/></button>}
    <p className="select-boundary">本地教学模拟：分步画面用于解释规则，不代表 Go 运行时内部的可暂停阶段。真实 Go 对就绪通信作均匀伪随机选择；这里的随机运行由浏览器模型生成，可在右侧编辑器验证 Go 代码。实验不会修改编辑器、正式测验或学习成绩，离开后不保存实验状态。</p>
  </section>;
}
