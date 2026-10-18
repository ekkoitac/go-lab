import {lazy,Suspense,useEffect,useState} from 'react';
import {Play,Pause,SkipForward,RotateCcw,ChevronLeft,FlaskConical} from 'lucide-react';
import type {Lesson} from '../content/types';
import AdvancedLabs from './AdvancedLabs';
import Scene from './Scene';
import {sceneChanges} from './scene-changes';
import ArchitectureMetrics from './ArchitectureMetrics';
const TypesChapterLab=lazy(()=>import('./types-lab/TypesChapterLab'));
const ControlFlowChapterLab=lazy(()=>import('./control-flow-lab/ControlFlowChapterLab'));
const FoundationsChapterLab=lazy(()=>import('./foundations-lab/FoundationsChapterLab'));
const CollectionsChapterLab=lazy(()=>import('./collections-lab/CollectionsChapterLab'));
const DeliveryChapterLab=lazy(()=>import('./delivery-lab/DeliveryChapterLab'));
const OperationsChapterLab=lazy(()=>import('./operations-lab/OperationsChapterLab'));
const ResilienceChapterLab=lazy(()=>import('./resilience-lab/ResilienceChapterLab'));
const CacheMessageChapterLab=lazy(()=>import('./cache-message-lab/CacheMessageChapterLab'));
const DatabaseChapterLab=lazy(()=>import('./database-lab/DatabaseChapterLab'));
const ArchitectureChapterLab=lazy(()=>import('./architecture-lab/ArchitectureChapterLab'));
const ChannelChapterLab=lazy(()=>import('./channel-lessons/ChannelLessons'));
const TestingChapterLab=lazy(()=>import('./testing-lab/TestingChapterLab'));
const IOChapterLab=lazy(()=>import('./io-lab/IOChapterLab'));
const SyncLab=lazy(()=>import('./sync-lab/SyncLab'));
const ConcurrencyChapterLab=lazy(()=>import('./concurrency-lab/ConcurrencyChapterLab'));
const EngineeringChapterLab=lazy(()=>import('./engineering-lab/EngineeringChapterLab'));
const DataBoundaryChapter=lazy(()=>import('./data-boundary-lab/DataBoundaryChapter'));
const ObservabilityChapterLab=lazy(()=>import('./observability-lab/ObservabilityChapterLab'));
const SecurityChapterLab=lazy(()=>import('./security-lab/SecurityChapterLab'));
export default function Experiment({lesson}:{lesson:Lesson}) {
 if(lesson.id>=21&&lesson.id<=30)return <Suspense fallback={<p>正在加载类型与接口实验…</p>}><TypesChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=31&&lesson.id<=40)return <Suspense fallback={<p>正在加载控制流实验…</p>}><ControlFlowChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=1&&lesson.id<=10)return <Suspense fallback={<p>正在加载基础概念实验…</p>}><FoundationsChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=11&&lesson.id<=20)return <Suspense fallback={<p>正在加载数组、切片与 map 实验…</p>}><CollectionsChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=191&&lesson.id<=200)return <Suspense fallback={<p>正在加载测试与演进实验…</p>}><DeliveryChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=161&&lesson.id<=170)return <Suspense fallback={<p>正在加载性能与资源实验…</p>}><OperationsChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=151&&lesson.id<=160)return <Suspense fallback={<p>正在加载韧性实验…</p>}><ResilienceChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=171&&lesson.id<=180)return <Suspense fallback={<p>正在加载可观测性实验…</p>}><ObservabilityChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=181&&lesson.id<=190)return <Suspense fallback={<p>正在加载安全与隔离实验…</p>}><SecurityChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=141&&lesson.id<=150)return <Suspense fallback={<p>正在加载缓存与消息实验…</p>}><CacheMessageChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=131&&lesson.id<=140)return <Suspense fallback={<p>正在加载数据库实验…</p>}><DatabaseChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=71&&lesson.id<=80)return <Suspense fallback={<p>正在加载数据边界实验…</p>}><DataBoundaryChapter key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=101&&lesson.id<=120)return <Suspense fallback={<p>正在加载架构实验…</p>}><ArchitectureChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=91&&lesson.id<=100)return <Suspense fallback={<p>正在加载工程实践实验…</p>}><EngineeringChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=81&&lesson.id<=90)return <Suspense fallback={<p>正在加载测试实验…</p>}><TestingChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=61&&lesson.id<=70)return <Suspense fallback={<p>正在加载本题实验…</p>}><IOChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=41&&lesson.id<=50)return <Suspense fallback={<p>正在加载同步实验…</p>}><SyncLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=121&&lesson.id<=130)return <Suspense fallback={<p>正在加载并发实验…</p>}><ConcurrencyChapterLab key={lesson.id} lesson={lesson}/></Suspense>;

 if(lesson.id>=51&&lesson.id<=60)return <Suspense fallback={<p>正在加载交互实验…</p>}><ChannelChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 return <PresetExperiment lesson={lesson}/>;
}
function StringLab(){
 const [text,setText]=useState('A中🙂'),[mode,setMode]=useState<'bytes'|'runes'>('bytes');
 const bytes=new TextEncoder().encode(text),runes=Array.from(text);
 let offset=0;const offsets=runes.map(r=>{const start=offset;offset+=new TextEncoder().encode(r).length;return start});
 return <div className="special-lab"><h4>同一字符串，用两种单位观察</h4><p>切换字节与 rune，比较格子数和索引；试着把中文或 emoji 换成英文。</p><label>输入字符串<input aria-label="字符串输入" value={text} maxLength={60} onChange={e=>setText(e.target.value)}/></label><div className="control-row"><button aria-pressed={mode==='bytes'} className={mode==='bytes'?'':'ghost'} onClick={()=>setMode('bytes')}>字节 · {bytes.length}</button><button aria-pressed={mode==='runes'} className={mode==='runes'?'':'ghost'} onClick={()=>setMode('runes')}>rune · {runes.length}</button><button className="ghost" onClick={()=>{setText('A中🙂');setMode('bytes')}}>恢复示例</button></div>
 <p>{mode==='bytes'?'格子内容是十六进制字节；左上角是字节下标。':'格子内容是码点；左上角是 range 返回的起始字节偏移，不是第几个 rune。'}</p>
 <div className="array-row wrap" data-testid="live-model" data-state={mode+text}>{(mode==='bytes'?Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')):runes).map((v,i)=><div className="cell" key={i} aria-label={`字节偏移 ${mode==='bytes'?i:offsets[i]}：${v}`}><small>{mode==='bytes'?i:offsets[i]}</small><span className="string-value">{v===' '?'␠':v==='\n'?'↵':v==='\t'?'⇥':v}</span></div>)}{!text&&<span>空字符串 · 0 字节 / 0 rune</span>}</div><p aria-live="polite">len(s) = {bytes.length}；rune 数 = {runes.length}。UTF-8 一个 rune 可占多个字节；一个视觉字符也可能由多个 rune 组成。</p></div>;
}
function PresetExperiment({lesson}:{lesson:Lesson}) {
 const spec=lesson.experiment;
 const [scenario,setScenario]=useState(0),[step,setStep]=useState(0),[playing,setPlaying]=useState(false);
 const frames=spec.scenarios[scenario].frames, current=frames[step];
 const changes=sceneChanges(current,step?frames[step-1]:undefined);
 useEffect(()=>{
  if(!playing)return;
  if(step>=frames.length-1){setPlaying(false);return;}
  const timer=setTimeout(()=>setStep(s=>Math.min(s+1,frames.length-1)),1800);
  return()=>clearTimeout(timer);
 },[playing,step,frames.length]);
 const special=lesson.id===6?<StringLab/>:null;
 const hasSpecial=!!special||[61,65,77,78,82].includes(lesson.id);
 function seek(next:number){setPlaying(false);setStep(Math.max(0,Math.min(frames.length-1,next)));}
 return <section className="experiment-panel">
  <div className="panel-heading"><span className="icon-swatch"><FlaskConical size={18}/></span><div><h3>{spec.title}</h3><small>教学模拟 · 操作可回退</small></div></div>
  <p className="muted">{spec.instruction}</p>
  {hasSpecial&&<div className="hands-on"><h4>自由操作</h4><p className="experiment-guide">按操作台的提示改变输入，观察结果。这里与下方分步图解独立；修改模型不会改动编辑器代码。</p>{special}<AdvancedLabs lessonId={lesson.id}/></div>}
  <h4>分步图解</h4>
  <p className="experiment-guide">图中卡片用于显示状态。先选条件，再点「下一步」执行预设操作，也可点击步骤名称跳转；切换到另一条件会从第一步开始。{hasSpecial?'这里使用固定示例，不随上方自由操作改变。':lesson.practice==='decision'?'可在右侧决策记录中记录你的判断。':'要修改任意输入，可在代码编辑器中修改并运行。'}</p>
  <div className="scenario-tabs" role="group" aria-label="实验条件">{spec.scenarios.map((s,i)=><button key={i} aria-pressed={scenario===i} className={scenario===i?'selected':''} onClick={()=>{setPlaying(false);if(scenario!==i){setScenario(i);setStep(0)}}}>{s.label}</button>)}</div>
  <ol className="experiment-steps" aria-label="图解步骤">{frames.map((f,i)=><li key={i}><button className={step===i?'selected':'ghost'} aria-current={step===i?'step':undefined} disabled={step===i&&!playing} onClick={()=>seek(i)}><span>{i+1}</span>{f.label}</button></li>)}</ol>
  <div className="frame-position" aria-live="polite"><strong>{spec.scenarios[scenario].label}</strong><span>第 {step+1} / {frames.length} 步{step===frames.length-1?' · 已到最后一步':''}</span></div>
  <div className="play-controls">
   <button className="ghost" aria-label="回到开始" disabled={step===0&&!playing} onClick={()=>seek(0)}><RotateCcw size={16}/>重置图解</button>
   <button className="ghost" aria-label="上一步实验" disabled={step===0} onClick={()=>seek(step-1)}><ChevronLeft size={16}/>上一步</button>
   <button aria-label={playing?'暂停':'播放'} onClick={()=>{if(step===frames.length-1)setStep(0);setPlaying(!playing)}}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'暂停':step===frames.length-1?'重播':'播放'}</button>
   <button aria-label="下一步实验" disabled={step===frames.length-1} onClick={()=>seek(step+1)}>{step===frames.length-1?'本条件已完成':'下一步'}<SkipForward size={16}/></button>
   <label className="step-slider">进度<input aria-label="实验步骤" aria-valuetext={`第 ${step+1} 步：${current.label}`} type="range" min="0" max={frames.length-1} value={step} onChange={e=>seek(+e.target.value)}/></label>
  </div>
  <p className="next-operation">{step<frames.length-1?`下一步将：${frames[step+1].label}`:'本条件已演示完。可切换另一条件对照、回看步骤，或点击重播。'}</p>
  {lesson.decision&&<ArchitectureMetrics spec={spec} frame={current}/>}
  <Scene frame={current} previous={step?frames[step-1]:undefined} kind={spec.kind}/>
  <p className="scene-legend">绿色：当前关注项 · 橙色边框：相对上一步新增或更新{current.edges?.length?' · 箭头：图中标注的引用关系（窄屏可横向滚动）':' · 各卡片表示当前状态，不暗示先后或引用关系'}</p>
  <div className="frame-caption" aria-live="polite"><strong>{current.label}</strong><p>{current.detail}</p>
   {step===0?<p>当前是本条件的起点；点击下一步后对照状态变化。</p>:<div className="scene-changes"><h5>这一步发生了什么</h5>{changes.length?<ul>{changes.map((change,i)=><li key={i}><b>{change.label}</b>：{change.before===undefined?<>本步显示 <code>{change.after||'空字符串'}</code></>:change.after===undefined?<>上一帧为 <code>{change.before||'空字符串'}</code>；本帧不再展示此项（不表示值被删除）</>:<><code>{change.before||'空字符串'}</code><span aria-label="变为"> → </span><code>{change.after||'空字符串'}</code></>}</li>)}</ul>:<p>本步已执行，展示的值保持不变。{step===frames.length-1?'可切换另一条件比较，或回看前一步。':'可继续观察下一步，或切换条件比较。'}</p>}</div>}
  </div>
  <details className="scenario-comparison"><summary>对比两种条件的末步结果</summary><div>{spec.scenarios.map(s=><section key={s.label}><h4>{s.label}</h4><p>{s.frames.at(-1)!.detail}</p><dl>{s.frames.at(-1)!.nodes.map(n=><div key={n.id}><dt>{n.label}</dt><dd>{n.value}</dd></div>)}</dl></section>)}</div><p>这是各自场景的末步快照，不表示两条路径耗时相同。</p></details>
 </section>;
}
