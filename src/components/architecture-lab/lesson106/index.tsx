import { useState } from 'react';
import { assessTransfer, initialConfig, inspect, layoutNames, phases, type Config, type Layout } from './model';
import './style.css';

function Topology({ config, focus = '' }: { config: Config; focus?: string }) {
  const split = config.layout !== 'single';
  return <div className="a106-topology" aria-label="仓库、模块、命令和包的关系图">
    <div className="a106-boundary"><strong>{config.layout === 'repos' ? '仓库 api / worker / migrate（各自一个）' : 'product 仓库'}</strong>
      <div className="a106-commands">{['api', 'worker', 'migrate'].map(name => <div key={name} className={focus === name ? 'selected' : ''}><strong>{split ? `${name}/go.mod` : '根 go.mod'}</strong><code>cmd/{name}</code><span>一个可执行入口</span></div>)}</div>
      {!split && <p className="a106-node">↓ 三个命令 import 同一包<br /><code>internal/domain</code><br />包没有独立 module 版本</p>}
    </div>
    {split && <><div className="a106-arrow">↓ 三条 import / module 依赖</div><div className="a106-boundary"><strong>{config.layout === 'repos' ? '独立 domain 仓库' : '同一个 product 仓库内'}</strong><p className="a106-node"><code>domain/go.mod</code><br />domain 包 · 独立版本 v1.x</p></div></>}
    <p className="a106-muted">边框表示源码组织；箭头表示依赖，不表示进程通信。拆 module 不会自动创建远程服务。</p>
  </div>;
}
export default function Lesson106() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [phase, setPhase] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [compare, setCompare] = useState(false);
  const model = inspect(config, phase);
  function change(next: Config) { setConfig(next); setPhase(0); setPrediction(''); setReason(''); setCompare(false); }
  return <div className="arch106" data-testid="architecture-lab-106">
    <h3>本地能用，交付时能构建吗？</h3>
    <p>目标：区分命令、包、module 和仓库。三个命令共同交付，现在都要调用领域包新增的 NewRule()；追踪这次修改如何到达干净构建环境。</p>
    <div className="a106-controls"><label>源码组织<select value={config.layout} onChange={e => change({ ...config, layout: e.target.value as Layout })}>{Object.entries(layoutNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label></div>
    <fieldset disabled={config.layout === 'single'}><legend>多 module 的联调与交付计划</legend><label className="a106-check"><input type="checkbox" checked={config.workspace} onChange={e => change({ ...config, workspace: e.target.checked })} />本地 go.work 使用所有 module 的源码</label><label className="a106-check"><input type="checkbox" checked={config.publish} onChange={e => change({ ...config, publish: e.target.checked })} />第 3 步发布 domain v1.1.0</label><label className="a106-check"><input type="checkbox" checked={config.upgrade} onChange={e => change({ ...config, upgrade: e.target.checked })} />第 3 步将三个消费方 require 更新到 v1.1.0</label></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify({ config, ...model })} className="a106-panel"><strong>阶段 {phase} / 4 · {phases[phase]}</strong><Topology config={config} /><div className="a106-metrics"><span>命令 <b>{model.commands}</b></span><span>module <b>{model.modules}</b></span><span>仓库 <b>{model.repositories}</b></span></div><table><thead><tr><th>证据位置</th><th>当前状态</th></tr></thead><tbody><tr><td>本地 domain 源码</td><td>{model.source}</td></tr><tr><td>消费者依赖</td><td>{model.required}</td></tr><tr><td>可获取的发布版本</td><td>{model.published}</td></tr><tr><td>本地联调</td><td>{model.local === null ? '未执行' : model.local ? '通过' : '失败：旧版本缺少新函数'}</td></tr><tr><td>GOWORK=off 干净构建</td><td>{model.clean === null ? '未执行' : model.clean ? '通过' : '失败'}</td></tr></tbody></table></div>
    {phase === 0 && <div className="a106-panel"><label>可选预测：最终干净构建能通过吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">直接探索</option><option value="pass">通过</option><option value="fail">失败</option></select></label><label>预测理由（可留空）<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="它会取得哪一份 domain？" /></label></div>}
    <div className="a106-controls"><button data-arch-action="step" disabled={phase === 4} onClick={() => setPhase(v => Math.min(4, v + 1))}>{['修改源码', '执行本地联调', '执行发布计划', '检查干净构建', '检查完成'][phase]}</button><button data-arch-action="back" disabled={phase === 0} onClick={() => setPhase(v => Math.max(0, v - 1))}>回退一步</button><button data-arch-action="reset" onClick={() => change(initialConfig)}>重置实验</button></div>
    <div className="a106-feedback" aria-live="polite">{phase === 0 ? '先选边界与交付计划，再逐步观察；修改条件会开始新一轮。' : phase === 1 ? 'domain 新增 NewRule，api、worker、migrate 都改为调用它。发布版本此时没有变化。' : phase === 2 ? `本地实际读取：${model.localSource}。${model.local ? '联调通过，继续检查交付版本。' : '源码修改尚未进入已依赖的版本，本地联调失败；可继续查看后续发布计划是否修复。'}` : phase === 3 ? `执行发布计划后：可获取 ${model.published}，消费方声明 ${model.required}。下一步忽略 go.work，也不带本地 replace。` : <><strong>{model.clean ? '交付验证通过。' : '发现本地与交付差异。'}</strong><p>{model.reason}</p><p>{prediction ? `预测${(prediction === 'pass') === model.clean ? '一致' : '不一致'}。${reason ? `你的理由：${reason}` : ''}` : '本轮为自由探索，未记录预测。'}</p>{!model.clean && <button onClick={() => change({ ...config, publish: true, upgrade: true })}>修复：发布新版本并更新 require，重新验证</button>}</>}</div>
    <div className="a106-controls"><button onClick={() => setCompare(v => !v)} aria-pressed={compare}>对照三种边界</button></div>{compare && <div className="a106-panel"><p>保持同一次修改和同一发布计划。下表预演最终构建；命令数量始终是 3。</p><table><thead><tr><th>布局</th><th>module / 仓库</th><th>干净构建</th></tr></thead><tbody>{(Object.keys(layoutNames) as Layout[]).map(layout => { const row = inspect({ ...config, layout }, 4); return <tr key={layout}><td>{layoutNames[layout]}</td><td>{row.modules} / {row.repositories}</td><td>{row.clean ? '通过' : '失败'}</td></tr>; })}</tbody></table><p>同仓多 module 与多仓的版本问题相同；拆仓额外服务于源码权限与所有权，并不能修复 require。</p></div>}
    <p className="a106-muted">教学模型：只模拟新函数的版本可见性，假设没有其他传递依赖升级、缓存源码或 replace；未运行 Go 编译器。internal 的访问限制依据导入路径父目录，不是简单禁止跨 module；此处多 module 使用可导入的 domain 包。构建通过也不代表行为兼容。</p>
  </div>;
}
function Example() {
  const [entry, setEntry] = useState('api');
  return <><h4>一个产品，三个入口</h4><p>订单产品共同发布 API、队列 worker 和迁移工具。选择要构建的入口，追踪它与 go.mod 的关系。</p><label>构建入口<select value={entry} onChange={e => setEntry(e.target.value)}><option>api</option><option>worker</option><option>migrate</option></select></label><Topology config={{ ...initialConfig, layout: 'single' }} focus={entry} /><div className="a106-feedback" aria-live="polite"><code>go build ./cmd/{entry}</code><p>产物：{entry} 可执行文件。依赖仍由根 go.mod 管理，领域规则仍来自 internal/domain。三个产物不要求三个 module。</p></div></>;
}
function Diagram() {
  const [workspace, setWorkspace] = useState(true);
  const [focus, setFocus] = useState('api');
  return <><h4>同一 import，源码从哪里来？</h4><p>三个消费方都 require domain v1.0.0，本地 domain 已有未发布的 NewRule。</p><label>追踪消费方<select value={focus} onChange={e => setFocus(e.target.value)}><option>api</option><option>worker</option><option>migrate</option></select></label><div className="a106-controls"><button aria-pressed={workspace} onClick={() => setWorkspace(true)}>启用 go.work</button><button aria-pressed={!workspace} onClick={() => setWorkspace(false)}>GOWORK=off</button></div><div className="a106-route" aria-live="polite"><strong>{focus} 调用 NewRule</strong><span>↓ import domain</span><strong>{workspace ? 'go.work → 本地 domain 源码' : 'go.mod require → 已发布 v1.0.0'}</strong><span>↓</span><strong>{workspace ? '找到 NewRule' : '找不到 NewRule'}</strong></div><p>这里只切换依赖来源。go.work 不会替消费者发布 v1.1.0，也不会自动修改其 require。</p></>;
}
function Steps() {
  const [step, setStep] = useState(0);
  const configs: Config[] = [initialConfig, { ...initialConfig, publish: true }, { ...initialConfig, publish: true, upgrade: true }];
  const current = inspect(configs[step], 4);
  const instructions = ['先关闭工作区验证：本地能调用，不等于 v1.0.0 含有新函数。', '先发布 domain v1.1.0：远端版本有了，但消费方依然引用旧版。', '再更新所有消费方 require，并分别执行 GOWORK=off 构建和兼容测试。'];
  return <><h4>沿版本证据修复</h4><p>第 {step + 1} / 3 步：{instructions[step]}</p><div className="a106-route"><span>发布源：{current.published}</span><span>↓ 消费方选择</span><span>require：{current.required}</span><span>↓ 干净环境</span><strong>{current.clean ? '新函数可用' : '构建失败'}</strong></div><p className="a106-feedback" aria-live="polite">{current.reason}</p><div className="a106-controls"><button disabled={step === 0} onClick={() => setStep(v => v - 1)}>上一步</button><button disabled={step === 2} onClick={() => setStep(v => v + 1)}>下一步</button><button onClick={() => setStep(0)}>重新修复</button></div></>;
}
function Transfer() {
  const [choice, setChoice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <><h4>迁移：公开 SDK 的版本承诺</h4><p>服务每周发布，外部客户使用的 SDK 每季度发布并保持兼容。团队和源码权限相同，希望先以最少协调建立 SDK 独立版本。你会怎样组织？</p><label>你的选择<select value={choice} disabled={submitted} onChange={e => setChoice(e.target.value)}><option value="">先选择再验证</option><option value="cmd">仍在服务 module 内，多放一个 cmd/sdk</option><option value="module">同仓增加 SDK module，独立发布与验证</option><option value="repo">立刻将所有入口拆到独立仓库</option></select></label><div className="a106-controls"><button disabled={!choice || submitted} onClick={() => setSubmitted(true)}>提交方案</button><button onClick={() => { setChoice(''); setSubmitted(false); }}>重新尝试</button></div>{submitted && <p className="a106-feedback" aria-live="polite">{assessTransfer(choice)}</p>}</>;
}
export function Help({ mode }: { mode: string }) {
  return <div className="arch106" data-testid="architecture-help-106">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}<p className="a106-muted">辅助理解与练习，不计入独立掌握证据，不改变主实验。</p></div>;
}
