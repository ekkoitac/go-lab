import {useState} from 'react';
import {challenge,initialState,interrupted,nextLabel,result,run,transition,type Action,type State,type Strategy} from './model';
import './style.css';

const names:Record<Strategy,string>={fields:'分开原子读写',mutex:'共同 Mutex',snapshot:'不可变快照发布'};
const outcomes={pending:'尚未读完',old:'一致旧快照',new:'一致新快照',mixed:'混合值：不属于任一配置'};
const strategies:Strategy[]=['fields','mutex','snapshot'];
const pair=(p:{version?:number;limit?:number})=>`${p.version??'待读'} / ${p.limit??'待读'}`;
function StrategySelect({value,onChange}:{value:Strategy;onChange:(s:Strategy)=>void}){
  return <label>同步方案<select value={value} onChange={e=>onChange(e.target.value as Strategy)}>{strategies.map(x=><option key={x} value={x}>{names[x]}</option>)}</select></label>;
}
function Board({state:s}:{state:State}){
  return <div className="sync50-board" data-testid="live-model" data-state={JSON.stringify(s)}>
    <div className="sync50-card"><span>公开配置 {s.strategy==='snapshot'?`· 指针 → ${s.published}`:''}</span><strong>{pair(s.shared)}</strong><small>目标：{pair(s.target)}{s.strategy==='mutex'?` · 锁：${s.owner==='writer'?'写者持有':s.owner==='reader'?'读者持有':'空闲'}`:''}</small></div>
    <div className="sync50-card"><span>读者局部快照</span><strong>{pair(s.observed)}</strong><small className={result(s)==='mixed'?'sync50-warning':''}>{outcomes[result(s)]}</small></div>
    {s.strategy==='snapshot'&&<><div className="sync50-card"><span>未发布草稿</span><strong>{pair(s.draft)}</strong><small>构建阶段只有写者可见</small></div><div className="sync50-card"><span>读者保留的对象引用</span><strong>{s.captured??'尚未 Load'}</strong><small>{s.captured?`所指对象：${pair(s.objects[s.captured])}`:'一次 Load，两个字段取自同一对象'}</small></div></>}
  </div>;
}
function useTimeline(strategy:Strategy,limit:number){
  const [history,setHistory]=useState<State[]>([initialState(strategy,limit)]);
  return {state:history[history.length-1],history,
    act:(action:Action)=>setHistory(h=>[...h,transition(h[h.length-1],action)]),
    back:()=>setHistory(h=>h.length>1?h.slice(0,-1):h),
    reset:(s=strategy,l=limit)=>setHistory([initialState(s,l)])};
}
export default function Lab(){
  const [strategy,setStrategy]=useState<Strategy>('fields');
  const [limit,setLimit]=useState(20);
  const t=useTimeline(strategy,limit);
  const [prediction,setPrediction]=useState('');
  const [locked,setLocked]=useState(false);
  const [reason,setReason]=useState('');
  const reset=(s=strategy,l=limit)=>{t.reset(s,l);setLocked(false);setPrediction('');setReason('');};
  return <section className="sync50" data-testid="lesson50-lab" aria-label="原子操作与整体一致性实验">
    <h3>自己安排读写，找出拼接快照</h3>
    <p>配置只能是 <b>1 / 10</b> 或 <b>2 / {limit}</b>。让写者更新到一半，再调度读者；切换方案验证保护边界。</p>
    <div className="sync50-controls"><StrategySelect value={strategy} onChange={s=>{setStrategy(s);reset(s);}}/><label>新阈值<select value={limit} onChange={e=>{const l=Number(e.target.value);setLimit(l);reset(strategy,l);}}>{[20,30,50].map(n=><option key={n}>{n}</option>)}</select></label></div>
    <div className="sync50-prediction"><label>先预测你将构造的读者快照<select value={prediction} disabled={locked} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="old">一致旧值</option><option value="new">一致新值</option><option value="mixed">混合值</option></select></label><label>预测依据<input value={reason} disabled={locked} onChange={e=>setReason(e.target.value)} placeholder="计划在什么时候调度读者？"/></label><button disabled={!prediction||!reason.trim()||locked} onClick={()=>setLocked(true)}>{locked?'预测已记录':'记录预测，开始调度'}</button></div>
    <Board state={t.state}/>
    <div className="sync50-controls"><button disabled={!locked||t.state.writer===4} onClick={()=>t.act('writer')}>{nextLabel(t.state,'writer')}</button><button disabled={!locked||t.state.reader===4} onClick={()=>t.act('reader')}>{nextLabel(t.state,'reader')}</button><button disabled={t.history.length===1} onClick={t.back}>回退一步</button><button onClick={()=>reset()}>重置实验</button></div>
    {strategy==='snapshot'&&<button className="sync50-danger" disabled={!locked||t.state.writer!==4||t.state.unsafe} onClick={()=>t.act('mutate')}>反例：发布后违规修改同一对象</button>}
    <p className="sync50-feedback" role="status">{t.state.message}</p>
    {locked&&result(t.state)!=='pending'&&<p className="sync50-evidence">预测{prediction===result(t.state)?'与本次结果一致':'需要修正'}：实际读到 {pair(t.state.observed)}。你的依据：“{reason}”。{result(t.state)==='mixed'?'分别安全的访问仍可跨越更新边界。':'本次读到一致值；这条轨迹不能证明所有调度都安全。'}{t.state.unsafe?' 此次还破坏了不可变约束，不能作为安全发布方案。':''}</p>}
    <details><summary>执行证据 · {t.state.events.length} 步</summary><ol>{t.state.events.map((e,i)=><li key={i}>{e}</li>)}</ol></details>
    <p className="sync50-boundary">模型按一次操作一步展示可行交错，不模拟 CPU 指令耗时。分开的 atomic 操作可以没有 data race，却产生业务混合值；读写双方都必须遵守共同锁，或一次加载后只读取真正不可变的对象。</p>
  </section>;
}

