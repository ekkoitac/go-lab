import {useState} from 'react';
import {back,defaults,initial,inspect,stages,step,type Config,type Snapshot} from './model';
import './style.css';
function Board({config,state}:{config:Config;state:Snapshot}) {
  const scale=Math.max(config.capacity,state.total);
  return <div className="db131-board">
    <div className="db131-pools" aria-label={`${state.replicas}个独立连接池，各自上限${config.pool}`}>
      {Array.from({length:state.replicas},(_,i)=><div key={i}><span>实例 {i+1}</span><strong>{config.pool}</strong><small>独立 sql.DB 上限</small></div>)}
    </div>
    <div className="db131-arrow">↓ 所有池上限相加：{state.replicas} × {config.pool} = {state.poolCeiling}</div>
    <div className="db131-meter" role="img" aria-label={`业务上限${state.poolCeiling}，预留${config.reserve}，数据库容量${config.capacity}`}>
      <span style={{width:`${state.poolCeiling/scale*100}%`}} className="db131-business"/><span style={{width:`${config.reserve/scale*100}%`}} className="db131-reserve"/>
      <i style={{left:`${Math.min(99.5,config.capacity/scale*100)}%`}}/>
    </div>
    <p>蓝色：业务池上限 {state.poolCeiling}　橙色：预留 {config.reserve}　竖线：数据库上限 {config.capacity}</p>
    <div className="db131-metrics"><div>全局配置总上限<strong>{state.total}</strong></div><div>{state.over?'超预算':'剩余预算'}<strong>{state.over||state.headroom}</strong></div><div>本地等待请求（模型）<strong>{state.localWaiting}</strong></div></div>
    <p className={state.over?'db131-danger':'db131-ok'}>{state.over?`业务池配置超过可用预算 ${state.over}；同时用满时无法全部建立连接。`:'配置在容量预算内；这不保证请求没有排队。'}</p>
  </div>;
}
function NumberControl({label,value,min=0,max,onChange}:{label:string;value:number;min?:number;max:number;onChange:(n:number)=>void}){return <label>{label}<input type="number" min={min} max={max} value={value} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=min&&n<=max)onChange(n);}}/></label>;}
export default function Lab(){
  const [timeline,setTimeline]=useState(()=>initial());
  const [prediction,setPrediction]=useState('');const [reason,setReason]=useState('');
  const {config,stage,runs}=timeline;const state=inspect(config,stage);const last=runs.at(-1);
  const configure=(key:keyof Config,value:number)=>{setTimeline(initial({...config,[key]:value}));setPrediction('');setReason('');};
  const canStep=stage<3&&prediction.trim()!==''&&Number.isInteger(Number(prediction))&&Number(prediction)>=0&&reason.trim().length>0;
  return <section className="db131" data-testid="database-lab-131">
    <h3>连接池预算调度台</h3><p>让每个进程独立扩池，观察全局账单怎样变化。目标：在发布峰值守住预算，再解释本地等待的代价。</p>
    <div className="db131-controls">
      <NumberControl label="目标副本" value={config.replicas} min={1} max={24} onChange={v=>configure('replicas',v)}/>
      <NumberControl label="发布额外副本 surge" value={config.surge} max={8} onChange={v=>configure('surge',v)}/>
      <NumberControl label="每池上限（正数）" value={config.pool} min={1} max={60} onChange={v=>configure('pool',v)}/>
      <NumberControl label="其他服务与运维预留" value={config.reserve} max={240} onChange={v=>configure('reserve',v)}/>
      <NumberControl label="每副本同时借连接请求" value={config.demand} max={80} onChange={v=>configure('demand',v)}/>
    </div><small>改参数将回到原有 6 副本并清空本轮记录。数据库容量固定为 240。</small>
    <div data-testid="live-model" data-state={JSON.stringify({stage,...state,config})}><h4>阶段 {stage+1}/4：{stages[stage]}</h4><Board config={config} state={state}/></div>
    <div className="db131-predict"><h4>{stage<3?`先预测下一步：${stages[stage+1]}`:'本轮结束：试着缩池，再走一轮'}</h4>
      <label>下一步全部池上限 + 预留 = ?<input type="number" min="0" value={prediction} disabled={stage===3} onChange={e=>setPrediction(e.target.value)}/></label>
      <label>理由（包含副本数或计算式）<textarea value={reason} disabled={stage===3} onChange={e=>setReason(e.target.value)} placeholder="把 surge 和预留分别算在哪里？"/></label>
      <div className="db131-actions"><button data-db-action="step" disabled={!canStep} onClick={()=>{setTimeline(step(timeline,{total:Number(prediction),reason}));setPrediction('');setReason('');}}>记录预测并单步</button><button data-db-action="back" disabled={stage===0} onClick={()=>{setTimeline(back(timeline));setPrediction('');setReason('');}}>回退一步</button><button data-db-action="reset" onClick={()=>{setTimeline(initial());setPrediction('');setReason('');}}>重置基线</button></div>
    </div>
    {last&&<div className="db131-feedback" role="status"><strong>{last.prediction.total===last.actual.total?'数值一致':'预测需要修正'}：预测 {last.prediction.total}，实际配置上限 {last.actual.total}</strong><p>你的理由：{last.prediction.reason}</p><p>本步证据：{last.actual.replicas} 个池 × {config.pool} + 预留 {config.reserve} = {last.actual.total}。{last.actual.over?'缩小单池或增加已验证的容量；扩副本会叠加池上限。':'继续检查发布峰值；容量安全与等待时间是两个问题。'}</p><p>按本轮发布峰值计算，单池预算至多 {state.safePerPool}；如果为 0，当前副本与预留约束下没有正数池上限方案。</p></div>}
    <p className="db131-note">模型边界：每实例只有一个 sql.DB，连接按需建立；图中是配置上限，不是实时连接数。本地等待 = 副本数 × max(每副本请求 − 单池上限, 0)，假设请求均匀、每请求借 1 条且尚未释放，不模拟数据库拒绝后的额外等待。未实测吞吐、延迟或 P99。嵌套借连接、长事务仍需单独排查。本练习不计正式成绩。</p>
  </section>;
}
export function Help({mode}:{mode:string}){
  const [pool,setPool]=useState(15);const [surge,setSurge]=useState(3);const [reserve,setReserve]=useState(60);const [part,setPart]=useState(0);
  const config={...defaults,pool,surge,reserve};const result=inspect(config,2);
  const steps=['先列所有独立 sql.DB；同一进程有多个池也要相加。','按最大同时存活副本计算：目标副本 + 发布 surge。','扣除其他服务和运维预留，再除以峰值副本数并向下取整。','用等待增量、事务时长和数据库负载验证；容量算式不能给出 P99。'];
  return <section className="db131 db131-help" data-testid="database-help-131">
    {mode==='example'?<><h3>同一预算，三个方案</h3><p>240 个位置中预留 60；每副本同一时刻有 20 个请求。点击方案比较全局容量和局部等待。</p><div className="db131-actions">{[30,15,12].map(n=><button key={n} aria-pressed={pool===n} onClick={()=>setPool(n)}>每池 {n}</button>)}</div><Board config={config} state={result}/><p>15 × 15 + 60 = 285，稳态 12 副本时可行的每池 15，在额外 3 副本发布期间会超额。每池 12 可守住发布预算，但本地请求等待增加。</p></>:mode==='diagram'?<><h3>从单池到全局的关系图</h3><NumberControl label="改变单池上限，追踪总和" value={pool} min={1} max={40} onChange={setPool}/><Board config={config} state={result}/><p>每个实例独立限制 → 各池上限相加 → 加预留 → 对照数据库容量。增加 1 个单池名额，会让 {result.replicas} 个池的总上限增加 {result.replicas}。</p></>:mode==='steps'?<><h3>按约束一步步推导</h3><ol>{steps.slice(0,part+1).map((s,i)=><li key={s}><strong>第 {i+1} 步：</strong>{s}</li>)}</ol>{part>=2&&<p>本例：(240 − 60) ÷ (12 + 3) = 12 个/池。</p>}<button disabled={part===3} onClick={()=>setPart(part+1)}>展开下一项检查</button><button disabled={part===0} onClick={()=>setPart(part-1)}>回看上一步</button></>:<><h3>换输入：保住发布峰值预算</h3><p>目标副本仍为 12。改变预留或 surge，再寻找最大的正数单池上限。这是提示内练习，不计正式成绩。</p><div className="db131-controls"><NumberControl label="预留连接" value={reserve} max={240} onChange={setReserve}/><NumberControl label="额外副本 surge" value={surge} max={8} onChange={setSurge}/><NumberControl label="你分配的单池上限" value={pool} min={1} max={60} onChange={setPool}/></div><Board config={config} state={result}/><p>{result.safePerPool===0?'预算已无法给每池分配 1 条；需要改变副本或预留约束。':result.over?`还超出 ${result.over}，试着缩小每池上限。`:pool===result.safePerPool?'已找到整数预算边界；再增 1 会怎样？':`仍有 ${result.headroom} 个全局预算；能否再给每池增加 1？`}</p></>}
    <p className="db131-note">这些数值来自确定性教学模型，不是连接实际占用或性能实测。辅助探索不产生独立掌握记录。</p>
  </section>;
}
