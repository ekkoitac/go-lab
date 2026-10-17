import {useState} from 'react';
import {apply,initial,next,run,scenarios,labels,stale,type State,type Guard,type Scenario,type Event} from './model';
import './style.css';
const version=(n:number|null)=>n===null?'空 / 回源':'v'+n;
const guards:Record<Guard,string>={none:'无版本检查',present:'仅比较现有缓存版本',floor:'失效时保留版本门槛'};
function Board({s,selected}:{s:State;selected?:string}) {
 const event=scenarios[s.config.scenario].events[s.step-1];
 return <div data-testid="live-model" data-state={JSON.stringify(s)}>
  <div className="cm142-board">
   <article className={selected==='db'||event==='commit'?'cm142-active':''}><small>数据库 · 权威</small><strong>{version(s.db)}</strong><span>{s.db===s.config.base?'旧商品名':'新商品名'}</span></article>
   <div className="cm142-link" aria-hidden="true">→ 快照 →</div>
   <article className={selected==='reader'||event==='read'?'cm142-active':''}><small>在途读者</small><strong>{s.reader===null?'尚未读取':version(s.reader)}</strong><span>读到的值不会跟随提交更新</span></article>
   <div className="cm142-link" aria-hidden="true">→ 回填 →</div>
   <article className={(stale(s)?'cm142-stale ':'')+(selected==='cache'||event==='fill'?'cm142-active':'')}><small>缓存 · 副本</small><strong>{version(s.cache)}</strong><span>{stale(s)?'陈旧：比数据库版本低':s.cache===null?'下一次读需回源':'与数据库同版本'}</span></article>
  </div>
  <div className="cm142-metrics"><span>保留门槛：{s.config.guard==='floor'?version(s.floor):'未启用'}</span><span>拒绝回填：{s.rejected} 次</span><span>删除重试：{s.retry?'待处理':'无'}</span><span>缓存剩余 TTL：{s.expires===null?'—':s.expires-s.time} 格</span></div>
 </div>
}
function GuardSelect({value,onChange}:{value:Guard;onChange:(v:Guard)=>void}) {return <label>回填校验<select value={value} onChange={e=>onChange(e.target.value as Guard)}>{Object.entries(guards).map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label>}
function Boundary(){return <p className="cm142-note">模型边界：每次操作是一个离散事件，TTL 只由“推进到过期”推进，不代表真实耗时。保留门槛假设失效操作原子地记录已提交版本，且门槛存活覆盖所有在途旧读；仅比较现存缓存，在缓存为空时无法知道最新版本。门槛不是 Redis 自动跟踪数据库的能力；它不保护外部副作用。此模型不证明跨系统强一致，也不模拟实际 Redis 协议。</p>}
export default function Lab(){
 const [history,setHistory]=useState<State[]>([initial()]);
 const s=history.at(-1)!;const events=scenarios[s.config.scenario].events;const done=s.step>=events.length;const outcome=history.find(item=>item.step===events.length);
 const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [submitted,setSubmitted]=useState<{answer:string;reason:string}|null>(null);
 function configure(p:Partial<State['config']>={}){setHistory([initial({...s.config,...p})]);setPrediction('');setReason('');setSubmitted(null)}
 function step(){if(!submitted){if(!prediction||!reason.trim())return;setSubmitted({answer:prediction,reason})}setHistory([...history,next(s)])}
 return <section className="cm142" data-testid="cache-message-lab-142">
  <h3>把读请求插进写入间隙</h3><p>逐步调度写者与读者，追踪“旧值从哪里来，又在何时进入缓存”。相同事件可以比较不同回填规则。</p>
  <div className="cm142-controls"><label>并发场景<select value={s.config.scenario} onChange={e=>configure({scenario:e.target.value as Scenario})}>{Object.entries(scenarios).map(([v,item])=><option key={v} value={v}>{item.title}</option>)}</select></label><GuardSelect value={s.config.guard} onChange={guard=>configure({guard})}/><label>回填后的 TTL（抽象时间格）<input type="range" min="1" max="9" value={s.config.ttl} onChange={e=>configure({ttl:Number(e.target.value)})}/><output>{s.config.ttl} 格</output></label></div>
  <p className="cm142-note">{scenarios[s.config.scenario].hint} 更改条件会开启新一轮。</p>
  <Board s={s}/>
  <ol className="cm142-timeline" aria-label="计划执行的事件">{events.map((event,i)=><li key={i} className={i<s.step?'cm142-past':i===s.step?'cm142-current':''}><small>{i+1} · {event==='read'||event==='fill'||event==='fresh'?'读者':'写者'}</small>{labels[event]}{i===s.step&&<b>下一步</b>}</li>)}</ol>
  {!submitted&&<fieldset><legend>运行前，预测整条时序结束时的缓存</legend><label>我的预测<select value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="old">旧版本 v1</option><option value="new">新版本 v2</option><option value="empty">空缓存</option></select></label><label>预测理由<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪一次读取得到什么版本？回填时缓存或门槛是什么？"/></label></fieldset>}
  <div className="cm142-actions"><button data-cm-action="back" disabled={history.length<2} onClick={()=>{setHistory(history.slice(0,-1));if(history.length===2)setSubmitted(null)}}>回退一步</button><button data-cm-action="step" disabled={done||(!submitted&&(!prediction||!reason.trim()))} onClick={step}>{done?'时序执行完毕':labels[events[s.step]]}</button><button data-cm-action="reset" onClick={()=>configure()}>重置</button></div>
  <p className="cm142-feedback" role="status">{s.log.at(-1)}</p>
  {done&&submitted&&outcome&&<div className="cm142-result"><strong>{submitted.answer===(outcome.cache===null?'empty':outcome.cache===outcome.db?'new':'old')?'预测与结果一致':'预测需要修正'}：计划时序结束时缓存 {version(outcome.cache)}</strong><p>你的理由：{submitted.reason}</p><p>{stale(outcome)?'旧快照在数据库提交后进入缓存。TTL 从回填开始计时，不能把数据库提交时间当作旧值消失时间。':outcome.cache===null?'回填被拦截或缓存已过期，下一次请求仍需要读取数据库。':'当前缓存已经更新；请回退检查删除失败时仍然可见的旧版本。'}</p><div className="cm142-actions"><button disabled={s.cache===null} onClick={()=>setHistory([...history,apply(s,'wait')])}>推进到缓存过期</button><button onClick={()=>setHistory([...history,apply(s,'fresh')])}>新读者回源并回填</button></div></div>}
  <details><summary>查看每一步的证据</summary><ol>{s.log.map((line,i)=><li key={i}>{line}</li>)}</ol></details>
  <Boundary/><p className="cm142-note">这里只保存本轮探索和预测，不计入正式成绩。</p>
 </section>
}
function Example(){
 const [timing,setTiming]=useState<'before'|'after'>('before');
 const events:Event[]=timing==='before'?['delete','read','commit','fill']:['delete','commit','read','fill'];
 const s=run({},events);
 return <><h3>商品改名：快递员拿走哪一版目录？</h3><p>数据库像总目录，缓存像前台展示板，读者像搬运副本的人。清空展示板不会改写他手里已经拿到的目录。</p><label>搬运员取目录的时机<select value={timing} onChange={e=>setTiming(e.target.value as 'before'|'after')}><option value="before">在总目录更新之前</option><option value="after">在总目录更新之后</option></select></label><div className="cm142-order">{events.map((e,i)=><span key={i}>{i+1}. {labels[e]}</span>)}</div><Board s={s}/><p role="status">{timing==='before'?'手持 v1 的搬运员最后到达，把旧商品名装回展示板。':'搬运员在提交后才取到 v2，因此回填新商品名。'} 改动的只有读取时机，最终缓存随之改变。</p><p className="cm142-note">类比边界：真实缓存有并发客户端、故障和过期；搬运员不会自动知道总目录已更新。</p></>
}
function Diagram(){
 const [guard,setGuard]=useState<Guard>('present');const [selected,setSelected]=useState('reader');const [filled,setFilled]=useState(false);
 let s=run({scenario:'late-fill',guard},['read','commit','delete']);if(filled)s=apply(s,'fill');
 const notes:Record<string,string>={db:'v2 已提交，只改变数据库。删除和回填不是该事务的一部分。',reader:'读者手持 v1；这是之前读取的结果，网络延迟不会把它升级成 v2。',cache:'空缓存没有现存版本可比较。保留门槛才能在删除后继续识别 v1。'};
 return <><h3>沿着旧值的路径检查版本</h3><p>当前停在“已提交 v2、缓存已删除、v1 读请求尚未回填”。点击节点定位证据。</p><div className="cm142-actions">{(['db','reader','cache'] as const).map((id,i)=><button key={id} aria-pressed={selected===id} onClick={()=>setSelected(id)}>{['数据库','在途读者','缓存'][i]}</button>)}</div><Board s={s} selected={selected}/><p>{notes[selected]}</p><GuardSelect value={guard} onChange={v=>{setGuard(v);setFilled(false)}}/><button onClick={()=>setFilled(!filled)}>{filled?'撤回这次回填':'让旧读者尝试回填'}</button><p className="cm142-feedback" role="status">{s.log.at(-1)}</p><Boundary/></>
}
const startOrder:Event[]=['read','delete','commit','fill'];
function Steps(){
 const [order,setOrder]=useState<Event[]>(startOrder);const [s,setS]=useState<State|null>(null);
 function move(i:number){const a=[...order];[a[i],a[i-1]]=[a[i-1],a[i]];setOrder(a);setS(null)}
 return <><h3>排事件，再找操作顺序的边界</h3><p>先把“提交数据库”移到“删除缓存”之前；保留旧读者先读取、最后回填。然后检查仅调整写者顺序是否足够。</p><ol className="cm142-sort">{order.map((event,i)=><li key={event}><span>{labels[event]}</span><button disabled={i===0} aria-label={'上移'+labels[event]} onClick={()=>move(i)}>↑ 上移</button></li>)}</ol><div className="cm142-actions"><button onClick={()=>setS(run({scenario:'late-fill'},order))}>执行我的顺序</button><button onClick={()=>{setOrder(startOrder);setS(null)}}>重新排列</button></div>{s&&<><Board s={s}/><ol>{s.log.slice(1).map((line,i)=><li key={i}>{line}</li>)}</ol><p role="status">{stale(s)?'找到反例：提交后删除仍会被迟到旧读回填。下一步应设计回填校验与失效重试。':'这一次交错没有留下旧值，但一次成功不能证明所有并发交错安全。'}{order.indexOf('fill')<order.indexOf('read')?' 本轮回填排在读取之前，模型拒绝无快照的回填；调整顺序再试。':''}</p></>}<p className="cm142-note">排事件 → 跟踪读者快照 → 核对最后一次回填 → 找失败窗口 → 设计保护。排序只是构造一个具体调度。</p></>
}
function Try(){
 const [guard,setGuard]=useState<Guard>('present');const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [s,setS]=useState<State|null>(null);
 return <><h3>迁移练习：报价 v7 → v8</h3><p>报价读者已取得 v7；数据库提交 v8 后成功删除缓存，旧读者随后才回填。目标：拒绝 v7 写入空缓存。</p><GuardSelect value={guard} onChange={g=>{setGuard(g);setS(null)}}/><label>预测缓存最终状态<select value={prediction} onChange={e=>{setPrediction(e.target.value);setS(null)}}><option value="">请选择</option><option value="old">缓存接受 v7</option><option value="empty">拒绝 v7，缓存为空</option></select></label><label>为什么该校验有足够的信息？<textarea value={reason} onChange={e=>{setReason(e.target.value);setS(null)}}/></label><button disabled={!prediction||!reason.trim()} onClick={()=>setS(run({scenario:'late-fill',guard,base:7}))}>验证方案与预测</button>{s&&<><Board s={s}/><p className="cm142-feedback" role="status">{prediction===(s.cache===null?'empty':'old')?'预测一致。':'预测不同。'}{s.rejected?'保留的 v8 门槛拒绝 v7，目标达成。':'空缓存没有 v8 供比较，旧版本进入缓存，目标未达成。'}</p><p>你的理由：{reason}</p></>}<Boundary/><p className="cm142-note">带反馈迁移练习；不记入独立掌握成绩。</p></>
}
export function Help({mode}:{mode:string}){return <section className="cm142 cm142-help" data-testid="cache-message-help-142">{mode==='example'?<Example/>:mode==='diagram'?<Diagram/>:mode==='steps'?<Steps/>:<Try/>}</section>}
