import {useId, useState} from 'react';
import {advance, baseline, initial, providers, type Config, type State} from './model';
import './style.css';

const verdict = {accepted:'接受订单', rejected:'拒绝订单', blocked:'无法通过接口检查'};
function Graph({state, packages=false}: {state: State; packages?: boolean}) {
 const marker=useId().replace(/:/g,'');
 return <svg className="eg97-graph" viewBox="0 0 360 285" role="img" aria-label={packages?'包导入依赖图，箭头表示导入':'运行时调用图，箭头表示方法调用'}>
  <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor"/></marker></defs>
  {packages ? <>
   <path d="M180 56 L87 110 M180 56 L273 110" markerEnd={`url(#${marker})`} className="eg97-edge"/>
   {state.design==='internal'&&<path d="M169 140H191" markerEnd={`url(#${marker})`} className="eg97-edge"/>}
   <rect x="90" y="12" width="180" height="44"/><text x="180" y="40">main 组装包</text>
   <rect x="5" y="112" width="164" height="60"/><text x="87" y="136">order 业务包</text><text x="87" y="158">{state.design==='injected'?(state.contract==='small'?'定义 Stock 接口':'定义 Store 接口'):'直接构造仓库'}</text>
   <rect x="191" y="112" width="164" height="60"/><text x="273" y="136">storage 实现包</text><text x="273" y="158">提供具体方法</text>
   <text x="180" y="210">箭头 = 源码 import 依赖</text>
   <text x="180" y="240">{state.design==='injected'?'业务不导入 storage':'业务直接导入具体存储包'}</text>
   {state.design==='injected'&&<text x="180" y="265">隐式满足接口，无需声明关系</text>}
  </> : <>
   <rect x="70" y="12" width="220" height="44"/><text x="180" y="40">available：判断能否下单</text>
   {(Object.keys(providers) as Array<keyof typeof providers>).map((provider,index)=>{const x=60+index*120;const active=state.actual===provider;return <g key={provider} className={active?'eg97-active':''}>
    <path d={`M180 56 L${x} 126`} markerEnd={active?`url(#${marker})`:undefined} className={active?'eg97-edge':'eg97-unused'}/>
    <rect x={x-53} y="130" width="106" height="78"/><text x={x} y="153">{provider}</text><text x={x} y="176">Count()</text>{provider==='warehouse'&&<text x={x} y="198">+ Save()</text>}
   </g>;})}
   <text x="180" y="240">{state.actual?`实线调用：${state.actual}.Count()`:'虚线为候选，尚未发生调用'}</text><text x="180" y="266">箭头 = 方法调用，不代表 import</text>
  </>}
 </svg>;
}
export default function Lesson97() {
  const [history,setHistory]=useState<State[]>([initial()]); const state=history[history.length-1];
  const [prediction,setPrediction]=useState(''); const [reason,setReason]=useState('');
  const [locked,setLocked]=useState(false); const [packages,setPackages]=useState(false);
  const configure=(patch: Partial<Config>)=>{setHistory([initial({...state,...patch})]);setLocked(false);setPrediction('');setReason('');};
  const reset=()=>{setHistory([initial(baseline)]);setLocked(false);setPrediction('');setReason('');};
  return <section className="eg97" data-testid="engineering-lab-97">
    <header><span className="eg97-kicker">依赖搭建 × 调用追踪</span><h3>同一条下单规则，到底读了谁的库存？</h3><p>订单需要库存不少于订购量。连接一种实现，追踪调用，再判断更换存储是否真的影响了业务。</p></header>
    <div className="eg97-controls">
      <label>业务连接方式<select value={state.design} onChange={e=>configure({design:e.target.value as Config['design']})}><option value="internal">内部固定创建 warehouse</option><option value="injected">从调用者注入接口</option></select></label>
      <label>调用者选择的实现<select value={state.provider} onChange={e=>configure({provider:e.target.value as Config['provider']})}>{Object.entries(providers).map(([key,p])=><option value={key} key={key}>{p.label} · 库存 {p.count}</option>)}</select></label>
      <label>消费方要求的能力<select value={state.contract} disabled={state.design==='internal'} onChange={e=>configure({contract:e.target.value as Config['contract']})}><option value="small">Stock：只需 Count()</option><option value="wide">Store：Count() + Save()</option></select></label>
      <label>订购量：{state.quantity}<input aria-label="订购量" type="range" min="1" max="8" value={state.quantity} onChange={e=>configure({quantity:Number(e.target.value)})}/></label>
    </div>
    <p className="eg97-note">测试替身和 HTTP 适配器只有 Count；仓库还有 Save。改变配置会开始新一轮。HTTP 库存 0 是固定实验输入，不发起网络请求。</p>
    <div className="eg97-predict"><label>先预测结果<select aria-label="预测结果" disabled={locked} value={prediction} onChange={e=>setPrediction(e.target.value)}><option value="">请选择</option><option value="accepted">接受订单</option><option value="rejected">拒绝订单</option><option value="blocked">无法通过接口检查</option></select></label><label>预测理由<textarea disabled={locked} value={reason} onChange={e=>setReason(e.target.value)} placeholder="哪个实现会被调用？它满足接口吗？"/></label><button data-eg-action="commit" disabled={locked||!prediction||!reason.trim()} onClick={()=>setLocked(true)}>锁定预测</button></div>
    <div className="eg97-tabs"><button aria-pressed={!packages} onClick={()=>setPackages(false)}>运行时调用</button><button aria-pressed={packages} onClick={()=>setPackages(true)}>包导入依赖</button></div>
    <div className="eg97-model" data-testid="live-model" data-state={JSON.stringify(state)}><Graph state={state} packages={packages}/><div className="eg97-stats"><span>阶段 <b>{['待绑定','已绑定','已读库存','结果已确认'][state.phase]}</b></span><span>读到库存 <b>{state.count??'尚未读取'}</b></span><span>订单结果 <b>{state.result?verdict[state.result]:'尚未判断'}</b></span></div></div>
    <p className="eg97-feedback" aria-live="polite">{state.reason}</p>
    {state.result&&<p className="eg97-feedback">{prediction===state.result?'预测与结果一致。':'预测与结果不同。'} 你预测「{verdict[prediction as keyof typeof verdict]}」，理由是「{reason}」。{state.result==='blocked'?'尝试将接口缩小为 Count，再运行同一实现。':'保留订购量，只切换连接方式或实现，比较调用路径。'}</p>}
    <div className="eg97-actions"><button data-eg-action="step" disabled={!locked||state.phase===3} onClick={()=>setHistory([...history,advance(state)])}>单步执行</button><button data-eg-action="back" disabled={history.length===1} onClick={()=>setHistory(history.slice(0,-1))}>回退一步</button><button data-eg-action="reset" onClick={reset}>重置实验</button></div>
    <p className="eg97-note">小接口由消费方需求决定；Go 以方法集隐式满足接口。单一实现且没有隔离或替换需求时，直接使用具体类型也合理。此处库存只读，不模拟扣减、并发或远程失败。</p>
  </section>;
}

