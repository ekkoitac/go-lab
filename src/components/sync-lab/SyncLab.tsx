import {useState} from 'react';
import type {Lesson} from '../../content/types';
import {initial,transition,operations,metrics,relations,deadlocked,type State,type Action} from './model';
import {guides,routeFor,challenge} from './guides';
import './sync-lab.css';
import SyncDiagram from './SyncDiagram';

export function Board({state:s,previous}:{state:State;previous?:State}){
 const before=new Map(previous?metrics(previous):[]);
 const [selected,setSelected]=useState<string|null>(null);
 return <div className="sync-board" data-testid="live-model" data-state={JSON.stringify(s)}>
  <div className="sync-metrics">{metrics(s).map(([name,value])=><button type="button" key={name} aria-pressed={selected===name} className={'sync-metric '+(before.has(name)&&before.get(name)!==value?'changed':'')} onClick={()=>setSelected(selected===name?null:name)}>
   <span>{name}</span><strong>{value}</strong>{before.has(name)&&before.get(name)!==value&&<small>上一步：{before.get(name)} → 本步：{value}</small>}
  </button>)}</div>
  {selected&&<p className="sync-inspect">{selected}：{metrics(s).find(([name])=>name===selected)?.[1]}。本步原因：{s.message}</p>}
  {s.id===42&&<div className="sync-time" aria-label="执行时间片">{s.ticks.length?s.ticks.map((tick,i)=><div key={i}><small>时间片 {i+1}</small><strong>{tick}</strong><span>{tick.includes('+')?'同时执行':'单任务执行'}</span></div>):<p>时间线尚为空。安排一个任务后，这里会记录实际执行单元。</p>}</div>}
  {s.id===43&&<div className="sync-lanes">{['A','B'].map((actor,i)=><div key={actor}><b>任务 {actor}</b>{['读共享值','本地加 '+s.size,'写回共享值'].map((line,j)=><span key={line} className={s.pc[i]===j?'current':s.pc[i]>j?'done':''}>{s.pc[i]>j?'✓ ':s.pc[i]===j?'下一步 · ':''}{line}</span>)}</div>)}</div>}
  <div className="sync-relations" aria-label="当前关系图">{relations(s).map(([a,verb,b],i)=><div key={i}><b>{a}</b><span>{verb}<br/><i className="sync-arrow" aria-hidden="true">↓</i></span><b>{b}</b></div>)}</div>
  {deadlocked(s)&&<p className="sync-warning" role="status">等待环：任务 1 等锁 B → 任务 2 等锁 A → 任务 1。回退可以重排调度；切换统一锁序可以消除这类环。</p>}
 </div>;
}
type Entry={state:State;prediction:string};
export default function SyncLab({lesson,guided=false}:{lesson:Lesson;guided?:boolean}){
 const guide=guides[lesson.id];
 const [history,setHistory]=useState<Entry[]>([{state:initial(lesson.id),prediction:''}]),[cursor,setCursor]=useState(0);
 const [prediction,setPrediction]=useState(''),[baseline,setBaseline]=useState<State|null>(null);
 const s=history[cursor].state,previous=cursor?history[cursor-1].state:undefined;
 const route=routeFor(s.id,s.fixed,s.size),full=cursor>=100;
 function reset(fixed=s.fixed,size=s.size){setHistory([{state:initial(s.id,fixed,size),prediction:''}]);setCursor(0);setPrediction('');}
 function run(action:Action){const next=transition(s,action);if(next===s||full)return;setHistory([...history.slice(0,cursor+1),{state:next,prediction}]);setCursor(cursor+1);setPrediction('');}
 function seek(index:number){setCursor(index);setPrediction('');}
 return <section className="experiment-panel sync-lab" data-testid="sync-lab">
  <div className="sync-heading"><small>第 {lesson.id} 题 · {guided?'沿因果链逐步验证':'你来安排执行'}</small><h3>{guide.title}</h3><p>{guide.focus}</p></div>
  <div className="sync-task"><strong>本次任务</strong><p>{guide.task}</p></div>
  <div className="scenario-tabs" role="group" aria-label="同步实验条件">{guide.conditions.map((label,i)=><button key={label} className={s.fixed===(i===1)?'selected':''} aria-pressed={s.fixed===(i===1)} onClick={()=>{if(s.fixed!==(i===1))reset(i===1)}}>{label}</button>)}</div>
  {guide.parameter&&<label className="sync-parameter">{guide.parameter}：<strong>{s.size}</strong><input aria-label={guide.parameter} type="range" min="1" max="3" value={s.size} onChange={e=>reset(s.fixed,Number(e.target.value))}/></label>}
  <p className="sync-note">切换条件或数值会从头开始；已保存的对照仍保留。每个按钮是一段明确的教学操作。</p>
  {<label className="sync-predict">先预测下一步（可选）<textarea aria-label="下一步预测与理由" value={prediction} maxLength={500} onChange={e=>setPrediction(e.target.value)} placeholder="哪个状态会改变，或者为什么会等待？写下依据，再执行验证。"/></label>}
  {guided&&<div className="sync-guide"><h4>沿这条路径拆开看</h4><p>第 {Math.min(cursor+1,route.length)} / {route.length} 步。每次只推进一个操作，也可以回退。</p>{cursor<route.length&&<p>即将执行：<strong>{operations(s).find(op=>op.id===route[cursor])?.label}</strong></p>}<button disabled={cursor>=route.length} onClick={()=>run(route[cursor])}>{cursor>=route.length?'引导路径已完成':'执行引导下一步'}</button></div>}
  {!guided&&<div className="sync-actions" aria-label="安排操作">{operations(s).map(op=><div key={op.id}><button data-action={op.id} disabled={!op.enabled||full} onClick={()=>run(op.id)}>{op.label}</button>{!op.enabled&&<small>{op.why}</small>}</div>)}</div>}
  {full&&<p>本次已记录 100 步，请保存对照后重置。</p>}
  <div className="sync-feedback" aria-live="polite"><strong>{s.line}</strong><p>{s.message}</p>{history[cursor].prediction&&<p className="sync-saved-prediction">执行前的预测：{history[cursor].prediction}<br/>请比较预测与实际证据；文字预测由你自评，不自动判分。</p>}</div>
  <Board state={s} previous={previous}/>
  <div className="sync-history"><h4>你的执行记录 · {cursor} / {history.length-1} 步</h4><div className="control-row"><button className="ghost" disabled={!cursor} onClick={()=>seek(cursor-1)}>回退一步</button><button className="ghost" disabled={cursor===history.length-1} onClick={()=>seek(cursor+1)}>前进一步</button><button className="ghost" onClick={()=>reset()}>重置实验</button></div><input aria-label="同步操作时间线" type="range" min="0" max={history.length-1} value={cursor} onChange={e=>seek(Number(e.target.value))}/>
  <p>回退后执行新操作，会从当前位置分出一条新路径。</p><details><summary>查看每步操作与预测</summary><ol>{history.map((entry,index)=><li key={index}><button className="ghost" aria-current={cursor===index?'step':undefined} onClick={()=>seek(index)}>{index}. {entry.state.line}</button>{entry.prediction&&<small>预测：{entry.prediction}</small>}</li>)}</ol></details></div>
  <div className="sync-compare"><button className="ghost" onClick={()=>setBaseline(structuredClone(s))}>保存当前状态为对照</button>{baseline&&<><p>已保存：{guide.conditions[baseline.fixed?1:0]}{guide.parameter?' · '+guide.parameter+' '+baseline.size:''}。观察时点：{baseline.line}。{baseline.size!==s.size?'输入已不同，请勿只把差异归因于同步条件。':'输入相同；操作顺序与观察时点仍需一起比较。'}</p><div className="sync-table-wrap"><table><caption>保存快照与当前状态</caption><thead><tr><th>观察指标</th><th>已保存</th><th>当前</th></tr></thead><tbody>{metrics(s).map(([name,value])=><tr key={name}><th>{name}</th><td>{new Map(metrics(baseline)).get(name)}</td><td>{value}</td></tr>)}</tbody></table></div><button className="ghost" onClick={()=>setBaseline(null)}>清除对照</button></>}</div>
  <p className="sync-boundary">模型边界：{guide.boundary}</p><small className="sync-note">自由探索与帮助练习不计为独立掌握，不改动代码。请到「迁移与复测」完成独立验证。</small>
 </section>;
}
export function SyncHelp({lesson,mode}:{lesson:Lesson;mode:string}){
 const g=guides[lesson.id];
 if(mode==='example')return <div className="sync-help"><h4>把熟悉的场景映射到程序</h4><p>{lesson.analogy}</p><div className="sync-table-wrap"><table><thead><tr><th>熟悉的事</th><th>程序中的对象</th><th>要检查的关系</th></tr></thead><tbody>{g.everyday.map(row=><tr key={row[0]}>{row.map(cell=><td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><p>类比边界：{lesson.analogyLimit}</p><p>回到实验：{g.task}</p></div>;
 if(mode==='try')return <Practice lessonId={lesson.id}/>;
 if(mode==='diagram')return <SyncDiagram lessonId={lesson.id}/>;
 return <SyncLab lesson={lesson} guided={mode==='steps'}/>;
}
function Practice({lessonId}:{lessonId:number}){
 const [variant,setVariant]=useState(0),[answer,setAnswer]=useState(''),[reason,setReason]=useState(''),[revealed,setRevealed]=useState(false),[step,setStep]=useState(0);
 const c=challenge(lessonId,variant);
 function next(){setVariant(v=>v+1);setAnswer('');setReason('');setRevealed(false);setStep(0);}
 return <div className="sync-practice" data-testid="sync-practice"><h4>先推导，再用状态验证</h4><p>{c.prompt}</p><div role="group" aria-label="练习预测" className="sync-options">{c.options.map(option=><button key={option} aria-pressed={answer===option} disabled={revealed} onClick={()=>setAnswer(option)}>{option}</button>)}</div><label>你的理由<textarea aria-label="练习预测理由" value={reason} disabled={revealed} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="哪一个状态或同步边界支持你的判断？"/></label><button disabled={!answer||revealed} onClick={()=>{setRevealed(true);setStep(c.trace.length-1)}}>提交预测并验证</button>
 {revealed&&<><div className="sync-feedback" aria-live="polite"><strong>{answer===c.answer?'这次预测与模型一致':'预测与模型不同'}</strong><p>你的预测：{answer}；实际：{c.answer}。{c.why}</p>{reason&&<p>你的理由：{reason}（请结合下方证据自评）</p>}</div><label>回看验证过程<input aria-label="练习验证步骤" type="range" min="0" max={c.trace.length-1} value={step} onChange={e=>setStep(Number(e.target.value))}/></label><p>{step}. {c.trace[step].line}：{c.trace[step].message}</p><Board state={c.trace[step]} previous={step?c.trace[step-1]:undefined}/><button onClick={next}>换一组条件再预测</button></>}
 <small>这是求助后的练习；两组条件交替出现，重做不算新的独立证据。正式记录请使用「迁移与复测」。</small></div>;
}

