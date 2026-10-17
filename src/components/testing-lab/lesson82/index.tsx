import { useState } from 'react';
import { cases, categories, categoryOf, coverage, labels, offset, runTable, trace, versions, type Case, type Version } from './model';
import './style.css';

export default function Lab() {
  const [selected, setSelected] = useState(['second']);
  const [version, setVersion] = useState<Version>('original');
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const rows = cases.filter(c => selected.includes(c.id));
  const covered = coverage(rows);
  const failures = runTable(version, rows).filter(row => !row.pass).length;
  const invalidate = () => { setRevealed(false); setPrediction(''); setReason(''); };
  const reset = () => { setSelected(['second']); setVersion('original'); invalidate(); };
  return <section className="testing82" data-testid="testing-lab-82">
    <h3>搭一张能区分缺陷的测试表</h3>
    <p>目标：用不同输入类别检验修复是否完整。契约：页码、页大小至少为 1；非法输入返回 −1；合法偏移从 0 开始。</p>
    <div className="t82-contract"><strong>独立预期来自契约</strong><span>第 1 页跳过 0 条；第 2 页跳过 1 页。表里的 want 预先确定，不随实现切换。</span></div>
    <fieldset><legend>① 选择测试行，组成你的测试表</legend><div className="t82-picks">{cases.map(c => <label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={() => {setSelected(selected.includes(c.id) ? selected.filter(id => id !== c.id) : [...selected, c.id]); invalidate();}} /><span>{c.name}<small>page={c.page}, size={c.size} → want={c.want}</small></span></label>)}</div></fieldset>
    <div data-testid="live-model" data-state={JSON.stringify({selected, version, revealed, prediction})}>
      <div className="t82-coverage" aria-label="测试类别覆盖">{categories.map(category => <span key={category} className={covered.includes(category) ? 'covered' : ''}>{covered.includes(category) ? '已选' : '缺少'} · {category}</span>)}</div>
      <p>{rows.length} 行 / {covered.length} 类。重复普通页会增加行数，但不会补上非法输入类别。</p>
      <label className="t82-field">② 选择要预测的实现<select value={version} onChange={e => {setVersion(e.target.value as Version); invalidate();}}>{versions.map(v => <option key={v} value={v}>{labels[v]}</option>)}</select></label>
      <code className="t82-code">{version === 'original' ? 'return page * size' : version === 'formula' ? 'return (page - 1) * size' : 'if page < 1 || size < 1: return -1; else: return (page - 1) * size'}</code>
      <div className="t82-predict"><label>③ 预测会失败几行？<input type="number" min="0" max={rows.length} step="1" value={prediction} onChange={e => {setPrediction(e.target.value); setRevealed(false);}} /></label><label>写下理由<input value={reason} placeholder="哪类输入会暴露哪一处缺陷？" onChange={e => {setReason(e.target.value); setRevealed(false);}} /></label></div>
      <div className="t82-actions"><button type="button" data-testing-action="step" disabled={!rows.length || !reason.trim() || prediction === '' || !Number.isInteger(Number(prediction)) || Number(prediction) < 0 || Number(prediction) > rows.length} onClick={() => setRevealed(true)}>运行同一张表并对照</button><button type="button" data-testing-action="reset" onClick={reset}>重置实验</button></div>
      {!rows.length && <p role="status">请至少加入一行，空测试表不能提供验证证据。</p>}
      {revealed && <div aria-live="polite"><p className="t82-feedback">你预测 {prediction} 行失败；{labels[version]} 实际失败 {failures} 行。{Number(prediction) === failures ? '数量吻合，请继续核对逐行证据。' : '对照下面的实际值与独立预期，定位遗漏的条件。'} 理由：{reason}</p>
        <div className="t82-results">{versions.map(v => <article key={v}><h4>{labels[v]}</h4>{runTable(v, rows).map(row => <div className={row.pass ? 't82-row pass' : 't82-row fail'} key={row.id}><strong>{row.name} · {row.pass ? 'PASS' : 'FAIL'}</strong><span>{trace(v, row)}</span><span>实际 {row.actual} / 预期 {row.want}</span></div>)}</article>)}</div>
        <p>原公式在普通页就会失败，不能把它称作“普通页通过”。仅修公式后，普通页可能全通过；加入非法页码或非法页大小，才能暴露缺失校验。</p>
        <p>这里的 {covered.length}/4 是本实验的输入类别覆盖，不是代码覆盖率，也不证明所有输入都正确。仅模拟有限整数，不演示机器整数溢出。</p>
      </div>}
    </div>
  </section>;
}

