import {lazy,Suspense,useEffect,useState} from 'react';
import {Play,Pause,SkipForward,RotateCcw,ChevronLeft,FlaskConical} from 'lucide-react';
import type {Lesson} from '../content/types';
import AdvancedLabs from './AdvancedLabs';
import Scene from './Scene';
import {sceneChanges} from './scene-changes';
import ArchitectureMetrics from './ArchitectureMetrics';
const ChannelChapterLab=lazy(()=>import('./channel-lessons/ChannelLessons'));
const IOChapterLab=lazy(()=>import('./io-lab/IOChapterLab'));
const SyncLab=lazy(()=>import('./sync-lab/SyncLab'));
const BoundedLab=lazy(()=>import('./bounded-lab/BoundedLab'));
export default function Experiment({lesson}:{lesson:Lesson}) {
 if(lesson.id>=61&&lesson.id<=70)return <Suspense fallback={<p>正在加载本题实验…</p>}><IOChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id>=41&&lesson.id<=50)return <Suspense fallback={<p>正在加载同步实验…</p>}><SyncLab key={lesson.id} lesson={lesson}/></Suspense>;
 if(lesson.id===121)return <Suspense fallback={<p>正在加载并发实验…</p>}><BoundedLab/></Suspense>;

 if(lesson.id>=51&&lesson.id<=60)return <Suspense fallback={<p>正在加载交互实验…</p>}><ChannelChapterLab key={lesson.id} lesson={lesson}/></Suspense>;
 return <PresetExperiment lesson={lesson}/>;
}
function SliceLab(){
 const [capacity,setCapacity]=useState(2),[step,setStep]=useState(0);
 const shared=capacity>2,a=step===2&&shared?[99,20]:[10,20],b=step===0?[]:step===1?[10,20,30]:[99,20,30];
 return <div className="special-lab">
  <h4>append 后，b 是否还与 a 共享数组？</h4>
  <p>先用容量 2 完成两步，再改成 3 或 4 重做；比较修改 b[0] 后 a[0] 是否变化。改变容量会从头开始。</p>
  <label>初始容量 <strong>{capacity}</strong><input aria-label="切片容量" type="range" min="2" max="4" value={capacity} onChange={e=>{setCapacity(+e.target.value);setStep(0)}}/></label>
  <div className="slice-model" data-testid="live-model" data-state={capacity+':'+step}>
   <span className="pointer">a → 数组 A · len 2 / cap {capacity}</span>
   <div className="array-row">{Array.from({length:capacity},(_,i)=><div className={'cell '+(i>=2&&!(step>0&&shared&&i===2)?'unused':'')} key={i}><small>{i}</small>{a[i]??(step>0&&shared&&i===2?30:0)}</div>)}</div>
   <div className={'pointer '+(step>0&&!shared?'split':'')}>{step===0?'b 尚未创建':`b → ${shared?'数组 A':'新数组 B'} · len 3 / cap ${shared?capacity:'≥ 3'}`}</div>
   {step>0&&!shared&&<div className="array-row">{b.map((v,i)=><div className="cell fresh" key={i}><small>{i}</small>{v}</div>)}</div>}
   <p>切片可见元素：a = [{a.join(' ')}]；b = {step===0?'尚未创建':'['+b.join(' ')+']'}</p>
  </div>
  <div className="control-row"><button onClick={()=>setStep(Math.min(2,step+1))} disabled={step===2}>{step===0?'执行 b := append(a, 30)':step===1?'执行 b[0] = 99':'两步已完成'}</button><button className="ghost" disabled={step===0} onClick={()=>setStep(step-1)}>撤回一步</button><button className="ghost" onClick={()=>setStep(0)}>重置</button></div>
  <p aria-live="polite">{step===0?'a 的长度固定为 2；虚线格在长度以外，但属于底层数组容量。':step===1?(shared?'append 复用数组 A，第三格变为 30；a 的长度仍为 2。':'append 分配数组 B 并复制元素，a 仍指向数组 A。'):(shared?'b[0] 与 a[0] 是同一个位置，两者都变为 99。':'b[0] 变为 99；a[0] 仍为 10，因为它们位于不同数组。')} 扩容后的精确容量由实现决定。</p>
 </div>;
}
function NilLab(){
 const [typed,setTyped]=useState(true),[value,setValue]=useState(false);
 return <div className="special-lab"><h4>接口的类型和值，缺一不可</h4><p>先保留类型、保持空指针，观察 false；再取消动态类型，观察接口何时等于 nil。</p><div className="control-row"><label><input aria-label="包含动态类型" type="checkbox" checked={typed} onChange={e=>{setTyped(e.target.checked);setValue(false)}}/> 包含动态类型 *Problem</label><label><input aria-label="指针指向对象" type="checkbox" checked={value} disabled={!typed} onChange={e=>setValue(e.target.checked)}/> 指针指向对象</label></div>
 <div className="interface-model" data-testid="live-model" data-state={JSON.stringify({typed,value})}><div><small>动态类型</small><strong>{typed?'*Problem':'无'}</strong></div><div><small>动态值</small><strong>{!typed?'无':value?'指向对象':'nil 指针'}</strong></div>{typed&&value&&<span className="heap-object">Problem 对象</span>}</div>
 <p className={typed?'result amber':'result'} aria-live="polite">err == nil → <strong>{String(!typed)}</strong></p><p>当前赋值：<code>{!typed?'err = nil':value?'err = &Problem{}':'err = (*Problem)(nil)'}</code>。只有动态类型和动态值都为空，接口才等于 nil。</p></div>;
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
 const special=lesson.id===14?<SliceLab/>:lesson.id===24?<NilLab/>:lesson.id===6?<StringLab/>:null;
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
