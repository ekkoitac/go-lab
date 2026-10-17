import {useState} from 'react';
import {initialState,transition,missingKeys,duplicates,type ImportState,type CommitPolicy,type Lane,type Action} from './model';
import './style.css';
const phases:Record<Lane['phase'],string>={reading:'读取到草稿',ready:'准备提交', 'checkpoint-written':'仅断点已提交','data-written':'仅数据已提交',done:'本轮结束',crashed:'进程已崩溃'};
function Keys({keys,total,kind}:{keys:number[];total:number;kind:string}){
  return <div className="db139-keys" aria-label={kind}>{Array.from({length:total},(_,i)=>i+1).map(k=>{const count=keys.filter(x=>x===k).length;return <span key={k} className={count?'filled':''} title={`商品 K${k}：${count} 条`}>K{k}{count>1?` ×${count}`:''}</span>;})}</div>;
}
function LaneView({state,lane}:{state:ImportState;lane:Lane}){
 const missing=missingKeys(state,lane);
 return <article className="db139-lane"><h4>{lane.name}<span>{phases[lane.phase]}</span></h4>
  <div className="db139-metrics"><span>已读 <b>{lane.read}/{state.total}</b></span><span>持久断点 <b>{lane.checkpoint}</b></span><span>草稿峰值 <b>{lane.peak} 条</b></span><span>数据提交 <b>{lane.commits} 次</b></span></div>
  <p className="db139-label">① 事务草稿 · 崩溃会丢失</p><Keys keys={lane.draft} total={state.total} kind="事务草稿"/>
  <p className="db139-label">② 持久数据 · 已对外可见</p><Keys keys={lane.persisted} total={state.total} kind="持久数据"/>
  <div className="db139-checkpoint">③ 断点 {lane.checkpoint} → 重启从 {lane.checkpoint===state.total?'输入末尾':`K${lane.checkpoint+1}`} 开始</div>
  <p className="db139-event">{lane.event}</p>
  {(missing.length>0||duplicates(lane)>0||lane.replayed>0)&&<p className="db139-alert">断点之前缺失：{missing.length?missing.map(k=>`K${k}`).join('、'):'无'}；重复记录：{duplicates(lane)}；重放处理：{lane.replayed} 次。</p>}
 </article>;
}
export default function Lab(){
 const [history,setHistory]=useState<ImportState[]>([initialState()]);
 const state=history[history.length-1];
 const [prediction,setPrediction]=useState('0'),[reason,setReason]=useState(''),[feedback,setFeedback]=useState('');
 const apply=(action:Action)=>{setHistory(h=>[...h,transition(h[h.length-1],action)]);setFeedback('');};
 const reset=(batch=state.batch,policy=state.policy,idempotent=state.idempotent)=>{setHistory([initialState(batch,policy,idempotent)]);setReason('');setFeedback('');};
 const check=()=>{const next=transition(state,'step');const actual=next.lanes[1].persisted.length;setHistory(h=>[...h,next]);setFeedback(`你的预测：${prediction} 条；实际：${actual} 条。${Number(prediction)===actual?'数量吻合。':'检查草稿是否已经跨过提交边界。'} ${next.lanes[1].event} 你的理由：${reason}`);};
 return <section className="db139" data-testid="database-lab-139"><header><h3>断点必须跟着提交走</h3><p>同一份 8 条商品输入，同时驱动大事务和有限批次。先单步读入，再观察提交；在任何位置注入崩溃。</p></header>
 <div className="db139-config"><label>每批条数<select value={state.batch} onChange={e=>reset(Number(e.target.value))}>{[2,3,4].map(v=><option key={v} value={v}>{v} 条</option>)}</select></label><label>提交边界<select value={state.policy} onChange={e=>reset(state.batch,e.target.value as CommitPolicy)}><option value="atomic">数据与断点同事务</option><option value="checkpoint-first">错误：断点先提交</option><option value="data-first">风险：数据先提交</option></select></label><label className="db139-checkbox"><input type="checkbox" checked={state.idempotent} onChange={e=>reset(state.batch,state.policy,e.target.checked)}/>按稳定商品键幂等</label></div>
 <p className="db139-hint">改参数会重新开始。每条输入的稳定业务键为 K1—K8；未勾选幂等时，重放会新建记录。</p>
 <div className="db139-actions"><button data-db-action="step" onClick={()=>apply('step')} disabled={state.lanes.every(l=>l.phase==='done'||l.phase==='crashed')}>下一步：读取 / 提交</button><button onClick={()=>apply('crash')} disabled={state.lanes.every(l=>l.phase==='crashed')}>此刻崩溃</button><button onClick={()=>apply('restart')} disabled={!state.lanes.some(l=>l.phase==='crashed')}>按断点恢复</button><button data-db-action="back" disabled={history.length===1} onClick={()=>{setHistory(h=>h.slice(0,-1));setFeedback('');}}>回退</button><button data-db-action="reset" onClick={()=>reset()}>重置</button></div>
 <div data-testid="live-model" data-state={JSON.stringify(state)} className="db139-comparison">{state.lanes.map(l=><LaneView key={l.name} state={state} lane={l}/>)}</div>
 <fieldset className="db139-predict"><legend>先预测，再用下一步核对</legend><label>下一步后，右侧分批方案持久记录共几条？<select value={prediction} onChange={e=>setPrediction(e.target.value)}>{Array.from({length:state.lanes[1].persisted.length+state.total+1},(_,i)=><option value={i} key={i}>{i} 条</option>)}</select></label><label>依据哪一个提交边界？<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="例如：数据还在草稿，本次只读取，断点不会前进。"/></label><button onClick={check} disabled={!reason.trim()||state.lanes[1].phase==='crashed'||state.lanes[1].phase==='done'}>提交预测并执行下一步</button><p role="status">{feedback||'探索记录不计入正式答题成绩。'}</p></fieldset>
 <details><summary>建议实验与模型边界</summary><ol><li>同事务、每批 3 条：执行 4 步，观察左侧尚未提交，右侧已可见 K1—K3。</li><li>选择断点先提交：执行 4 步，崩溃并恢复。K1—K3 会被跳过；幂等无法补回漏写。</li><li>选择数据先提交：执行 4 步，崩溃并恢复。对照勾选 / 取消幂等后的重放结果。</li></ol><p>草稿条数是事务规模的教学代理，不是实际锁、日志字节数或吞吐压测。输入固定、有序、版本不变；真实导入还需限速、失败行与输入版本记录。分批只保证每次提交原子；要求全部完成才可见，应写入暂存版本，校验后原子切换可见引用。</p></details>
 </section>;
}
function Relation({state}:{state:ImportState}){
 const l=state.lanes[1];
 return <div className="db139-relation" aria-label="输入、草稿、数据和恢复断点的有向关系"><div>输入 K1—K{state.total}<br/>已读 {l.read}</div><b>↓ 读取（尚未持久）</b><div>事务草稿：{l.draft.map(x=>`K${x}`).join('、')||'空'}</div><b>↓ {state.policy==='atomic'?'一个原子提交边界':'拆开的提交边界'}</b><div className={state.policy==='atomic'?'db139-atomic':''}>持久数据：{l.persisted.length} 条<br/>持久断点：{l.checkpoint}</div><b>↺ 崩溃后用断点定位输入</b><div>恢复读取起点：{l.checkpoint<state.total?`K${l.checkpoint+1}`:'输入末尾'}</div></div>;
}
export function Help({mode}:{mode:string}){
 const [history,setHistory]=useState<ImportState[]>([initialState(2,'atomic',true,5)]);
 const [task,setTask]=useState(0);const state=history[history.length-1],l=state.lanes[1];
 const apply=(action:Action)=>setHistory(h=>[...h,transition(h[h.length-1],action)]);
 const start=(taskId:number)=>{setTask(taskId);setHistory([initialState(taskId===1?3:2,taskId===2?'data-first':'atomic',taskId!==2,taskId===1?7:5)]);};
 return <section className="db139 db139-help" data-testid="database-help-139"><h3>{mode==='diagram'?'沿提交边界追踪数据':mode==='steps'?'逐步收集恢复证据':mode==='try'?'换一批输入验证':'例子：导入 5 件商品'}</h3>
 <p>{mode==='try'?'目标：让输入全部持久化，且恢复后不遗漏、不重复。先预想故障发生在哪个边界，再动手；此练习不计成绩。':mode==='diagram'?'箭头表示读取、提交与恢复定位。点击单步或崩溃，让图中的数据与断点共同变化。':mode==='steps'?'每次操作都保留实际模型事件；回退后可选择另一个故障位置继续。':'每批 2 条：读取 K1、K2，再提交；读到 K3 时崩溃，检查恢复是否仍从 K3 开始。'}</p>
 {mode==='try'&&<label>换任务<select value={task} onChange={e=>start(Number(e.target.value))}><option value={0}>5 条输入，每批 2 条：读到 K3 时崩溃</option><option value={1}>7 条输入，每批 3 条：完成首批后崩溃</option><option value={2}>5 条输入，数据先提交：构造重复并修复</option></select></label>}
 {mode==='try'&&task===2&&<button onClick={()=>{setHistory([initialState(2,'atomic',true,5)]);}}>修复方案并重试：同事务 + 稳定业务键</button>}
 <div className="db139-actions"><button onClick={()=>apply('step')} disabled={l.phase==='done'||l.phase==='crashed'}>单步</button><button onClick={()=>apply('crash')} disabled={l.phase==='crashed'}>崩溃</button><button onClick={()=>apply('restart')} disabled={l.phase!=='crashed'}>恢复</button><button disabled={history.length===1} onClick={()=>setHistory(h=>h.slice(0,-1))}>回退</button><button onClick={()=>start(task)}>重置</button></div>
 <div data-testid="live-model" data-state={JSON.stringify(state)}>{mode==='diagram'?<Relation state={state}/>:<LaneView state={state} lane={l}/>}</div>
 {mode==='steps'&&<ol className="db139-evidence">{history.slice(-6).map((s,i)=><li key={i}>{s.lanes[1].event}<small>已读 {s.lanes[1].read} / 断点 {s.lanes[1].checkpoint} / 持久记录 {s.lanes[1].persisted.length}</small></li>)}</ol>}
 {mode==='try'&&<p role="status">{l.phase==='done'?`本轮完成：唯一商品 ${new Set(l.persisted).size}/${state.total}，重复 ${duplicates(l)} 条，断点前缺失 ${missingKeys(state,l).length} 条。请用这些证据解释方案。`:'目标仍待验证：先运行到故障点，崩溃后恢复，再继续导入。'}</p>}
 <p className="db139-hint">断点表示已确认提交；已读位置只描述进程进度。分批会逐批可见，若需全量同时可见，需暂存版本与原子发布。</p></section>;
}
