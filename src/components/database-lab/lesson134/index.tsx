import {useState} from 'react';
import {actionLabel,actors,advance,back,effects,initial,online,step,strategies,type Actor,type Effect,type State,type Strategy} from './model';
import './style.css';
const phaseLabels={lock:'等待申请锁',read:'等待统计',decide:'等待业务判断',commit:'等待提交',done:'已提交',aborted:'已中止'};
const order:Actor[]=['甲','乙','甲','乙','甲','甲','乙','乙','乙','乙','乙','乙','乙'];
function View({state,focus,rename=false}:{state:State;focus?:Actor;rename?:boolean}){
 const fixed=state.strategy==='rr'||state.strategy==='serializable';
 return <div className="db134-view">
  <div className={`db134-committed ${online(state.rows)===0?'db134-danger':''}`}><strong>已提交视图：{online(state.rows)} 人在线</strong><div>{actors.map(a=><span key={a}>{rename?'供货点':'医生'}{a}：{state.rows[a]?'在线':'离线'}</span>)}</div><small>不变量：至少 1 人在线。暂存写入不会出现在这里。</small></div>
  <div className="db134-lock">共同排班行锁：{state.lock?`${state.lock}持有`:'空闲'} · {state.strategy==='own'||state.strategy==='serializable'?'此策略分别锁自己的行':'所有写者必须使用同一个锁'} </div>
  <div className="db134-lanes">{actors.map(a=>{const tx=state.tx[a];const view=fixed?tx.snapshot:state.rows;return <article key={a} className={(focus??state.active)===a?'db134-active':''} aria-label={`事务${a}泳道`}>
   <h4>事务{a} · 第{tx.attempt}次</h4><p><b>{tx.waiting?'正在等待锁':phaseLabels[tx.phase]}</b></p>
   <div className="db134-flow">锁 → 读 → 决策 → 提交</div>
   <dl><dt>{fixed?'固定事务快照':'下一条查询可见视图'}</dt><dd>{view?`甲${view.甲?'在线':'离线'} / 乙${view.乙?'在线':'离线'}`:'尚未建立'}</dd><dt>已读取的人数</dt><dd>{tx.readCount??'尚未读取'}</dd><dt>本事务暂存</dt><dd>{tx.pending===false?`${a}下线（未提交）`:'无待提交写入'}</dd></dl>
   <p className="db134-last">{tx.trace.at(-1)??'由你决定先调度哪个事务。'}</p>
  </article>;})}</div>
 </div>;
}
export default function Lab(){
 const [timeline,setTimeline]=useState(()=>initial());const [actor,setActor]=useState<Actor>('甲');
 const [effect,setEffect]=useState<Effect|''>('');const [count,setCount]=useState('');const [reason,setReason]=useState('');
 const {state}=timeline;const last=timeline.runs.at(-1);const clear=()=>{setEffect('');setCount('');setReason('');};
 const valid=effect!==''&&count!==''&&reason.trim()!==''&&state.tx[actor].phase!=='done';
 return <section className="db134" data-testid="database-lab-134"><h3>你来调度：谁看见了哪份排班？</h3>
  <p>目标：构造“两人都读到 2”的时序，再修复跨行约束。先让甲申请锁，再让乙申请锁，观察是否等待；随后分别统计、判断、提交。</p>
  <label>保护策略<select value={state.strategy} onChange={e=>{setTimeline(initial(e.target.value as Strategy));setActor('甲');clear();}}>{Object.entries(strategies).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <p className="db134-note">切换策略会开启新一轮。共同锁仅锁定排班记录，不更新它；这正是 REPEATABLE READ 的反例条件。</p>
  <div data-testid="live-model" data-state={JSON.stringify(state)}><View state={state}/></div>
  <fieldset className="db134-schedule"><legend>调度下一条动作</legend>{actors.map(a=><label key={a}><input type="radio" name="db134-actor" checked={actor===a} onChange={()=>{setActor(a);clear();}}/>{actionLabel(state,a)}</label>)}</fieldset>
  <div className="db134-predict"><strong>先预测：{actionLabel(state,actor)}</strong>
   <label>这个动作的结果<select value={effect} onChange={e=>setEffect(e.target.value as Effect)}><option value="">请选择预测</option>{Object.entries(effects).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
   <label>动作后已提交的在线人数<select value={count} onChange={e=>setCount(e.target.value)}><option value="">请选择人数</option>{[0,1,2].map(n=><option key={n} value={n}>{n} 人</option>)}</select></label>
   <label>我的理由<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="这次读用哪份快照？暂存和提交有什么区别？"/></label>
  </div>
  <div className="db134-actions"><button data-db-action="step" disabled={!valid} onClick={()=>{if(effect){setTimeline(step(timeline,actor,{effect,online:Number(count),reason}));clear();}}}>记录预测并单步</button><button data-db-action="back" disabled={!timeline.runs.length} onClick={()=>{setTimeline(back(timeline));clear();}}>回退一步</button><button data-db-action="reset" onClick={()=>{setTimeline(initial());setActor('甲');clear();}}>重置基线</button></div>
  {last&&<div className="db134-feedback" role="status"><strong>{last.effect===last.prediction.effect&&last.online===last.prediction.online?'预测与模型一致':'预测存在差异'}</strong><p>预测：{effects[last.prediction.effect]}、{last.prediction.online} 人；实际：{effects[last.effect]}、{last.online} 人。</p><p>原理由：{last.prediction.reason}</p><p>证据：{last.evidence}</p><p>可回退一步改变调度；用相同顺序换策略，比较“等待锁”和“刷新快照”是否同时发生。</p></div>}
  <p className="db134-note">确定性教学模拟，不是数据库实测。仅两位医生、两笔事务、无其他写者；SERIALIZABLE 简化为在提交处中止冲突的后一方，真实 PostgreSQL 的中止时机与牺牲者不固定。共同锁方案要求所有写者遵守协议、READ COMMITTED 且锁后另发 SQL 重读。练习不计正式成绩。</p>
 </section>;
}
function WorkedExample(){
 const [strategy,setStrategy]=useState<Strategy>('rc');const [history,setHistory]=useState<State[]>([initial('rc').state]);const state=history.at(-1)!;const tick=history.length-1;const actor=order[tick];
 return <><p>示范时序：让乙在甲持锁时进入，再观察它拿锁后的读数。可以切换隔离级别重走相同时序。</p><label>示范策略<select value={strategy} onChange={e=>{const s=e.target.value as Strategy;setStrategy(s);setHistory([initial(s).state]);}}><option value="rc">READ COMMITTED + 共同锁</option><option value="rr">REPEATABLE READ + 共同锁</option></select></label><View state={state}/><div className="db134-actions"><button disabled={!actor||state.tx.甲.phase==='done'&&state.tx.乙.phase==='done'} onClick={()=>setHistory([...history,advance(state,actor)])}>示范下一步{actor?`：${actionLabel(state,actor)}`:''}</button><button disabled={history.length===1} onClick={()=>setHistory(history.slice(0,-1))}>示范回退</button><button onClick={()=>setHistory([initial(strategy).state])}>重新示范</button></div><p role="status">{state.event}</p></>;
}
function SnapshotDiagram(){
 const [focus,setFocus]=useState<Actor>('乙');const [strategy,setStrategy]=useState<Strategy>('rr');
 let state=initial(strategy).state;for(const a of ['甲','乙','甲','甲','甲','乙','乙'] as Actor[])state=advance(state,a);
 return <><p>取甲提交、乙刚重读这一时刻。选择事务查看“读数来自哪里”，再替换隔离级别，比较同一时序。</p><div className="db134-actions">{actors.map(a=><button key={a} aria-pressed={focus===a} onClick={()=>setFocus(a)}>追踪事务{a}</button>)}<button onClick={()=>setStrategy(strategy==='rr'?'rc':'rr')}>当前 {strategy==='rr'?'REPEATABLE READ':'READ COMMITTED'} · 切换</button></div><View state={state} focus={focus}/><div className="db134-source" role="status">{strategy==='rr'?'事务开始的固定快照（2 人）':`事务${focus}查询开始时的已提交视图（${state.tx[focus].readCount} 人）`} → 事务{focus}的读取 → 读数 {state.tx[focus].readCount} → {state.tx[focus].readCount!>1?'允许暂存下线':'拒绝下线'}<p>{strategy==='rr'?'锁仅协调先后；共同记录没有更新，所以它的锁等待不会使旧快照失效。':'甲的读数是历史证据；乙锁后的新查询才会看见甲已经提交的下线。'}</p></div></>;
}
function RepairSteps(){
 const [path,setPath]=useState<'rc'|'serializable'>('rc');const [index,setIndex]=useState(0);
 const steps=path==='rc'?[
  ['明确前提','BEGIN ISOLATION LEVEL READ COMMITTED;','所有可能改变排班的写者都必须走相同协议。'],
  ['取得共同锁','SELECT id FROM schedule WHERE id = 1 FOR UPDATE;','如果锁被占用，等待前一笔事务提交。锁的是共同记录。'],
  ['另发新 SQL','SELECT count(*) FROM doctors WHERE on_call = true;','新语句获取新快照。不要把人数查询提前到等锁之前。'],
  ['判断与提交','if count > 1: UPDATE doctors SET on_call = false WHERE id = self;\nCOMMIT;','事务期间持有共同锁，拒绝让最后一位医生下线。']
 ]:[
  ['开始完整事务','BEGIN ISOLATION LEVEL SERIALIZABLE;','先重读当前事务快照中的业务数据。'],
  ['执行全部业务判断','SELECT count(*);\nif count > 1: UPDATE own_doctor;','不同记录上的写入也可能形成跨行读写依赖。'],
  ['处理可重试错误','COMMIT; // 任意阶段可能出现 SQLSTATE 40001','被中止后，当前事务的写入不生效。不能只重试 UPDATE。'],
  ['回到事务入口','ROLLBACK;\nretry entire transaction with bounded backoff;','新事务重新读数、重新决定；副作用也要有明确边界。']
 ];
 return <><p>修复路线：依次检查协议中真正保护不变量的条件。</p><label>修复路径<select value={path} onChange={e=>{setPath(e.target.value as 'rc'|'serializable');setIndex(0);}}><option value="rc">共同锁 + 新语句快照</option><option value="serializable">串行化 + 完整重试</option></select></label><ol>{steps.map(([title],i)=><li key={title} className={i===index?'db134-current':''}>{title}{i<index?' ✓':''}</li>)}</ol><h4>步骤 {index+1}：{steps[index][0]}</h4><pre>{steps[index][1]}</pre><p>{steps[index][2]}</p><div className="db134-actions"><button disabled={!index} onClick={()=>setIndex(index-1)}>上一步</button><button disabled={index===steps.length-1} onClick={()=>setIndex(index+1)}>核对下一条件</button></div><small>以上为协议伪代码；代码片段并非可直接运行的 SQL 脚本。</small></>;
}
function Transfer(){
 const [strategy,setStrategy]=useState<Strategy>('rr');const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');const [revealed,setRevealed]=useState(false);
 let state=initial(strategy).state;
 for(const a of ['甲','乙','甲','甲','甲','乙','乙','乙','乙'] as Actor[])state=advance(state,a);
 return <><p>迁移练习：两个供货点要依次停机，必须保留至少一个在线。乙先进入事务并等待共同配置行锁；甲停机并提交，乙拿锁后另发查询。共同配置行只锁不更新。</p><label>选择要检验的方案<select value={strategy} onChange={e=>{setStrategy(e.target.value as Strategy);setRevealed(false);setPrediction('');setReason('');}}><option value="rr">REPEATABLE READ + 共同锁</option><option value="rc">READ COMMITTED + 共同锁</option></select></label><label>两笔事务完成后还能供货吗？<select disabled={revealed} value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">先独立选择</option><option value="0">不能：0 个供货点</option><option value="1">能：1 个供货点</option></select></label><label>说明乙读取的是哪一刻的数据<textarea disabled={revealed} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="db134-actions"><button disabled={revealed||!prediction||!reason.trim()} onClick={()=>setRevealed(true)}>提交解释并检验</button><button onClick={()=>{setRevealed(false);setPrediction('');setReason('');}}>重新作答</button></div>{revealed&&<div className="db134-feedback" role="status"><strong>{Number(prediction)===online(state.rows)?'结果预测一致':'需要修正预测'}：实际保留 {online(state.rows)} 个供货点</strong><p>你的理由：{reason}</p><p>{strategy==='rr'?'乙等待前已建立 2 个在线的旧快照；锁等待不刷新它，乙仍决定停机。改用明确的新快照协议，或 SERIALIZABLE 并完整重试。':'乙获得锁之后的新查询看到只有 1 个在线，因此拒绝自己停机。'}</p><View state={state} rename/></div>}<p className="db134-note">该练习与正式成绩分离；揭晓后重试属于辅助探索，不作为独立掌握证据。</p></>;
}
export function Help({mode}:{mode:string}){return <section className="db134 db134-help" data-testid="database-help-134">{mode==='example'?<WorkedExample/>:mode==='diagram'?<SnapshotDiagram/>:mode==='steps'?<RepairSteps/>:<Transfer/>}</section>;}
