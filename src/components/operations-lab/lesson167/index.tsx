import { useState } from 'react';
import { classify, defaults, executeOrder, logical, operations, run, type PoolConfig, type PoolState } from './model';
import './styles.css';

const predictions = [['clean', '只有 tenantB'], ['old', '夹带 A 的旧逻辑内容'], ['alias', '只有 B 内容，但被旧别名加上 !'], ['both', '旧内容和旧别名污染都有']];
function View({ state, selected, onSelect }: { state: PoolState; selected?: number; onSelect?: (id: number) => void }) {
  return <div className="ops167-view" data-testid="live-model" data-state={JSON.stringify(state)}>
    <div className="ops167-lanes"><span>A 当前借用：{state.a ? '#' + state.a : '无'}</span><span>Pool：{state.pool ? '#' + state.pool : '空'}</span><span>B 当前借用：{state.b ? '#' + state.b : '无'}</span></div>
    <div className="ops167-objects">{state.objects.length === 0 ? <p>对象尚未创建。Get 未命中时调用 New。</p> : state.objects.map(object => <article key={object.id} className={selected === object.id ? 'ops167-object ops167-selected' : 'ops167-object'}>
      <button type="button" onClick={() => onSelect?.(object.id)} disabled={!onSelect}>对象 #{object.id} · {object.owner === 'discarded' ? '不再入池' : object.owner}</button>
      <p>len = {object.length} / cap = {object.capacity}</p>
      <p>逻辑内容：<code>{JSON.stringify(logical(object))}</code></p>
      <div className="ops167-bytes" aria-label={'对象 ' + object.id + ' 的存储示意'}>{Array.from(object.storage).map((c, i) => <span key={i} className={i < object.length ? 'ops167-logical' : 'ops167-residue'}>{c}</span>)}</div>
      <small>绿色：逻辑范围；虚线：范围外残留。容量空白未逐格绘制。</small>
    </article>)}</div>
    <div className="ops167-metrics"><span>创建次数：{state.allocations}</span><span>A 旧别名：{state.alias ? '#' + state.alias : '无'}</span><span>B 最近读取：<code>{state.phase >= 7 ? JSON.stringify(state.output) : '尚未读取'}</code></span></div>
    <p className="ops167-event" role="status">{state.event}</p>
  </div>;
}
function Config({ value, change }: { value: PoolConfig; change: (next: PoolConfig) => void }) {
  return <fieldset className="ops167-config"><legend>构造一条合法 Get 轨迹与业务策略</legend>
    <label><input type="checkbox" checked={value.reset} onChange={e => change({ ...value, reset: e.target.checked })} />B 使用前执行 Reset</label>
    <label><input type="checkbox" checked={value.discard} onChange={e => change({ ...value, discard: e.target.checked })} />归还后注入池项丢弃</label>
    <label><input type="checkbox" checked={value.reuse} onChange={e => change({ ...value, reuse: e.target.checked })} />有池项时选取“复用”轨迹</label>
    <label><input type="checkbox" checked={value.alias} onChange={e => change({ ...value, alias: e.target.checked })} />A 保留旧别名并追加 !</label>
    <label>对象容量<select value={value.capacity} onChange={e => change({ ...value, capacity: Number(e.target.value) })}><option value={16}>16 字节</option><option value={128}>128 字节（大对象）</option></select></label>
    <label>入池容量上限<select value={value.maxCapacity} onChange={e => change({ ...value, maxCapacity: Number(e.target.value) })}><option value={32}>32 字节</option><option value={256}>256 字节</option></select></label>
  </fieldset>;
}
function Boundary() { return <p className="ops167-note">确定性教学模型：Get 的复用或新建是选定的合法轨迹，不代表命中率。底层格子是解释残留的示意，并非 Reset 后的 Buffer.String()/Bytes() 读取结果；Reset 不做安全擦除。本实验不证明性能提升，也不记录独立掌握。</p>; }
export default function Lab() {
  const [config, setConfig] = useState<PoolConfig>({ ...defaults });
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const state = run(config, phase);
  function change(next: PoolConfig) { setConfig(next); setPhase(0); setPrediction(''); setReason(''); }
  return <section className="ops167" data-testid="operations-lab-167">
    <h3>临时对象借还台</h3><p>让两个租户依次借用 Buffer：跟踪对象身份、逻辑长度、底层残留和归还后的使用权。</p>
    <Config value={config} change={change} />
    <fieldset className="ops167-predict"><legend>执行前预测：最后 B 再读取，会得到什么？</legend>
      <label>预测输出<select aria-label="预测输出" value={prediction} disabled={phase > 0} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option>{predictions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>预测理由<textarea aria-label="预测理由" value={reason} disabled={phase > 0} onChange={e => setReason(e.target.value)} placeholder="说明 Get、Reset 或别名如何影响结果" /></label>
    </fieldset>
    <div className="ops167-actions"><button type="button" data-ops-action="step" disabled={!prediction || !reason.trim() || phase === operations.length} onClick={() => setPhase(phase + 1)}>单步：{operations[phase] ?? '完成'}</button><button type="button" data-ops-action="back" disabled={phase === 0} onClick={() => setPhase(phase - 1)}>回退一步</button><button type="button" data-ops-action="reset" onClick={() => { setPhase(0); setPrediction(''); setReason(''); }}>重置轨迹</button></div>
    {!prediction || !reason.trim() ? <p>先选择预测并填写理由，才能单步执行。</p> : null}
    <ol className="ops167-track">{operations.map((name, i) => <li key={name} aria-current={i === phase - 1 ? 'step' : undefined} className={i < phase ? 'ops167-done' : ''}>{name}</li>)}</ol>
    <View state={state} />
    {phase === operations.length && <p className="ops167-feedback">{classify(state.output) === prediction ? '本次预测与输出一致。' : '本次输出与预测不同。'} 你的理由：{reason}。实际输出 {JSON.stringify(state.output)}；{state.hazard ? '旧别名违反归还后不再使用的约定，输出干净也不能证明安全。' : '未检测到旧别名误用。'} 可回退到 Get 或 Reset 检查因果，再改条件重试。</p>}
    <Boundary />
  </section>;
}
function Example() {
  const [discard, setDiscard] = useState(false);
  const [show, setShow] = useState(false);
  return <><h4>同一批输入，两个 Reset 策略</h4><p>对照控制变量：A 和 B 的输入、容量和 Get 轨迹一致，仅改变 Reset。</p><label><input type="checkbox" checked={discard} onChange={e => { setDiscard(e.target.checked); setShow(false); }} />两组都注入池项丢弃</label><button type="button" onClick={() => setShow(true)}>运行两组对照</button>{show && <div className="ops167-compare">{[false, true].map(reset => <div key={String(reset)}><h4>{reset ? '使用前 Reset' : '漏掉 Reset'}</h4><View state={run({ ...defaults, reset, discard })} /></div>)}</div>}<p>如果两组都拿到新对象，漏 Reset 也可能暂时输出正确；它不能推翻复用轨迹中的反例。</p></>;
}
function Diagram() {
  const [phase, setPhase] = useState(5);
  const [selected, setSelected] = useState(1);
  const [reuse, setReuse] = useState(true);
  const state = run({ ...defaults, alias: true, reuse }, phase);
  const object = state.objects.find(item => item.id === selected);
  return <><h4>沿引用追踪对象</h4><label><input type="checkbox" checked={reuse} onChange={e => setReuse(e.target.checked)} />B 选择复用轨迹</label><label>观察时刻<select value={phase} onChange={e => setPhase(Number(e.target.value))}><option value={5}>Get B 后</option><option value={6}>Reset 后</option><option value={7}>Write B 后</option><option value={8}>旧别名写入后</option></select></label><View state={state} selected={selected} onSelect={setSelected} /><p>点击对象，下面的引用和读取表达式一起联动。</p><div className="ops167-code"><code>{'选中 #' + selected + ': ' + (object ? 'String() = ' + JSON.stringify(logical(object)) : '尚未创建')}</code><p>A 旧别名 → {state.alias === selected ? '选中对象' : '另一对象'}；B 当前指针 → {state.b === selected ? '选中对象' : '另一对象'}。</p><p>{state.alias === state.b ? '两条引用指向同一对象；Put 不会令旧指针自动失效。' : '这条轨迹没有共享同一对象；所有权约定仍要遵守。'}</p></div></>;
}
const orderNames = ['Get', 'Reset', 'Write', 'Put'];
function Steps() {
  const [order, setOrder] = useState(['Get', 'Write', 'Reset', 'Put']);
  const [checked, setChecked] = useState(false);
  function move(index: number) { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; setOrder(next); setChecked(false); }
  const result = executeOrder(order);
  const resetBeforeWrite = order.indexOf('Reset') < order.indexOf('Write');
  return <><h4>教租户 B 按顺序操作</h4><p>起点：B 将复用带有 A 内容的 Buffer。调整动作顺序，让 B 在归还前输出且仅输出 tenantB。</p><ol>{order.map((name, i) => <li key={name}>{name}<button type="button" disabled={i === 0} aria-label={name + ' 上移'} onClick={() => move(i)}>上移</button></li>)}</ol><button type="button" onClick={() => setChecked(true)}>执行我的顺序</button><button type="button" onClick={() => { setOrder(orderNames); setChecked(false); }}>显示分步提示</button>{checked && (!result.error ? <><View state={result.state} /><p>{resetBeforeWrite ? 'Get → Reset → Write → Put：借到后初始化，写入并读取，再按容量归还。' : 'Write 先于 Reset：本次 Write/读取已经夹带旧内容；之后清长度不能撤销已读出的内容。'}</p></> : <p className="ops167-feedback">执行在所有权检查处停止：{result.error}</p>)}</>;
}
function TryRepair() {
  const [config, setConfig] = useState<PoolConfig>({ ...defaults, reset: false, alias: true, capacity: 128, maxCapacity: 256 });
  const [tested, setTested] = useState(false);
  const states = [run({ ...config, discard: false, reuse: true }), run({ ...config, discard: true })];
  const passing = config.reset && !config.alias && config.maxCapacity < 128;
  return <><h4>修复跨租户污染与大对象驻留</h4><p>目标：复用和丢弃两条轨迹都正确；归还后不再访问；128 字节大对象不进入 Pool。改变策略后重新验证。</p><fieldset className="ops167-config"><legend>固定大对象 128 字节，修复三项业务策略</legend><label><input type="checkbox" checked={config.reset} onChange={e => { setConfig({ ...config, reset: e.target.checked }); setTested(false); }} />使用前 Reset</label><label><input type="checkbox" checked={config.alias} onChange={e => { setConfig({ ...config, alias: e.target.checked }); setTested(false); }} />保留旧别名并误用</label><label>大对象准入上限<select value={config.maxCapacity} onChange={e => { setConfig({ ...config, maxCapacity: Number(e.target.value) }); setTested(false); }}><option value={32}>32 字节</option><option value={256}>256 字节</option></select></label></fieldset><button type="button" onClick={() => setTested(true)}>验证两条反例轨迹</button>{tested && <><p className="ops167-feedback">{passing ? '修复满足这组辅助目标。' : '仍需修复：' + [!config.reset && '明确执行 Reset，不能靠偶然未命中', config.alias && '释放旧别名', config.maxCapacity >= 128 && '降低大对象准入上限'].filter(Boolean).join('；')}</p><div className="ops167-compare">{states.map((state, i) => <div key={i}><h4>{i ? '强制丢弃轨迹' : '允许复用轨迹'}</h4><View state={state} /></div>)}</div></>}<p>本题是有目标提示的修复练习；通过不作为无提示掌握证据。</p></>;
}
export function Help({ mode }: { mode: string }) { return <section className="ops167 ops167-help" data-testid="operations-help-167">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <TryRepair />}<Boundary /></section>; }
