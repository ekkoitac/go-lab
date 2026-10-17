import {useEffect,useMemo,useRef,useState} from 'react';
import {Player,type PlayerRef} from '@remotion/player';
import type {Lesson} from '../../content/types';
import {ChannelAnimation,movieHeight,statusLabels} from './ChannelAnimation';
import {completeJob,initialState,isReady,transition,type Action,type Config,type LabState} from './model';
import {labGuides} from '../../content/channel-guides';
import './channel-lab.css';

const FRAMES=78;
export default function ChannelLab({lesson}:{lesson:Lesson}){
  const [history,setHistory]=useState<LabState[]>(()=>[initialState(lesson.id)]),[cursor,setCursor]=useState(0);
  const [value,setValue]=useState(7),[auto,setAuto]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches),[animationFrame,setAnimationFrame]=useState(FRAMES-1),[playing,setPlaying]=useState(false),[revision,setRevision]=useState(0);
  const movieContainer=useRef<HTMLDivElement>(null),[compact,setCompact]=useState(false);
  const player=useRef<PlayerRef>(null),animateNext=useRef(false),s=history[cursor],before=history[Math.max(0,cursor-1)],guide=labGuides[lesson.id];
  const movie=useMemo(()=>({before,after:s,compact}),[before,s,compact]);
  useEffect(()=>{const el=movieContainer.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setCompact(entry.contentRect.width<440));observer.observe(el);return()=>observer.disconnect();},[]);
  const fatal=s.actors.some(a=>a.status==='panic'),full=history.length>=201;
  useEffect(()=>{
    const p=player.current;if(!p)return;
    const update=({detail}:{detail:{frame:number}})=>setAnimationFrame(detail.frame);
    const onPlay=()=>setPlaying(true),onPause=()=>setPlaying(false);
    p.addEventListener('frameupdate',update);p.addEventListener('play',onPlay);p.addEventListener('pause',onPause);p.addEventListener('ended',onPause);
    const animate=auto&&cursor>0&&animateNext.current;animateNext.current=false;
    p.seekTo(animate?0:FRAMES-1);if(animate)p.play();
    return()=>{p.removeEventListener('frameupdate',update);p.removeEventListener('play',onPlay);p.removeEventListener('pause',onPause);p.removeEventListener('ended',onPause);};
  },[cursor,revision,auto]);
  function append(next:LabState){player.current?.pause();animateNext.current=true;setHistory([...history.slice(0,cursor+1),next]);setCursor(cursor+1);setRevision(n=>n+1);}
  function act(action:Action){if(!fatal&&!full)append(transition(s,action));}
  function reset(config:Partial<Config>={}){player.current?.pause();animateNext.current=false;setHistory([initialState(lesson.id,{...s.config,...config})]);setCursor(0);setRevision(n=>n+1);}
  function seek(n:number){player.current?.pause();animateNext.current=false;setCursor(n);setRevision(v=>v+1);}
  function button(label:string,action:Action,enabled=true,reason='当前角色无法执行此操作'){
    const disabled=fatal||full||!enabled;return <button type="button" key={label} disabled={disabled} title={disabled?(fatal?'本次实验发生未恢复的 panic，请回退或重置':full?'操作记录已达 200 步，请重置':reason):undefined} onClick={()=>act(action)}>{label}</button>;
  }
  const actor=(id:string)=>s.actors.find(a=>a.id===id)!;
  const available=(id:string)=>actor(id)?.status==='ready';
  const canSelect=available('r')||(actor('r')?.status==='receive'&&actor('r')?.channel==='select');
  const ch=s.channels[0];
  const numeric=<label>发送值<input aria-label="发送值" type="number" min="-99" max="999" value={value} onChange={e=>setValue(Math.max(-99,Math.min(999,Math.trunc(Number(e.target.value))))||0)}/></label>;
  const settings=<div className="channel-settings">
    <strong>实验构造</strong><span>修改配置会开始新实验；操作回退使用下方时间线。</span>
    {[52,59,60].includes(lesson.id)&&<label>队列容量 {s.config.capacity}<input aria-label="通道容量" type="range" min="0" max="5" value={s.config.capacity} onChange={e=>reset({capacity:+e.target.value})}/></label>}
    {lesson.id===51&&<label><input type="checkbox" checked={s.config.separate} onChange={e=>reset({separate:e.target.checked})}/> 接收在另一个 goroutine 中</label>}
    {[58,59].includes(lesson.id)&&<label><input aria-label="监听取消" type="checkbox" checked={s.config.cancellable} onChange={e=>reset({cancellable:e.target.checked})}/>{lesson.id===59?'发送同时监听取消':'任务在工作边界检查取消'}</label>}
    {lesson.id===55&&<label><input type="checkbox" checked={s.config.guard} onChange={e=>reset({guard:e.target.checked})}/> 进入 select 前检查全部输入结束</label>}
    {lesson.id===57&&<label><input type="checkbox" checked={s.config.withDefault} onChange={e=>reset({withDefault:e.target.checked})}/> 保留 default 分支</label>}
    {lesson.id===60&&<label>工作者数量 {s.config.workers}<input aria-label="工作者数量" type="range" min="1" max="3" value={s.config.workers} onChange={e=>reset({workers:+e.target.value})}/></label>}
  </div>;
  return <section className="experiment-panel channel-lab" data-testid="channel-lab" data-lesson={lesson.id}>
    <div className="channel-heading"><span>CHANNEL LAB / {lesson.id}</span><h3>{guide.title}</h3><p>{guide.challenge}</p></div>
    <details className="channel-challenge" open><summary>本课实验路线</summary><ol>{guide.steps.map(x=><li key={x}>{x}</li>)}</ol></details>
    {settings}
    <div className="channel-movie" ref={movieContainer} data-testid="channel-animation" data-frame={animationFrame}>
      <Player key={revision} ref={player} component={ChannelAnimation} inputProps={movie} durationInFrames={FRAMES} fps={30} compositionWidth={compact?400:800} compositionHeight={movieHeight(s,compact)} style={{width:'100%'}} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} moveToBeginningWhenEnded={false}/>
    </div>
    <div className="channel-playback">
      <button className="ghost" aria-label="重播本步动画" onClick={()=>{player.current?.seekTo(0);player.current?.play();}}>重播本步</button>
      <button className="ghost" aria-label={playing?'暂停动画':'播放动画'} onClick={()=>{if(playing)player.current?.pause();else{if(animationFrame>=FRAMES-1)player.current?.seekTo(0);player.current?.play();}}}>{playing?'暂停':'播放'}</button>
      <input aria-label="本步动画进度" type="range" min="0" max={FRAMES-1} value={animationFrame} onChange={e=>{player.current?.pause();player.current?.seekTo(+e.target.value);}}/>
      <label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/> 操作后播放</label>
    </div>
    <div className="channel-result" aria-live="polite"><strong>{s.label}</strong><p>{s.detail}</p><code>{s.code}</code></div>
    <h4>安排下一次操作</h4>
    <div className="channel-actions">
      {[51,52,54,59].includes(lesson.id)&&<>
        {lesson.id!==52&&numeric}
        {button(lesson.id===52?`发送 ${s.next}`:'发送',{type:'send',value:lesson.id===52?s.next:value},available('p'))}
        {button('接收',{type:'receive',actor:s.actors.some(a=>a.id==='r')?'r':'p'},available(s.actors.some(a=>a.id==='r')?'r':'p'))}
        {lesson.id===51&&button('完成接收方业务',{type:'finish',actor:s.config.separate?'r':'p'},actor(s.config.separate?'r':'p').status==='working')}
        {[52,54].includes(lesson.id)&&button('协调者关闭通道',{type:'close',actor:'env'},!ch.closed)}
        {lesson.id===59&&<>{button('下游提前退出',{type:'leave',actor:'r'},available('r'))}{button('发出取消',{type:'cancel'},!s.cancelled)}{button('响应取消',{type:'work',actor:'p'},s.cancelled&&s.config.cancellable&&available('p'))}{button('清理上游并退出',{type:'cleanup'},actor('p').status==='cleanup')}</>}
      </>}
      {lesson.id===53&&<>{numeric}{['p','b'].map(id=><div className="channel-role" key={id}><b>{actor(id).name}</b>{button(`${id==='p'?'A':'B'} 发送`,{type:'send',actor:id,value},available(id))}{button(`${id==='p'?'A':'B'} 结束`,{type:'finish',actor:id},available(id))}</div>)}{button('接收',{type:'receive',actor:'r'},available('r'))}{button('接收方提前关闭',{type:'close',actor:'r'},available('r'))}{button('协调者等待并关闭',{type:'close',actor:'c'},available('c'))}</>}
      {[55,56].includes(lesson.id)&&<>
        <p className="channel-inline-note">亮起的分支当前可执行。选择按钮用于探索合法结果，不给真实 select 设定优先级。</p>
        {s.channels.map(c=><div className="channel-role" key={c.id}><b>{c.name}：{c.nil?'已禁用':isReady(c)?'已就绪':'未就绪'}</b>
          {button(`选择 ${c.id.toUpperCase()} 分支`,{type:'select',branch:c.id},isReady(c)&&canSelect,'分支未就绪，或当前 goroutine 无法继续')}
          {!(lesson.id===56&&c.id==='b')&&button(`向 ${c.id.toUpperCase()} 放入数据`,{type:'supply',channel:c.id},!c.nil&&!c.closed&&c.queue.length<c.capacity)}
          {button(lesson.id===56&&c.id==='b'?'触发取消':`关闭 ${c.id.toUpperCase()}`,{type:'close',actor:'env',channel:c.id},!c.nil&&!c.closed)}
          {lesson.id===55&&button(`${c.id.toUpperCase()} 设为 nil`,{type:'nil',channel:c.id},!c.nil&&available('r'))}
          {lesson.id===55&&c.nil&&button(`直接接收 nil ${c.id.toUpperCase()}`,{type:'receive',actor:'r',channel:c.id},available('r'))}
        </div>)}
        {button('执行下一次 select',{type:'select'},!s.channels.some(isReady)&&canSelect)}
        {lesson.id===56&&<button className="ghost" onClick={()=>{const fresh=initialState(56,s.config);fresh.channels.forEach(c=>{c.closed=false;c.queue=[];});fresh.label='两个分支都未就绪';setHistory([fresh]);setCursor(0);setRevision(n=>n+1);}}>以未就绪状态重建</button>}
      </>}
      {lesson.id===57&&<>{button('执行一轮循环',{type:'poll'},available('r'))}{button('发送一条消息',{type:'send',value:s.next},available('p')&&ch.queue.length<ch.capacity)}{button('发出取消',{type:'cancel'},!s.cancelled)}</>}
      {lesson.id===58&&<>{button('发出取消',{type:'cancel'},!s.cancelled)}{['p','b'].map(id=><div className="channel-role" key={id}><b>{actor(id).name}</b>{button(`${actor(id).name}推进一步`,{type:'work',actor:id},['ready','working'].includes(actor(id).status))}{button(`${actor(id).name}清理并退出`,{type:'cleanup',actor:id},actor(id).status==='cleanup')}</div>)}</>}
      {lesson.id===60&&<>
        {button(`提交任务 ${s.next}`,{type:'submit'},available('p'))}
        {button('停止提交并关闭 jobs',{type:'close'},available('p')&&!ch.closed)}
        {s.actors.filter(a=>a.id.startsWith('w')).map(a=><div className="channel-role" key={a.id}><b>{a.name}</b>{button(`${a.name} 取任务`,{type:'take',actor:a.id},available(a.id))}<button disabled={fatal||full||a.status!=='working'} onClick={()=>append(completeJob(s,a.id))}>{a.name} 完成任务</button></div>)}
      </>}
    </div>
    {fatal&&<p className="channel-warning">未恢复的 panic 会终止程序。本次实验已停止，请回退到错误前，或重置后尝试修复路径。</p>}
    {full&&<p className="channel-warning">已记录 200 次操作。请重置后开始新实验。</p>}
    <div className="channel-inspector" data-testid="live-model" data-state={JSON.stringify(s)}>
      <h4>本步完成后的状态</h4>
      <div className="channel-actors">{s.actors.map(a=><article key={a.id} data-status={a.status}><strong>{a.name}<span>{statusLabels[a.status]}</span></strong><code>{a.line}</code></article>)}</div>
      {s.channels.map(c=><div className="channel-queue" key={c.id}><strong>{c.name} · {c.nil?'nil':c.closed?'已关闭':'开放'}</strong><span>{c.nil?'变量未引用通道 · len 0 / cap 0':`缓冲 [${c.queue.join(', ')}] · len ${c.queue.length} / cap ${c.capacity}`}</span></div>)}
      {!!s.channels.length&&<><p className="receive-result">最近一次接收：{s.receipts.length?`value=${s.receipts.at(-1)!.value} · ok=${s.receipts.at(-1)!.ok}`:'尚无结果'}</p><p className="receive-count">已完成接收 {s.receipts.length} 次</p><div className="channel-receipts">{s.receipts.slice(-12).map((r,i)=><span key={s.receipts.length-12+i} className={r.ok?'':'end'}>{r.value} / {String(r.ok)}</span>)}</div></>}
      {lesson.id===57&&<p>执行轮次 {s.rounds} · default 空转 {s.defaults} 次 · 处理消息 {s.receipts.length} 条</p>}
      {lesson.id===58&&<p>取消通知：{s.cancelled?'已发出':'未发出'} · 已退出 {s.actors.filter(a=>a.status==='done').length} / 2 · 工作单元 {s.work}</p>}
      {lesson.id===59&&<p>上游：{actor('p').status==='send'&&actor('r').status==='done'?'下游已退出，发送无法完成；存在泄漏':actor('p').status==='done'?'已收到退出确认':'尚未确认退出'}</p>}
      {lesson.id===60&&<p>活跃任务 {s.actors.filter(a=>a.status==='working').length} / {s.config.workers} · 并发峰值 {s.peak}<br/>完成顺序：{s.completed.join(' → ')||'尚无'}<br/>退出 worker：{s.actors.filter(a=>a.id.startsWith('w')&&a.status==='done').length} / {s.config.workers}</p>}
    </div>
    <div className="channel-history"><h4>你的执行时间线 <small>{cursor} / {history.length-1} 步</small></h4>
      <div className="control-row"><button className="ghost" disabled={!cursor} onClick={()=>seek(cursor-1)}>回退一步</button><button className="ghost" disabled={cursor===history.length-1} onClick={()=>seek(cursor+1)}>前进一步</button><button className="ghost" onClick={()=>reset()}>重置</button></div>
      <input aria-label="操作时间线" type="range" min="0" max={history.length-1} value={cursor} onChange={e=>seek(+e.target.value)}/>
      <p>回退后执行新操作，会从当前位置建立新的路径。动画拖动仅回看本步过程。</p>
      <ol>{history.map((h,i)=><li key={i}><button className={i===cursor?'':'ghost'} aria-current={i===cursor?'step':undefined} onClick={()=>seek(i)}>{i}. {h.label}</button></li>)}</ol>
    </div>
    <p className="channel-boundary">模型边界：{guide.boundary} 这是本地教学模拟；真实 Go 行为可在右侧编辑器验证。实验不会改写代码或学习成绩。</p>
  </section>;
}
