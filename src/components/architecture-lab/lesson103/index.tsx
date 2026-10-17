import { useState } from 'react';
import { initialConfig, inspect, strategyNames, type Config, type Strategy, type Payload } from './model';
import './style.css';
import RelationGraph from '../RelationGraph';

function Imports({ config, reveal = false, focus = '' }: { config: Config; reveal?: boolean; focus?: string }) {
  const model = inspect(config);
  const positions:Record<string,{x:number;y:number}>={main:{x:105,y:10},order:{x:8,y:110},notification:{x:198,y:110},message:{x:105,y:230},fulfillment:{x:105,y:150}};
  const graphNodes=[...new Set(model.edges.flatMap(e=>[e.from,e.to]))].map(id=>({id,...positions[id]}));
  return <><RelationGraph nodes={graphNodes} edges={model.edges.map(e=>({...e,active:reveal&&model.cycle.some((n,i)=>n===e.from&&model.cycle[i+1]===e.to)}))} label="源码导入图：箭头从导入方指向被导入包" selected={focus}/><ul className="a103-edges" aria-label="源码导入关系">{model.edges.filter(e => !focus || e.from === focus || e.to === focus).map(e => <li key={`${e.from}-${e.to}`} className={reveal && model.cycle.some((n, i) => n === e.from && model.cycle[i + 1] === e.to) ? 'active' : ''}><strong>{e.from} → {e.to}</strong><small>{e.why}</small></li>)}</ul></>;
}
function Runtime({ config }: { config: Config }) {
  const model = inspect(config);
  return model.builds ? <div className="a103-trace" aria-label="运行时通知调用">{model.runtime.map((n, i) => <span key={n}>{i > 0 ? '→ ' : ''}{n}</span>)}</div> : <p>构建被导入环阻止，通知调用没有开始。</p>;
}
export default function Lesson103() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [compare, setCompare] = useState(false);
  const model = inspect(config);
  const change = (next: Config) => { setConfig(next); setPhase(0); setPrediction(''); setReason(''); setCompare(false); };
  return <div className="arch103" data-testid="architecture-lab-103">
    <h3>修复导入环，再追踪一次通知</h3>
    <p>目标：保留“下单后通知”，同时检查源码无环与订单隔离渠道这两个条件。通知实际只需要订单编号和结果。</p>
    <div className="a103-controls">
      <label>修复方案<select value={config.strategy} onChange={e => change({ ...config, strategy: e.target.value as Strategy })}>{Object.entries(strategyNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>传递的数据<select value={config.payload} onChange={e => change({ ...config, payload: e.target.value as Payload })}><option value="minimal">最小值：ID + Result</option><option value="full">夹带服务或渠道实现类型</option></select></label>
      <label>职责事实<select value={config.sameConcept ? 'same' : 'separate'} onChange={e => change({ ...config, sameConcept: e.target.value === 'same' })}><option value="separate">渠道独立变化，订单不应导入渠道</option><option value="same">本是同一概念，内部状态持续共同变化</option></select></label>
    </div>
    <div className="a103-panel" data-testid="live-model" data-state={JSON.stringify({ config, phase, edges: model.edges, build: phase ? model.builds : null, runtime: phase === 2 ? model.runtime : [] })}>
      <strong>源码导入图 · A → B 表示 A import B</strong>
      <Imports config={config} reveal={phase > 0} />
      <p>载荷字段：{model.fields.join('、')}。{config.strategy === 'direct' ? '当前通知仍从订单类型读取数据；选择最小字段本身不会改掉已有 import。' : config.strategy === 'merge' ? '合并后字段在包内传递，不新增包导入。' : ''}</p>
      <p className="a103-muted">这是可检查的教学依赖图；未运行真实 Go 编译器，也不估算性能。端口示例采用 order.Result 命名类型，所以适配器导入 order。</p>
    </div>
    {phase === 0 && <div className="a103-panel"><label>可选预测：这张图能否通过导入环检查？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="yes">可以，无环</option><option value="no">不行，有环</option></select></label><label>预测理由（可留空）<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="指出你看到的路径" /></label></div>}
    <div className="a103-controls"><button data-arch-action="step" disabled={phase === 2} onClick={() => setPhase(v => Math.min(2, v + 1))}>{phase === 0 ? '检查导入图' : phase === 1 ? '尝试下单通知' : '追踪完成'}</button><button data-arch-action="back" disabled={phase === 0} onClick={() => setPhase(v => Math.max(0, v - 1))}>回退一步</button><button data-arch-action="reset" onClick={() => change(initialConfig)}>重置实验</button></div>
    <div aria-live="polite">{phase > 0 && <div className="a103-status"><strong>{model.builds ? '检查结果：无导入环' : '检查结果：存在导入环'}</strong><p>{prediction ? `预测${(prediction === 'yes') === model.builds ? '一致' : '不一致'}${reason ? `；你的理由：${reason}` : ''}。` : '本次为自由探索，未记录预测。'}</p><p>{model.advice}</p>{phase === 2 && <><strong>运行时调用 · 箭头表示调用顺序</strong><Runtime config={config} />{model.builds && <p>输入订单 #42 / 已支付 → 通知“订单 #42 已支付”。{config.strategy === 'port' ? '运行时订单调用通知；源码中却是通知适配器导入订单，两种箭头含义不同。' : '业务结果相同，不代表依赖方向与修改范围相同。'}</p>}</>}</div>}</div>
    <div className="a103-controls"><button onClick={() => setCompare(v => !v)} aria-pressed={compare}>对照四种方案</button></div>
    {compare && <div className="a103-panel"><p>保持当前数据和职责事实，比较结构；“匹配”只针对本题约束。</p><table><thead><tr><th>方案</th><th>无环</th><th>订单隔离渠道</th><th>匹配当前职责</th></tr></thead><tbody>{(Object.keys(strategyNames) as Strategy[]).map(strategy => { const row = inspect({ ...config, strategy }); return <tr key={strategy}><td>{strategyNames[strategy]}</td><td>{row.builds ? '是' : '否'}</td><td>{row.independent ? '是' : '否'}</td><td>{row.fits ? '是' : '需再调整'}</td></tr>; })}</tbody></table></div>}
  </div>;
}

function Example() {
  const [channel, setChannel] = useState('邮件');
  const [sent, setSent] = useState(false);
  return <><h4>订单 #42 的两条消息</h4><p>订单侧声明 Notify(Result)，Result 只有 ID 与状态。装配点选择渠道。</p><label>main 注入的实现<select value={channel} onChange={e => { setChannel(e.target.value); setSent(false); }}><option>邮件</option><option>站内信</option></select></label><div className="a103-panel"><code>order.Result{'{'}ID: 42, Status: "已支付"{'}'}</code><p>order → 自己的 Notifier 端口</p><p>main → {channel}适配器 → 满足 Notifier</p></div><button onClick={() => setSent(true)}>发送示例通知</button><p aria-live="polite">{sent ? `${channel}收到：订单 #42 已支付。更换渠道只改装配和适配器，订单输入及规则未变。` : '先选择实现，再追踪相同订单数据的输出。'}</p></>;
}
function Diagram() {
  const [view, setView] = useState('source');
  const [focus, setFocus] = useState('');
  const config: Config = { strategy: 'port', payload: 'minimal', sameConcept: false };
  return <><h4>同一结构的两种箭头</h4><div className="a103-controls"><button aria-pressed={view === 'source'} onClick={() => setView('source')}>源码 import</button><button aria-pressed={view === 'runtime'} onClick={() => setView('runtime')}>运行时调用</button></div>{view === 'source' ? <><label>追踪包的直接关系<select value={focus} onChange={e => setFocus(e.target.value)}><option value="">全部关系</option><option>order</option><option>notification</option><option>main</option></select></label><Imports config={config} focus={focus} /><p className="a103-status">{focus ? `${focus} 的邻接关系：${inspect(config).edges.filter(e => e.from === focus || e.to === focus).map(e => `${e.from} → ${e.to}`).join('；')}` : '源码依赖从 main 指向双方，从 notification 指向 order。'}</p></> : <><Runtime config={config} /><p>订单在运行时调用通知实现，不要求它在源码中导入 notification；main 传入满足端口的对象。</p></>}</>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const configs: Config[] = [initialConfig, { ...initialConfig, strategy: 'data' }, { ...initialConfig, strategy: 'port' }, { ...initialConfig, strategy: 'port', payload: 'full' }];
  const explanations = ['先找环：order → notification → order。换 import 别名不会改变边。', '只移动 ID 和 Result：删除通知对订单的引用，但订单仍依赖具体渠道。', '订单定义 Notifier，main 注入实现：删除 order → notification，保留通知到订单类型的单向引用。', '检验边界：若端口又使用 notification.Envelope，order → notification 回来，环也回来。'];
  return <><h4>逐步修复与反例</h4><p>第 {step + 1} / 4 步：{explanations[step]}</p><Imports config={configs[step]} reveal /><div className="a103-status" aria-live="polite">{inspect(configs[step]).advice}</div><div className="a103-controls"><button disabled={step === 0} onClick={() => setStep(v => v - 1)}>上一步</button><button disabled={step === 3} onClick={() => setStep(v => v + 1)}>下一步</button><button onClick={() => setStep(0)}>重新走一遍</button></div></>;
}
function Transfer() {
  const [choice, setChoice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>迁移：库存快照与报表</h4><p>inventory 调用 report，report 导入 inventory 读取完整仓库服务。报表实际只要 SKU 和数量，格式独立变化。要让库存不依赖报表实现，先选修复再查看反馈。</p><label>你的修复<select disabled={submitted} value={choice} onChange={e => setChoice(e.target.value)}><option value="">请选择</option><option value="alias">只给 import 起别名</option><option value="data">移出快照数据，仍直接调用 report</option><option value="port">库存定义最小快照端口，由 main 注入报表</option><option value="merge">把库存和报表全部合并</option></select></label><div className="a103-controls"><button disabled={!choice || submitted} onClick={() => setSubmitted(true)}>提交修复</button><button onClick={() => { setChoice(''); setSubmitted(false); }}>重新尝试</button></div>{submitted && <div className="a103-status" aria-live="polite">{choice === 'port' ? '满足约束：inventory 定义 Snapshot 与 Publish 需求，report 实现端口，main 装配；库存源码不再导入报表。' : choice === 'data' ? '移动数据可以去环，但 inventory → report 仍在，未满足渠道隔离。再检查谁持有调用需求。' : choice === 'merge' ? '合并能删除包间环，但这里报表格式独立变化，合并没有保留所需边界。' : '别名只改变本文件中的名字，原来的双向导入仍存在。'}</div>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <div className="arch103" data-testid="architecture-help-103">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="a103-muted">本区是辅助理解与练习，不计入独立掌握证据；操作不会改变主实验。</p></div>;
}

