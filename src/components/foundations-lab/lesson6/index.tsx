import { useState } from 'react';
import { inspectText, initialText, rangeSnapshot, ownerAt, sliceBytes, countText, hex, type TextModel, type CountUnit } from './model';
import './style.css';
const samples = [['混合文本', initialText], ['组合重音', 'e\u0301'], ['预组合重音', 'é'], ['家庭 emoji', '👨‍👩‍👧‍👦'], ['空串', '']];
function TextInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return <><label>UTF-8 文本（最多 40 个输入单位）<input value={value} maxLength={40} onChange={e => onChange(e.target.value)} /></label><div className="fl6-buttons">{samples.map(([name, text]) => <button key={name} onClick={() => onChange(text)}>{name}</button>)}</div></>;
}
function LinkedView({ model, selected, onSelect }: { model: TextModel; selected: number; onSelect: (index: number) => void }) {
  const rune = model.runes[selected];
  return <div className="fl6-linked"><h4>码点：点选一个 rune</h4><div className="fl6-cells">{model.runes.map((cell, i) => <button key={i} aria-pressed={selected === i} onClick={() => onSelect(i)}><strong>{cell.text === ' ' ? '空格' : cell.text}</strong><small>{cell.code}</small><small>起点 {cell.offset} · {cell.width} 字节</small></button>)}</div><h4>UTF-8 字节：点选也能反查码点</h4><div className="fl6-bytes">{model.bytes.map((byte, i) => <button key={i} aria-label={`字节偏移 ${i}，十六进制 ${hex(byte)}`} aria-pressed={ownerAt(model, i) === selected} onClick={() => onSelect(ownerAt(model, i))}><small>{i}</small><strong>{hex(byte)}</strong></button>)}</div><p className="fl6-feedback" aria-live="polite">{rune ? `选中 ${JSON.stringify(rune.text)}：${rune.code} → ${rune.bytes.map(hex).join(' ')}；s[${rune.offset}] 只返回 byte ${rune.bytes[0]}，不会自动读取整个 rune。` : '空字符串没有字节，也没有 rune。'}</p></div>;
}
export default function Lab() {
  const [text, setText] = useState(initialText);
  const [prediction, setPrediction] = useState('');
  const [reason, setReason] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const model = inspectText(text);
  const snapshot = rangeSnapshot(text, step);
  const change = (next: string) => { setText(next); setStep(0); setSelected(0); setPrediction(''); setReason(''); setRevealed(false); };
  const move = (next: number) => { setStep(next); setSelected(Math.max(0, next - 1)); };
  return <section className="fl6" data-testid="foundations-lab-6"><header><p className="fl6-eyebrow">同一段文本 · 三种计量单位</p><h3>把昵称放到 UTF-8 显微镜下</h3><p>输入文本，先预测字节数，再把 range 的每次解码与字节位置对应起来。</p></header><TextInput value={text} onChange={change} /><fieldset disabled={revealed}><legend>揭晓前记录你的判断</legend><label>你预测 len(s) 是多少字节？<input type="number" min="0" max="160" step="1" value={prediction} onChange={e => setPrediction(e.target.value)} /></label><label>预测理由<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="各符号可能分别占几字节？" /></label></fieldset><div className="fl6-buttons"><button disabled={revealed || prediction === '' || !Number.isInteger(Number(prediction)) || Number(prediction) < 0 || !reason.trim()} onClick={() => setRevealed(true)}>提交预测并揭晓</button><button onClick={() => change(initialText)}>重置实验</button></div><div className="fl6-model" data-testid="live-model" data-state={JSON.stringify({ text, revealed, step, selected, nextOffset: revealed ? snapshot.nextOffset : null })}>{!revealed ? <p>结果尚未揭晓。改变文本会清除上一轮判断，方便只改变一个条件再预测。</p> : <><div className="fl6-metrics"><span>len(s)<strong>{model.bytes.length}</strong>字节</span><span>rune 计数<strong>{model.runes.length}</strong>码点</span><span>字素簇参考<strong>{model.graphemes.length}</strong>簇</span></div><p className="fl6-feedback">{Number(prediction) === model.bytes.length ? '字节数预测一致。' : `你预测 ${prediction} 字节，实际 ${model.bytes.length} 字节。`} 你的理由：{reason}</p><LinkedView model={model} selected={selected} onSelect={setSelected} /><h4>单步执行 for i, r := range s</h4><div className="fl6-buttons"><button disabled={step === model.runes.length} onClick={() => move(step + 1)}>range 下一步</button><button disabled={step === 0} onClick={() => move(step - 1)}>回退一步</button><button onClick={() => move(0)}>回到循环前</button></div><div className="fl6-feedback" aria-live="polite"><strong>{snapshot.current ? `第 ${step} 次：i=${snapshot.current.offset}，r=${snapshot.current.code}` : '循环前：尚未读取 rune'}</strong><p>{snapshot.current ? `从字节 ${snapshot.current.offset} 解码 ${snapshot.current.width} 个字节，得到 ${JSON.stringify(snapshot.current.text)}；下一读取位置为 ${snapshot.nextOffset}。` : 'range 的 i 是字节偏移；r 是解码出的 Unicode 码点。'}{snapshot.done ? ' 已到字符串末尾，没有下一次迭代。' : ' 点击下一步，观察索引如何前进。'}</p><p>已访问字节起点：{snapshot.visited.map(cell => cell.offset).join(' → ') || '无'}</p></div><p>字素簇分组：{model.graphemes.map((item, i) => <span className="fl6-cluster" key={i}>{JSON.stringify(item)}</span>)}{!model.graphemes.length && '无'}。试试“组合重音”，检验“一个 rune 就是一个可见字符”的说法。</p></>}</div><p className="fl6-note">此模型输入为有效 UTF-8 文本，不模拟 Go 字符串中的任意非法字节；孤立 UTF-16 代理项编码为 U+FFFD。字素簇参考采用浏览器 Unicode 分割，不等同于字体显示宽度，Go 标准库的 []rune 不做字素分割。观察与帮助练习不计正式掌握成绩。</p></section>;
}
function Example() {
  const [text, setText] = useState('中🙂');
  const [unit, setUnit] = useState<CountUnit>('bytes');
  const [limit, setLimit] = useState(4);
  const model = inspectText(text);
  const count = model[unit].length;
  return <><h4>三把尺：给同一昵称设置容量</h4><p>快递重量、物品数量、礼盒数量各有单位。对同一文本切换计量尺，看“上限 4”为什么得出不同结果。</p><TextInput value={text} onChange={setText} /><label>限制使用的单位<select value={unit} onChange={e => setUnit(e.target.value as CountUnit)}><option value="bytes">字节：传输预算</option><option value="runes">码点：rune 处理</option><option value="graphemes">字素簇：界面计数参考</option></select></label><label>容量上限 {limit}<input type="range" min="0" max="16" value={limit} onChange={e => setLimit(Number(e.target.value))} /></label><div className="fl6-feedback" data-testid="live-model" data-state={JSON.stringify({ text, unit, limit, count })}>当前使用 {count} / {limit} {unit === 'bytes' ? '字节' : unit === 'runes' ? '码点' : '字素簇'}：<strong>{count <= limit ? '可以通过' : `超出 ${count - limit}`}</strong><p>同一文本另两把尺也仍然有效：{model.bytes.length} 字节 / {model.runes.length} 码点 / {model.graphemes.length} 字素簇。先说明业务单位，才能判断哪条限制正确。</p></div><p className="fl6-note">类比边界：字节不是物理重量，字素簇也不是固定数量码点的盒子；Unicode 决定具体分组。</p></>;
}
function Diagram() {
  const [text, setText] = useState(initialText);
  const [selected, setSelected] = useState(1);
  return <><h4>双向连线：一个字节属于哪个码点？</h4><p>点选中间字节，找到覆盖它的完整 rune，再反查起始偏移。每个按钮都支持键盘。</p><TextInput value={text} onChange={value => { setText(value); setSelected(0); }} /><div data-testid="live-model" data-state={JSON.stringify({ text, selected })}><LinkedView model={inspectText(text)} selected={selected} onSelect={setSelected} /></div></>;
}
function Steps() {
  const [text, setText] = useState(initialText);
  const [end, setEnd] = useState(2);
  const model = inspectText(text);
  const slice = sliceBytes(text, end);
  return <><h4>从切片位置反推：为什么截到半个中文？</h4><p>逐步移动 s[:end] 的右边界，检查保留的字节能否组成完整 UTF-8。切片本身合法，不会自动修复编码。</p><TextInput value={text} onChange={value => { setText(value); setEnd(0); }} /><label>右边界 end = {end}<input type="range" min="0" max={model.bytes.length} value={end} onChange={e => setEnd(Number(e.target.value))} /></label><div className="fl6-buttons"><button disabled={end === 0} onClick={() => setEnd(end - 1)}>回退一个字节</button><button disabled={end === model.bytes.length} onClick={() => setEnd(end + 1)}>增加一个字节</button><button onClick={() => { setText(initialText); setEnd(2); }}>重置切片</button></div><div className="fl6-feedback" data-testid="live-model" data-state={JSON.stringify({ text, end, valid: slice.valid })} aria-live="polite"><p>保留 [0, {end})：<code>{slice.bytes.map(hex).join(' ') || '空'}</code></p><strong>{slice.valid ? '完整 UTF-8' : '不完整 UTF-8：切到了码点内部'}</strong><p>浏览器按替代字符解码的预览：{JSON.stringify(slice.display)}</p><p>完整边界：0{model.runes.map(r => `、${r.offset + r.width}`)}。边界完整只保证码点完整；仍可能拆开 e 与组合重音，或一个 emoji 序列。</p></div></>;
}
function Repair() {
  const [text, setText] = useState('猫🙂');
  const [unit, setUnit] = useState<CountUnit>('bytes');
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const clear = () => { setAnswer(''); setReason(''); setChecked(false); };
  const count = countText(text, unit);
  return <><h4>诊断修复：两码点昵称为何被拒绝？</h4><p>接口约定“最多 2 个 Unicode 码点”，原实现却用 len(s)。选择计数方法，预测是否通过，再运行。之后用组合重音检查边界。</p><TextInput value={text} onChange={next => { setText(next); clear(); }} /><label>计数代码<select value={unit} onChange={e => { setUnit(e.target.value as CountUnit); clear(); }}><option value="bytes">len(s)</option><option value="runes">utf8.RuneCountInString(s)</option><option value="graphemes">字素簇分割后计数</option></select></label><fieldset disabled={checked}><legend>运行前的判断</legend><label>当前代码会放行吗？<select value={answer} onChange={e => setAnswer(e.target.value)}><option value="">请选择</option><option value="yes">放行</option><option value="no">拒绝</option></select></label><label>为什么？<textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></label></fieldset><div className="fl6-buttons"><button disabled={checked || !answer || !reason.trim()} onClick={() => setChecked(true)}>运行并核对契约</button><button onClick={() => { setText('猫🙂'); setUnit('bytes'); clear(); }}>重置修复</button></div><div data-testid="live-model" data-state={JSON.stringify({ text, unit, checked })} aria-live="polite">{checked && <div className="fl6-feedback"><strong>当前计数 {count}，结果{count <= 2 ? '放行' : '拒绝'}；{(answer === 'yes') === (count <= 2) ? '预测一致' : '与预测不一致'}。</strong><p>你的理由：{reason}</p><p>契约要求按码点，实际码点数 {countText(text, 'runes')}。{unit === 'runes' ? '计数单位符合契约。可再尝试 e 加组合重音与家庭 emoji。' : '当前单位与契约不同。即便本次结果碰巧相同，也不能证明修复正确。请选择 rune 计数后再检验。'}</p></div>}</div><p className="fl6-note">这是有提示的诊断练习，不计正式独立掌握。</p></>;
}
export function Help({ mode }: { mode: string }) { return <section className="fl6 fl6-help" data-testid="foundations-help-6">{mode === 'example' ? <Example /> : mode === 'diagram' ? <Diagram /> : mode === 'steps' ? <Steps /> : <Repair />}</section>; }
