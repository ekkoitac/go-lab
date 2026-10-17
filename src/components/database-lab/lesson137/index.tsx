import {useId,useState} from 'react';
import {baseline,contractMet,strategyNames,trace,type Config,type Outcome,type Snapshot,type Strategy} from './model';
import './style.css';
const outcomeNames:Record<Outcome,string>={fresh:'新昵称 v9',stale:'旧昵称 v8',failed:'明确失败'};
function Network({s}:{s:Snapshot}){
 return <div className="db137-network" aria-label="主库副本与客户端的状态关系">
  <div className={s.route==='primary'?'db137-node active':'db137-node'}><span>主库</span><strong>位点 {s.primary}</strong><small>{s.primary===9?'新昵称':'旧昵称'}</small></div>
  <div className="db137-link">↓ 异步复制 {s.replica<s.primary?'尚未应用':'已追上'}</div>
  <div className={s.route==='replica'?'db137-node active':'db137-node'}><span>只读副本</span><strong>位点 {s.replica}</strong><small>{s.replica===9?'新昵称':'旧昵称'}</small></div>
  <div className="db137-link">{s.route==='primary'?`主库 → 客户端：${s.returned!==null?`直接返回 v${s.returned}`:'直接读取，绕过副本'}`:s.route==='waiting'?'客户端等待；尚未返回任何值':s.route==='replica'?`副本 → 客户端：${s.returned!==null?`返回 v${s.returned}`:'请求读取'}`:s.outcome==='failed'?'返回明确失败，不携带旧值':'客户端尚未发起读取'}</div>
  <div className="db137-node"><span>客户端写后位点</span><strong>{s.token??'尚未写入'}</strong><small>返回值：{s.outcome?outcomeNames[s.outcome]:'尚未返回'}</small></div>
 </div>;
}
function NumberControl({label,value,max,onChange}:{label:string;value:number;max:number;onChange:(v:number)=>void}){const id=useId();return <label htmlFor={id}>{label} <output>{value}ms</output><input id={id} type="range" min="0" max={max} step="100" value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;}
function Experiment({practice=false}:{practice?:boolean}){
 const [config,setConfig]=useState<Config>(practice?{...baseline,delay:4000,strategy:'sleep',window:1000}:baseline);
 const [cursor,setCursor]=useState(0);const [prediction,setPrediction]=useState<Outcome|''>('');const [reason,setReason]=useState('');const [locked,setLocked]=useState(false);
 const frames=trace(config);const s=frames[cursor];const id=useId();
 function reset(){setCursor(0);setPrediction('');setReason('');setLocked(false);}
 function change(patch:Partial<Config>){setConfig(c=>({...c,...patch}));reset();}
 return <div className="db137-experiment">
 <p>{practice?'迁移练习：头像保存后 4 秒才复制完成。试着找到既不返回旧值，又能控制等待的路由。':'任务：保存昵称后立即打开自己的详情。先预测返回值，再执行并用位点解释结果。'}</p>
 <div className="db137-controls">
  <label>请求承诺<select value={config.request} onChange={e=>change({request:e.target.value as Config['request']})}><option value="detail">自己的写后详情：至少 v9</option><option value="list">普通列表：允许短时陈旧</option></select></label>
  <label>详情路由策略<select value={config.strategy} onChange={e=>change({strategy:e.target.value as Strategy})}>{Object.entries(strategyNames).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <NumberControl label="副本应用延迟" value={config.delay} max={6000} onChange={delay=>change({delay})}/>
  <NumberControl label="详情到达时刻" value={config.readAt} max={6000} onChange={readAt=>change({readAt})}/>
  {(config.strategy==='wait-primary'||config.strategy==='wait-fail')&&<NumberControl label="等位点预算" value={config.budget} max={5000} onChange={budget=>change({budget})}/>}
  {(config.strategy==='sleep'||config.strategy==='sticky')&&<NumberControl label={config.strategy==='sleep'?'固定 sleep 时长':'粘主窗口（从提交起）'} value={config.window} max={5000} onChange={window=>change({window})}/>}
 </div>
 {config.request==='list'&&<p className="db137-notice">列表独立走副本；上方详情策略不用于列表。本模型延迟最大 6 秒，仅演示允许短时陈旧，不代表无限容忍陈旧。</p>}
 <fieldset className="db137-prediction" disabled={locked}><legend>执行前预测</legend><div className="db137-options">{(Object.keys(outcomeNames) as Outcome[]).map(o=><label key={o}><input type="radio" name={id} checked={prediction===o} onChange={()=>setPrediction(o)}/>{outcomeNames[o]}</label>)}</div><label>我的理由<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="比较读请求时刻、副本应用时刻和等待预算……"/></label></fieldset>
 <div className="db137-actions"><button type="button" disabled={cursor===0} data-db-action="back" onClick={()=>{if(cursor===1)setLocked(false);setCursor(c=>Math.max(0,c-1));}}>回退一步</button><button type="button" data-db-action="step" disabled={cursor===3||(!locked&&(!prediction||!reason.trim()))} onClick={()=>{setLocked(true);setCursor(c=>Math.min(3,c+1));}}>{cursor===0?'锁定预测并提交写入':cursor===1?'发起读取':'推进至返回'}</button><button type="button" data-db-action="reset" onClick={reset}>重置本次</button></div>
 {!locked&&(!prediction||!reason.trim())&&<small>选择预测并写下理由后开始；本实验不计入正式测验成绩。</small>}
 <div data-testid="live-model" data-state={JSON.stringify(s)} className="db137-live">
  <div className="db137-clock">模型时钟 <strong>{s.time}ms</strong> · 第 {cursor}/3 步</div><Network s={s}/>
  <ol className="db137-timeline">{frames.slice(0,cursor+1).map((f,i)=><li key={i}><b>t={f.time}ms</b> {f.note}</li>)}</ol>
 </div>
 <div className="db137-feedback" role="status">{s.outcome?<><strong>{prediction===s.outcome?'预测吻合':'预测需要修正'}：实际为{outcomeNames[s.outcome]}。</strong><p>{s.note}</p><p>你的理由：{reason}</p><p>{contractMet(config,s)?s.outcome==='failed'?'保住一致性承诺，但牺牲了本次可用性。':'本次满足所选请求承诺。':'详情需要位点 9，读到了位点 8。可提高等待预算，或超时回主库。'} {config.strategy==='sleep'||config.strategy==='sticky'?'固定时长依赖复制延迟上界；把延迟拉到窗口之外再验证。':''}</p></>:s.note}</div>
 <p className="db137-boundary">模型边界：单主单副本、一次写入；位点简化为版本号。主库可用，读取与网络耗时记为 0；同一时刻先应用复制再读取。粘主窗口从提交起计，窗口外读副本；跨设备若不传写后位点，也无法获得本模型的详情保证。</p>
 </div>;
}
export default function Lab(){return <section className="db137" data-testid="database-lab-137"><h3>追上哪次写入，才能放心返回？</h3><Experiment/></section>;}
function Relationship(){const [target,setTarget]=useState<'detail'|'list'>('detail');return <><p>切换请求，追踪同一次 v9 提交的两条读取路径。</p><div className="db137-actions"><button aria-pressed={target==='detail'} onClick={()=>setTarget('detail')}>自己的详情</button><button aria-pressed={target==='list'} onClick={()=>setTarget('list')}>公开列表</button></div><svg className="db137-svg" viewBox="0 0 320 340" role="img" aria-label={target==='detail'?'详情携带位点9，检查副本，不足则等待或回主库':'列表无需本次写后位点，直接读副本8'}><defs><marker id="db137-help-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#477a84"/></marker></defs><g fill="#f1f8fa" stroke="#98bac3"><rect x="60" y="10" width="200" height="48" rx="10"/><rect x="60" y="103" width="200" height="48" rx="10"/><rect x="60" y="197" width="200" height="48" rx="10"/><rect x="30" y="288" width="260" height="42" rx="10"/></g><g stroke="#477a84" strokeWidth="2" markerEnd="url(#db137-help-arrow)"><path d="M160 58V101"/><path d="M160 151V195"/><path d="M160 245V286"/></g><g fill="#244950" textAnchor="middle" fontSize="13"><text x="160" y="39">主库提交 v9 → 写后位点 9</text><text x="160" y="83">{target==='detail'?'详情携带最低位点 9':'普通列表允许短时旧值'}</text><text x="160" y="132">{target==='detail'?'检查副本 applied ≥ 9 ?':'直接读取副本'}</text><text x="160" y="176">{target==='detail'?'不足：等位点 / 回主库':'此时副本仍为 v8'}</text><text x="160" y="226">{target==='detail'?'返回 v9，或超时明确失败':'返回 v8（旧昵称）'}</text><text x="160" y="272">请求级一致性承诺</text><text x="160" y="315">{target==='detail'?'绝不把旧值伪装成满足位点要求':'允许陈旧 ≠ 保存失败'}</text></g></svg></>;}
export function Help({mode}:{mode:string}){
 const [step,setStep]=useState(0);const [tail,setTail]=useState(false);
 const example=trace({...baseline,strategy:'sleep',delay:tail?4000:500,window:1000});
 const guided=trace({...baseline,strategy:'wait-primary',budget:1000});
 return <section className="db137 db137-help" data-testid="database-help-137">
 {mode==='example'?<><h4>反例：固定等一秒就够吗？</h4><button type="button" onClick={()=>setTail(v=>!v)}>{tail?'恢复正常复制 500ms':'注入长尾复制 4000ms'}</button><p>同样在 t=100ms 发起读取，sleep 1000ms，返回时刻都是 1100ms。</p><Network s={example[3]}/><p>{example[3].note} 单个正常样本不能证明固定等待总是安全。</p></>:mode==='diagram'?<Relationship/>:mode==='steps'?<><h4>证据链：等待超时为什么回主库？</h4><Network s={guided[step]}/><p role="status">{guided[step].note}</p><div className="db137-actions"><button disabled={step===0} onClick={()=>setStep(s=>s-1)}>上一步</button><button disabled={step===3} onClick={()=>setStep(s=>s+1)}>下一条证据</button><button onClick={()=>setStep(0)}>重新追踪</button></div><p>副本 t=2000ms 才应用，读取 t=100ms 开始，预算 1000ms。到 t=1100ms 不够位点 9，回主库返回。</p></>:<><h4>换情境：头像更新</h4><p>这是有提示练习，不计入独立掌握成绩。</p><Experiment practice/></>}
 </section>;
}
