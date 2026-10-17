import { useState } from 'react';
import { addsSeries, defaultConfig, names, requests, routeLabel, snapshot, strategies, summarize, transferRows } from './model';
import type { Config, Strategy } from './model';
import './style.css';

export default function Lesson174() {
  const [config, setConfig] = useState<Config>({ ...defaultConfig });
  const [cursor, setCursor] = useState(0);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('先预测下一条请求是否新增模板时序，再采集。');
  const state = snapshot(config, cursor);
  function change(patch: Partial<Config>) { setConfig({ ...config, ...patch }); setCursor(0); setPrediction(''); setReason(''); setFeedback('输入已改变，采集从零开始。已观察时序只统计实际出现的组合。'); }
  function step() {
    if (!state.next || !prediction || !reason.trim()) return;
    const added = addsSeries(config, cursor);
    setFeedback(`已采集 ${state.next.url}。模板时序${added ? '新增 1 条' : '不增加'}；${prediction === (added ? 'yes' : 'no') ? '预测一致' : '预测有差异'}。你的理由：${reason}。判断依据是完整标签组合是否已出现，路径不同不一定新增时序。`);
    setCursor(cursor + 1); setPrediction(''); setReason('');
  }
  return <section className="obs174" data-testid="observability-lab-174">
    <h3>标签预算实验台</h3><p>同一批请求同时进入三种指标。逐条追踪 URL → 路由标签 → 完整时序键。</p>
    <div className="obs174-controls">
      <label>不同订单数<input aria-label="不同订单数" type="range" min="1" max="6" value={config.orders} onChange={e => change({ orders: +e.target.value })} /><b>{config.orders}</b></label>
      <label>允许的状态类别<select value={config.statuses} onChange={e => change({ statuses: +e.target.value })}><option value="1">1 类（2xx）</option><option value="2">2 类（2xx、3xx）</option><option value="3">3 类（2xx、3xx、4xx）</option></select></label>
      <label>允许的租户数<select value={config.tenants} onChange={e => change({ tenants: +e.target.value })}>{[1, 2, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      <label><input type="checkbox" checked={config.tenantLabel} onChange={e => change({ tenantLabel: e.target.checked })} />加入 tenant 标签</label>
      <label><input type="checkbox" checked={config.unknown} onChange={e => change({ unknown: e.target.checked })} />加入两条不同未知路径</label>
    </div>
    <div className="obs174-next"><b>下一条 · {state.cursor} / {state.total} 已采集</b><p>{state.next ? `${state.next.url} · ${state.next.status} · ${state.next.tenant}` : '本批采集完成，可回退检查或修改输入。'}</p></div>
    <div className="obs174-controls"><label>预测：模板指标会新增时序吗？<select value={prediction} onChange={e => setPrediction(e.target.value)}><option value="">请选择</option><option value="yes">会，组合尚未出现</option><option value="no">不会，组合已经出现</option></select></label><label>预测理由<input placeholder="比较路由、状态以及租户维度" value={reason} onChange={e => setReason(e.target.value)} /></label></div>
    <div className="obs174-actions"><button data-obs-action="step" disabled={!state.next || !prediction || !reason.trim()} onClick={step}>采集下一条</button><button data-obs-action="back" disabled={!cursor} onClick={() => { setCursor(cursor - 1); setPrediction(''); setReason(''); setFeedback('已撤回最后一条采集；时序集合按剩余请求重新计算。'); }}>回退</button><button data-obs-action="reset" onClick={() => { setConfig({ ...defaultConfig }); setCursor(0); setPrediction(''); setReason(''); setFeedback('已恢复初始输入与空采集状态。'); }}>重置</button></div>
    <p role="status">{feedback}</p>
    <div data-testid="live-model" data-state={JSON.stringify({ config, ...state })} className="obs174-cards">{strategies.map(strategy => { const result = state.results[strategy]; return <article key={strategy}><h4>{names[strategy]}</h4><strong>{result.observed} 条已观察时序</strong><div className="obs174-meter" aria-label={`${names[strategy]} 已观察 ${result.observed} 条`}><span style={{ width: `${result.observed / state.total * 100}%` }} /></div><p>{result.labels.length} 个已出现路由值</p><p>{result.routeDomain} 路由 × {config.statuses} 状态 × {config.tenantLabel ? config.tenants : 1} 租户 = <b>{result.upper}</b></p><small>{result.bounded ? '允许域的组合上界：包括尚未出现的 unmatched。' : '仅对已见路由集合计算的组合空间；后续新 URL 会继续增长，无全局固定上界。'}</small><ul>{result.series.map(key => <li key={key}><code>{key}</code></li>)}</ul></article>; })}</div>
    <p>每个订单发送两次不同 query，状态与租户按订单轮换，并非穷举所有组合。允许域的笛卡尔积是可能上界，实际观察值通常更少。</p><p className="obs174-boundary">教学分类器只识别单段 /orders/:id，其余统一 unmatched。生产必须读取真实路由器的匹配模板；这个分类器不提供访问控制。这里计算一种指标的标签组合，未计实例、直方图桶等额外维度。</p>
  </section>;
}

function Example() {
  const [id, setId] = useState(101);
  const rows = [{ url: '/orders/101?view=1', status: '2xx', tenant: 't1' }, { url: `/orders/${id}?view=2`, status: '2xx', tenant: 't1' }];
  return <><h3>例子：两张地址不同的收据</h3><p>仅改变第二条订单 ID，状态与租户保持相同。看去 query 能否让两条记录合并。</p><label>第二条订单 ID<select value={id} onChange={e => setId(+e.target.value)}><option value="101">101（同一订单）</option><option value="202">202（另一订单）</option></select></label><div className="obs174-cards">{strategies.map(s => <article key={s}><h4>{names[s]}</h4>{rows.map((r, i) => <p key={i}><code>{routeLabel(r.url, s)}</code></p>)}<strong>{summarize(rows, s, false, { statuses: 1, tenants: 1 }).observed} 条时序</strong></article>)}</div><p>原始 URL 连 query 都区分；去 query 仅合并同一订单；模板可以聚合不同订单。</p></>;
}
function Diagram() {
  const [url, setUrl] = useState('/orders/88?debug=1');
  return <><h3>图解：从地址到聚合桶</h3><label>输入一个路径<input value={url} onChange={e => setUrl(e.target.value)} /></label><div className="obs174-flow"><code>{url || '空路径'}</code><span>↓ 去除 query / fragment</span><code>{routeLabel(url, 'path') || '空路径'}</code><span>↓ 有限教学分类器</span><strong>{routeLabel(url, 'template')}</strong><span>↓ 与状态类别组成键</span><code>{JSON.stringify([routeLabel(url, 'template'), '2xx'])}</code></div><p>尝试 /orders/88/items 或 /random/91：它们流向同一个 unmatched 桶，而不是为每个陌生路径开新桶。生产应采用真实路由元数据，避免误归类。</p></>;
}
function Steps() {
  const [stage, setStage] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>('raw');
  const [tenant, setTenant] = useState(true);
  const result = summarize(requests({ ...defaultConfig, orders: 6 }), strategy, tenant, { statuses: 2, tenants: 2 });
  return <><h3>分步修复：控制路由后再检查乘数</h3><ol><li>先用同批请求检查路由标签是否随订单增长。</li><li>换成路由模板，再检查租户标签是否仍需要。</li><li>区分当前样本和将来允许的组合。</li></ol><label>路由处理<select value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setStage(0); }}>{strategies.map(s => <option key={s} value={s}>{names[s]}</option>)}</select></label><label><input type="checkbox" checked={tenant} onChange={e => { setTenant(e.target.checked); setStage(0); }} />保留逐租户标签</label><button onClick={() => setStage(Math.min(3, stage + 1))} disabled={stage === 3}>检查下一步</button><button onClick={() => setStage(0)}>重新检查</button>{stage >= 1 && <p>路由值 {result.labels.length} 个：{result.labels.join('、')}。{strategy === 'template' ? '路由域固定为两类。' : '新订单或 query 仍可能制造新值。'}</p>}{stage >= 2 && <p>当前观察 {result.observed} 条；组合空间 {result.routeDomain} × 2 × {tenant ? 2 : 1} = {result.upper}。这些维度需要同时纳入预算。</p>}{stage >= 3 && <p>若租户域变为一百万，当前模板指标也可能有 2 × 2 × 1000000 条组合。应重新设计有限聚合；不需要的逐租户分析可转向受控事件查询。</p>}</>;
}
function Transfer() {
  const [observed, setObserved] = useState(''); const [upper, setUpper] = useState(''); const [reason, setReason] = useState(''); const [checked, setChecked] = useState(false);
  const answer = summarize(transferRows, 'template', true, { statuses: 2, tenants: 2 });
  return <><h3>独立迁移：新流量账本</h3><p>使用路由模板、状态类别、tenant 三个标签。允许路由域为 /orders/:id 与 unmatched；状态域为 2xx、5xx；租户域为 red、blue。以下请求按行采集：</p><ul>{transferRows.map((row, i) => <li key={i}><code>{row.url} · {row.status} · {row.tenant}</code></li>)}</ul><label>实际观察时序数<input type="number" min="0" value={observed} onChange={e => { setObserved(e.target.value); setChecked(false); }} /></label><label>允许域组合上界<input type="number" min="0" value={upper} onChange={e => { setUpper(e.target.value); setChecked(false); }} /></label><label>说明未知路径为何合并、哪些组合未出现<textarea value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} /></label><button disabled={!observed || !upper || !reason.trim()} onClick={() => setChecked(true)}>提交独立判断</button>{checked && <div role="status"><p>{+observed === answer.observed && +upper === answer.upper ? '数值推导一致。' : `请核对：实际 ${answer.observed} 条，允许域上界 ${answer.upper} 条。`}两个 alien 地址共享 [unmatched, 2xx, red]；订单的 blue / 5xx 与 blue / 2xx 属于不同组合。</p><p>你的理由：{reason}。解释由你对照检查，本练习不自动判定文字推理质量、不写入课程掌握进度；再次提交属于看过反馈后的练习。</p></div>}</>;
}
export function Help({ mode }: { mode: string }) { return <section className="obs174" data-testid="observability-help-174">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Transfer />}</section>; }