const compareActions:Action[]=[...interrupted,'reader','reader','reader','reader'];
function Example(){
  const [timing,setTiming]=useState('middle');
  const [shown,setShown]=useState(false);
  const actions:Action[]=timing==='before'?['reader','reader','reader','reader','writer','writer','writer','writer']:timing==='after'?['writer','writer','writer','writer','reader','reader','reader','reader']:compareActions;
  return <><h3>同一份配置，三种保护范围</h3><p>控制变量：旧配置 1 / 10，新配置 2 / 20。改变读者开始的时机，对照同一调度下的结果。</p><label>读者开始时机<select value={timing} onChange={e=>{setTiming(e.target.value);setShown(false);}}><option value="before">写者开始之前</option><option value="middle">写者只写了 version 之后</option><option value="after">写者全部完成之后</option></select></label><button onClick={()=>setShown(true)}>运行同条件对照</button>{shown&&<div className="sync50-compare">{strategies.map(s=>{const state=run(s,actions);return <article key={s}><h4>{names[s]}</h4><strong>{pair(state.observed)}</strong><p>{outcomes[result(state)]}</p><p>{s==='fields'?'两个 Load 分别取当时字段值。':s==='mutex'?'读者若被阻塞，等写者释放共同锁后重试。':'读者只 Load 一次；拿到旧对象就继续保留旧快照。'}</p><details><summary>查看该方案调度证据</summary><ol>{state.events.map((e,i)=><li key={i}>{e}</li>)}</ol></details></article>;})}</div>}</>;
}
function Diagram(){
  const [strategy,setStrategy]=useState<Strategy>('fields');
  const [published,setPublished]=useState(false);
  return <><h3>追踪读者到底从哪里取两个字段</h3><StrategySelect value={strategy} onChange={s=>{setStrategy(s);setPublished(false);}}/><div className="sync50-flow" aria-label="字段与同步边界关系图">
    {strategy==='fields'?<><div className="sync50-node">写者</div><div className="sync50-branches"><div>Store version ↓<b>version = 2</b>↓ Load version</div><div>Store limit ↓<b>limit = 10</b>↓ Load limit</div></div><div className="sync50-node">读者拼接 → 2 / 10</div><p>两条边分别有原子保证，两条边之间没有共同事务边界。</p></>:strategy==='mutex'?<><div className="sync50-node">写者：Lock → 写两个字段 → Unlock</div><div className="sync50-boundary-box">共同 Mutex · 整体写 / 整体读不能重叠</div><div className="sync50-arrow">释放后，读者才可获取 ↓</div><div className="sync50-node">读者：Lock → 复制两个字段 → Unlock</div></>:<><div className="sync50-node">写者私有对象 B：2 / 20</div><div className="sync50-arrow">{published?'Store 已完成 ↓':'尚未 Store · 不可见'}</div><div className="sync50-node">公开原子指针 → {published?'B：2 / 20':'A：1 / 10'}</div><div className="sync50-branches"><div>发布前读者已 Load<b>保留 A → 1 / 10</b></div><div>现在的新读者 Load<b>取得 {published?'B → 2 / 20':'A → 1 / 10'}</b></div></div><button onClick={()=>setPublished(p=>!p)}>{published?'回到发布前':'原子发布完整 B'}</button><p>箭头表示对象引用。发布只切换公开指针，不改写 A，也不允许继续修改已发布的 B。</p></>}
  </div></>;
}
const guided:Action[]=['writer','writer','reader','writer','writer','reader','reader','reader','reader'];
function Steps(){
  const [strategy,setStrategy]=useState<Strategy>('mutex');
  const [step,setStep]=useState(0);
  const state=run(strategy,guided.slice(0,step));
  return <><h3>拆成步骤：更新到一半，读者能否进入？</h3><StrategySelect value={strategy} onChange={s=>{setStrategy(s);setStep(0);}}/><p>沿相同的调度顺序逐步执行，并观察锁等待或保留旧引用如何改变结果。</p><Board state={state}/><p className="sync50-feedback" role="status">{state.message}</p><div className="sync50-controls"><button disabled={step===0} onClick={()=>setStep(n=>n-1)}>上一步</button><button disabled={step===guided.length} onClick={()=>setStep(n=>n+1)}>{step<guided.length?`下一步：${nextLabel(state,guided[step] as 'writer'|'reader')}`:'步骤完成'}</button><button onClick={()=>setStep(0)}>重新拆解</button></div><progress max={guided.length} value={step}/><p>第 {step} / {guided.length} 步 · {outcomes[result(state)]}</p></>;
}
function Try(){
  const [mutate,setMutate]=useState(true);
  const [answer,setAnswer]=useState('');
  const [reason,setReason]=useState('');
  const [evidence,setEvidence]=useState<State|null>(null);
  const clear=()=>{setEvidence(null);setAnswer('');setReason('');};
  return <><h3>换一个条件：原子发布之后还能修改吗？</h3><p>新配置改为 2 / 30。先完整发布 B，读者 Load B 并读取 version。随后写者执行下列动作，最后读者读取 limit。</p><label>写者后续动作<select value={mutate?'mutate':'keep'} onChange={e=>{setMutate(e.target.value==='mutate');clear();}}><option value="mutate">把已发布 B.limit 改为 40</option><option value="keep">保持 B 不变</option></select></label><label>预测读者得到的值<select value={answer} onChange={e=>{setAnswer(e.target.value);setEvidence(null);}}><option value="">请选择</option><option value="new">2 / 30</option><option value="mixed">2 / 40</option><option value="old">1 / 10</option></select></label><label>解释：原子发布保护了哪一步？<textarea value={reason} onChange={e=>{setReason(e.target.value);setEvidence(null);}}/></label><button disabled={!answer||!reason.trim()} onClick={()=>setEvidence(challenge('snapshot',mutate))}>提交判断并查看证据</button>{evidence&&<div className="sync50-evidence" role="status"><b>{answer===result(evidence)?'本次预测一致':'请修正预测'}：实际为 {pair(evidence.observed)}</b><p>{mutate?'读者持有 B 的引用，写者仍修改 B；指针的原子 Load / Store 不会冻结对象。这里按顺序展示引用变化，真实并发无同步访问可能产生数据竞争。':'B 保持不可变，因此读者读取的两个字段一直属于同一配置。'}</p><ol>{evidence.events.map((e,i)=><li key={i}>{e}</li>)}</ol><p>这是带证据反馈的迁移练习，不计作独立掌握。</p></div>}</>;
}
export function Help({mode}:{mode:string}){
  return <section className="sync50 sync50-help" data-testid="lesson50-help" data-mode={mode}>{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}</section>;
}