const transferCases: Case[] = [
  {id:'t1',name:'订单列表',page:4,size:7,want:21},
  {id:'t2',name:'日志列表',page:1,size:0,want:-1},
  {id:'t3',name:'商品列表',page:0,size:5,want:-1},
];
export function Help({mode}: {mode:string}) {
  const [choice, setChoice] = useState('second');
  const [step, setStep] = useState(0);
  const [shoe, setShoe] = useState<string[]>(['同尺码蓝鞋']);
  const [task, setTask] = useState(0);
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const c = cases.find(row => row.id === choice)!;
  const newCase = transferCases[task];
  const reset = () => {setChoice('second'); setStep(0); setShoe(['同尺码蓝鞋']); setTask(0); setAnswer(''); setReason(''); setRevealed(false);};
  return <section className="testing82 t82-help" data-testid="testing-help-82"><div data-testid="live-model" data-state={JSON.stringify({mode,choice,step,shoe,task,answer,revealed})}>
    {mode === 'example' ? <><h3>试鞋：增加颜色还是增加尺码？</h3><p>目标是检验尺码是否合适。为试穿计划选择样本，观察你真正覆盖了哪些条件。</p><div className="t82-picks">{['同尺码蓝鞋','同尺码红鞋','最小尺码','不存在的尺码'].map(s => <label key={s}><input type="checkbox" checked={shoe.includes(s)} onChange={() => setShoe(shoe.includes(s) ? shoe.filter(x => x !== s) : [...shoe,s])} />{s}</label>)}</div><div className="t82-flow"><span>已选 {shoe.length} 双</span><span>普通尺码 {shoe.some(s => s.startsWith('同尺码')) ? '✓' : '缺失'}</span><span>最小尺码 {shoe.includes('最小尺码') ? '✓' : '缺失'}</span><span>非法尺码 {shoe.includes('不存在的尺码') ? '✓' : '缺失'}</span></div><p>蓝鞋 → 红鞋只重复同一尺码，对应第 2 页 → 第 3 页。最小尺码对应第一页，不存在的尺码对应非法输入。类比帮助选择类别，不能代替分页的数值断言。</p></>
    : mode === 'try' ? <><h3>迁移：给新列表写独立预期</h3><p>{newCase.name}：page={newCase.page}，size={newCase.size}。沿用分页契约，请先写出正确返回值。</p><label className="t82-field">我的 want<input type="number" value={answer} onChange={e => {setAnswer(e.target.value);setRevealed(false);}} /></label><label className="t82-field">我的推导<input value={reason} onChange={e => {setReason(e.target.value);setRevealed(false);}} /></label><button type="button" data-testing-action="step" disabled={answer === '' || !Number.isInteger(Number(answer)) || !reason.trim()} onClick={() => setRevealed(true)}>核对迁移</button>{revealed && <div role="status"><p>你的预期 {answer}；契约预期 {newCase.want}。{Number(answer) === newCase.want ? '数值吻合。' : '先检查输入合法性，再计算要跳过的完整页数。'}</p><p>{trace('complete', newCase)}。只修公式得到 {offset('formula', newCase.page,newCase.size)}。</p><p>你的理由：{reason}。这是使用帮助后的练习，不写入正式掌握成绩。</p></div>}<button type="button" onClick={() => {setTask((task+1)%transferCases.length);setAnswer('');setReason('');setRevealed(false);}}>换一组输入</button></>
    : <><h3>{mode === 'steps' ? '逐步追踪一行测试' : '输入类别 → 执行路径 → 断言'}</h3><label className="t82-field">选择要追踪的行<select value={choice} onChange={e => {setChoice(e.target.value);setStep(0);}}>{cases.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {mode === 'steps' ? <><ol className="t82-steps"><li className={step === 0 ? 'active' : ''}>读取独立契约：page={c.page}，size={c.size}，want={c.want}</li>{step >= 1 && <li className={step === 1 ? 'active' : ''}>给输入归类：{categoryOf(c).join('、')}；决定它针对哪一个边界。</li>}{step >= 2 && <li className={step === 2 ? 'active' : ''}>只修公式执行：{trace('formula',c)}；完整修复：{trace('complete',c)}。</li>}{step >= 3 && <li className="active">比较实际与 want：只修公式 {offset('formula',c.page,c.size) === c.want ? 'PASS' : 'FAIL'}；完整修复 PASS。{c.page > 0 && c.size > 0 ? '这个正常输入无法区分两种修复，请换非法输入。' : '非法输入暴露校验缺口。'}</li>}</ol><div className="t82-actions"><button type="button" disabled={step === 0} onClick={() => setStep(step-1)}>上一步</button><button type="button" data-testing-action="step" disabled={step === 3} onClick={() => setStep(step+1)}>执行下一步</button></div></>
      : <><div className="t82-flow"><span>输入 ({c.page}, {c.size})</span><b aria-hidden="true">↓ 归类</b><span>{categoryOf(c).join(' + ')}</span><b aria-hidden="true">↓ 相同输入流向两条路径</b></div><div className="t82-results">{(['formula','complete'] as Version[]).map(v => <article key={v}><h4>{labels[v]}</h4><p>{trace(v,c)}</p><p>↓ 对照独立 want={c.want}</p><strong>{offset(v,c.page,c.size) === c.want ? 'PASS：本行一致' : 'FAIL：本行不一致'}</strong></article>)}</div><p>换一个类别，两条路径的结果会不会分开？普通页上的相同结果，不能说明输入校验已经存在。</p></>}
    </>}
    <div className="t82-actions"><button type="button" data-testing-action="reset" onClick={reset}>重置帮助</button></div>
  </div></section>;
}
