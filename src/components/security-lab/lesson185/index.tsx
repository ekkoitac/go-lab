import {useReducer, useState} from 'react';
import {compare, feedback, initialConfig, initialState, labels, stages, transition, type Config, type Context, type Lane, type Outcome, type State} from './model';
import './style.css';

type Mode = 'example' | 'diagram' | 'steps' | 'try';
const contexts: Record<Context, string> = {'sql-value': 'SQL 查询值', 'sql-order': 'SQL 排序结构', shell: '文件名与程序参数'};
function Boundary() {return <p className="sec185-boundary">这是解释器边界教学模型，不解析完整 SQL 或 shell，不执行查询、命令或文件读取。实际系统优先使用库调用；参数化不替代权限校验。此处 cat 支持 --；单独 - 仍指标准输入，空文件名不会成功。其他程序需核对参数约定；本模型不覆盖 NUL 等操作系统参数约束。</p>;}
function Prediction({state, dispatch}: {state: State; dispatch: (a: Parameters<typeof transition>[1]) => void}) {
  return <fieldset className="sec185-prediction" disabled={state.phase > 0}><legend>先预测受控方案中输入的去向，并解释原因</legend><label>我的预测<select value={state.prediction} onChange={e => dispatch({type: 'predict', value: e.target.value as Outcome | ''})}><option value="">请选择</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>预测理由<textarea rows={2} value={state.reason} onChange={e => dispatch({type: 'reason', value: e.target.value})} placeholder="哪个解释器会读它？它经过哪条边界？"/></label></fieldset>;
}
function LaneView({lane, phase, title}: {lane: Lane; phase: number; title: string}) {
  return <article className="sec185-lane"><h4>{title}</h4><span className="sec185-caption">语法 / 调用结构</span><pre>{phase >= 1 ? lane.structure : '尚未构造'}</pre><span className="sec185-caption">独立数据通道</span><pre>{phase >= 1 ? lane.data.length ? JSON.stringify(lane.data, null, 2) : '无独立绑定参数' : '尚未传递'}</pre>{phase >= 2 && <p className={'sec185-result sec185-' + lane.outcome}>{labels[lane.outcome]}</p>}{phase === 3 && <p>{lane.explanation}</p>}</article>;
}
function Board({state}: {state: State}) {
  const lanes = compare(state.config);
  return <div data-testid="live-model" data-state={JSON.stringify({phase: state.phase, ...state.config})}><ol className="sec185-stages">{stages.map((stage, i) => <li key={stage} aria-current={state.phase === i ? 'step' : undefined}>{i + 1}. {stage}</li>)}</ol><div className="sec185-input"><b>同一原始输入，逐字保留</b><pre>{JSON.stringify(state.config.input)}</pre></div><div className="sec185-lanes"><LaneView title="直接拼接" lane={lanes.raw} phase={state.phase}/><LaneView title="受控方案" lane={lanes.protected} phase={state.phase}/></div><p aria-live="polite">{state.phase === 0 ? '下一步：把同一输入送入两种调用结构。先提交预测和理由。' : state.phase === 1 ? '变化：两条路径已构造。观察原始输入在语句文本、绑定参数或 argv 中的位置。下一步追踪谁解释它。' : state.phase === 2 ? '变化：解释器已读到结构；数据通道与选项通道的区别现在可见。下一步核对原因。' : feedback(state)}</p></div>;
}
function Controls({state, dispatch}: {state: State; dispatch: (a: Parameters<typeof transition>[1]) => void}) {
  return <div className="sec185-actions"><button data-security-action="step" disabled={state.phase === 3 || !state.prediction || !state.reason.trim()} onClick={() => dispatch({type: 'step'})}>单步执行</button><button data-security-action="back" disabled={state.phase === 0} onClick={() => dispatch({type: 'back'})}>回退一步</button><button data-security-action="reset" onClick={() => dispatch({type: 'reset'})}>重置推演</button></div>;
}
function Experiment({guided = false}: {guided?: boolean}) {
  const [state, dispatch] = useReducer(transition, initialState(guided ? {...initialConfig, context: 'shell', input: '-n', optionBoundary: false} : initialConfig));
  const configure = (patch: Partial<Config>) => dispatch({type: 'configure', config: {...state.config, ...patch}});
  return <><h3>{guided ? '分步追踪：不用 shell 之后还有谁解释参数？' : '同一个输入，追踪两条解释路径'}</h3><p>改变条件会开始新推演。先预测受控方案，再逐步比较结构和数据；回退可检查中间状态。</p><div className="sec185-fields"><label>使用上下文<select value={state.config.context} onChange={e => {const context = e.target.value as Context; configure({context, input: context === 'sql-order' ? '时间' : context === 'shell' ? '-n' : "O'Reilly"});}}>{Object.entries(contexts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>原始输入<input value={state.config.input} onChange={e => configure({input: e.target.value})}/></label></div>{state.config.context === 'sql-order' && <p>受控映射只有：时间 → created_at；名称 → name。试试“金额”或原始 SQL 片段。</p>}{state.config.context === 'shell' && <label className="sec185-check"><input type="checkbox" checked={state.config.optionBoundary} onChange={e => configure({optionBoundary: e.target.checked})}/>在文件名前增加 cat 支持的 -- 选项边界</label>}<div className="sec185-actions"><button onClick={() => configure({input: state.config.context === 'sql-value' ? "O'Reilly 报表" : state.config.context === 'shell' ? '季度 报表;2026.txt' : '名称'})}>装入合法复杂输入</button><button onClick={() => configure({input: state.config.context === 'sql-value' ? "' OR 1=1 --" : state.config.context === 'shell' ? '-n' : '金额'})}>装入边界样例</button></div><Prediction state={state} dispatch={dispatch}/><Board state={state}/><Controls state={state} dispatch={dispatch}/><Boundary/></>;
}
export default function Lesson185Lab() {return <section className="sec185" data-testid="security-lab-185"><Experiment/></section>;}
function Envelope() {
  const [sealed, setSealed] = useState(true);
  const [text, setText] = useState('请把这句话印在卡片上；不要更改流程');
  return <><h3>印刷店：订单规则与卡片正文分开交付</h3><p>把卡片正文想成 SQL 值，把印刷步骤想成固定语句模板。切换装袋方式，观察同一段话交给谁读取。</p><label>卡片正文<input value={text} onChange={e => setText(e.target.value)}/></label><div className="sec185-actions"><button aria-pressed={sealed} onClick={() => setSealed(true)}>正文装入内容袋</button><button aria-pressed={!sealed} onClick={() => setSealed(false)}>正文拼进工单规则</button></div><div className="sec185-route" data-testid="live-model" data-state={JSON.stringify({sealed, text})}><div className={!sealed ? 'sec185-highlight' : ''}><b>工单规则读取处</b><pre>{sealed ? '印制〔内容袋〕一份' : `印制 ${text} 一份`}</pre></div><span aria-hidden="true">↓</span><div className={sealed ? 'sec185-highlight' : ''}><b>内容袋 / 独立参数</b><pre>{sealed ? text : '未建立独立内容通道'}</pre></div></div><p aria-live="polite">{sealed ? '正文改变，印刷规则保持不变；类比绑定值。' : '正文进入规则文本，规则读取处和正文混在一起；类比拼接。'} 类比只表达通道分离。选择纸张规格属于结构选择，仍需要受控菜单。</p></>;
}
function Relationship() {
  const [context, setContext] = useState<Context>('sql-value');
  const [boundary, setBoundary] = useState(false);
  const config: Config = {context, input: context === 'shell' ? '-n' : context === 'sql-order' ? '时间' : "O'Reilly", optionBoundary: boundary};
  const lane = compare(config).protected;
  return <><h3>关系图：选择输入所在的位置，追踪接收者</h3><div className="sec185-actions">{Object.entries(contexts).map(([value, label]) => <button key={value} aria-pressed={value === context} onClick={() => setContext(value as Context)}>{label}</button>)}</div>{context === 'shell' && <label className="sec185-check"><input type="checkbox" checked={boundary} onChange={e => setBoundary(e.target.checked)}/>加入 --，改变 cat 的解释路径</label>}<div className="sec185-route" data-testid="live-model" data-state={JSON.stringify(config)}><div>输入节点<pre>{config.input}</pre></div><span>↓ {context === 'sql-value' ? '送入值绑定' : context === 'sql-order' ? '查找有限菜单' : '放入单个 argv 项'}</span><div className="sec185-highlight">{context === 'sql-value' ? 'SQL 数据通道' : context === 'sql-order' ? '程序持有的列名映射' : boundary ? 'cat 文件名通道' : 'cat 选项解析器'}</div><span>↓</span><div><pre>{lane.structure}</pre>{lane.data.length > 0 && <pre>数据：{JSON.stringify(lane.data)}</pre>}</div></div><p aria-live="polite">{lane.explanation}</p></>;
}
function Transfer() {
  const [scenario, setScenario] = useState<'option' | 'column'>('option');
  const [prediction, setPrediction] = useState<Outcome | ''>('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [repaired, setRepaired] = useState(false);
  const config: Config = scenario === 'option' ? {context: 'shell', input: '--help', optionBoundary: repaired} : {context: 'sql-order', input: repaired ? '名称' : '金额', optionBoundary: true};
  const result = compare(config).protected;
  function change(next: 'option' | 'column') {setScenario(next); setPrediction(''); setReason(''); setChecked(false); setRepaired(false);}
  return <><h3>新情境：先判断，再修复</h3><label>迁移情境<select value={scenario} onChange={e => change(e.target.value as 'option' | 'column')}><option value="option">文件名恰好叫 --help</option><option value="column">报表新增“金额”排序请求</option></select></label><p>{scenario === 'option' ? '程序固定为 cat，不使用 shell，传入一个参数 --help，暂未加入 --。这个参数会走哪条路径？' : '排序枚举只支持时间和名称。用户提交金额，服务使用受控映射。下一步会怎样？'}</p><fieldset disabled={checked}><legend>写下你的预测</legend><label>新情境预测<select value={prediction} onChange={e => setPrediction(e.target.value as Outcome | '')}><option value="">请选择</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>新情境理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}/></label></fieldset><div className="sec185-actions"><button disabled={!prediction || !reason.trim() || checked} onClick={() => setChecked(true)}>检验迁移预测</button><button disabled={!checked || repaired} onClick={() => setRepaired(true)}>{scenario === 'option' ? '修复：在文件名前加 --' : '调整请求：选择已支持的名称'}</button><button onClick={() => change(scenario)}>重新预测</button></div><div data-testid="live-model" data-state={JSON.stringify({scenario, checked, repaired})}>{checked ? <><p role="status">{repaired ? '干预后观察' : prediction === result.outcome ? '预测与观察一致' : '预测需要修正'}：{labels[result.outcome]}</p><pre>{result.structure}</pre><pre>数据通道：{JSON.stringify(result.data)}</pre><p>{result.explanation}</p>{repaired && scenario === 'column' && <p>这只调整为现有功能；真正增加金额排序需要开发者审查并扩展映射，不能把未知字段直接放行。</p>}</> : <p>结果尚未揭晓。先依据接收者的语法规则作出判断。</p>}</div><p>这是本地迁移练习；帮助后的完成不会写入独立掌握记录。</p></>;
}
export function Lesson185Help({mode}: {mode: Mode}) {return <section className="sec185" data-testid="security-help-185" key={mode}>{mode === 'example' ? <Envelope/> : mode === 'diagram' ? <Relationship/> : mode === 'steps' ? <Experiment guided/> : <Transfer/>}{mode !== 'steps' && <Boundary/>}</section>;}