function Transfer() {
  const [provider,setProvider]=useState<Config['provider']>('remote'); const [choice,setChoice]=useState(''); const [reason,setReason]=useState(''); const [revealed,setRevealed]=useState(false);
  let s=initial({design:'injected',provider,quantity:2,contract:'small'}); for(let i=0;i<3;i++)s=advance(s);
  return <><h4>换成预订服务：需要 2 件库存</h4><p>服务通过仅含 Count 的接口注入。挑一个实现，先推导能否接受预订。</p><label>注入实现<select value={provider} onChange={e=>{setProvider(e.target.value as Config['provider']);setRevealed(false);setChoice('');setReason('');}}>{Object.entries(providers).map(([key,p])=><option key={key} value={key}>{p.label} · 库存 {p.count}</option>)}</select></label><label>我的预测<select disabled={revealed} value={choice} onChange={e=>setChoice(e.target.value)}><option value="">请选择</option><option value="accepted">接受预订</option><option value="rejected">拒绝预订</option></select></label><label>为什么<textarea disabled={revealed} value={reason} onChange={e=>setReason(e.target.value)}/></label><button disabled={!choice||!reason.trim()||revealed} onClick={()=>setRevealed(true)}>验证预订</button>{revealed&&<p aria-live="polite">{choice===s.result?'推导一致':'需要修正'}：调用 {provider}.Count 得到 {s.count}；{s.reason} 业务无需导入具体实现包。你的理由：{reason}</p>}<p className="eg97-note">这是可重试的帮助练习，不计入独立测验。</p></>;
}
export function Help({mode}:{mode:string}) {
  return <section className="eg97 eg97-help" data-testid="engineering-help-97">
    {mode==='example'?<><h4>测试替身为什么没起作用？</h4><p>订购 4 件，测试传入库存 3。如果函数仍执行 warehouse&#123;&#125;.Count()，读到 99，订单反而被接受。参数存在不代表依赖已注入。</p><pre>{'type Stock interface { Count() int }\nfunc available(s Stock, n int) bool {\n    return s.Count() >= n\n}\n// available(fake{}, 4) → false'}</pre><p>替换发生在调用者组装处；业务保留同一条比较规则。只有 Count 的替身能满足 Stock，无需实现业务没有用到的 Save。</p></>:mode==='diagram'?<><h4>两种箭头回答两种问题</h4><Graph packages state={initial({...baseline,design:'injected'})}/><Graph state={advance(initial({...baseline,design:'injected'}))}/><p>上图追踪源码 import；下图追踪运行时方法调用。动态调用到 fake 并不要求业务源码导入 fake 所在包。组装包知道具体实现；方法集匹配即可满足接口。</p></>:mode==='steps'?<><h4>按证据诊断依赖是否可替换</h4><ol><li>先圈出业务实际需要的方法：这里只读 Count。</li><li>在业务消费方声明这个小接口，让函数接收它。</li><li>在组装处选择 fake / warehouse / remote 并传入。</li><li>确认业务函数里没有重新构造 warehouse。</li><li>固定订购量 4：fake 应拒绝、warehouse 应接受，差异来自 Count 返回值。</li><li>添加 Save 要求后，检查只有 Count 的实现为何不再满足接口，再删除无关要求。</li></ol><p>接口不是越多越好。需要隔离真实环境、替换实现时，才为这个边界付出抽象成本。</p></>:<Transfer/>}
  </section>;
}

