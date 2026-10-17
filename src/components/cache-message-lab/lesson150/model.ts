export type Kind = 'snapshot' | 'delta';
export type Rule = 'arrival' | 'version' | 'contiguous';
export type Config = {kind: Kind; rule: Rule; delivery: 'late' | 'missing'};
export type Event = {version: number; status: string; amount: number; delta: number; eventTime: string; arrival: number};
export type Physical = {phase: number; version: number; status: string; amount: number; buffer: number[]; applied: number[]; current: Event | null; action: string; note: string};
export type Prediction = {value: string; reason: string};
export type Timeline = {config: Config; phase: number; prediction: Prediction | null};
export const defaults: Config = {kind: 'snapshot', rule: 'arrival', delivery: 'late'};
export const events: Record<number, Event> = {
  2: {version: 2, status: '已支付', amount: -100, delta: -100, eventTime: '10:00:04', arrival: 2},
  3: {version: 3, status: '已退款', amount: 0, delta: 100, eventTime: '10:00:03', arrival: 1},
};
export const stages = ['准备乱序投递', 'v3 退款先到', 'v2 付款迟到或缺失', 'v2 重投或缺口等待', '核对版本与业务净额', '从可靠事件源回补缺口'];
function validate(c: Config) {
  if (!['snapshot', 'delta'].includes(c.kind) || !['arrival', 'version', 'contiguous'].includes(c.rule) || !['late', 'missing'].includes(c.delivery)) throw new Error('未知配置');
  if ((c.kind === 'snapshot' && c.rule === 'contiguous') || (c.kind === 'delta' && c.rule === 'arrival')) throw new Error('此事件语义不支持该规则');
}
export function initial(config: Config = defaults): Timeline { validate(config); return {config: {...config}, phase: 0, prediction: null}; }
export function step(t: Timeline, prediction?: Prediction): Timeline {
  if (t.phase === 5) return t;
  const p = t.phase ? t.prediction : prediction;
  if (!p || !['-100', '0', '100'].includes(p.value) || !p.reason.trim()) throw new Error('请先提交预测和理由');
  return {...t, phase: t.phase + 1, prediction: {...p}};
}
export function back(t: Timeline): Timeline { return {...t, phase: Math.max(0, t.phase - 1), prediction: t.phase <= 1 ? null : t.prediction}; }
export function receive(state: Physical, c: Config, event: Event): Physical {
  const s: Physical = {...state, buffer: [...state.buffer], applied: [...state.applied], current: {...event}};
  const before = `v${s.version} / ${s.amount} 元`;
  const apply = (e: Event) => { s.version = e.version; s.status = e.status; s.amount = c.kind === 'snapshot' ? e.amount : s.amount + e.delta; s.applied.push(e.version); };
  if (c.rule === 'arrival') {
    apply(event); s.action = '按到达直接覆盖'; s.note = `${before} → v${s.version} / ${s.amount} 元。只看谁最后到，旧付款快照也能覆盖新退款快照。`;
  } else if (event.version <= s.version) {
    s.action = event.version === s.version ? '相同版本：忽略重复' : '更低版本：拒绝覆盖';
    s.note = `${before} 保持不变。${c.kind === 'snapshot' ? '完整快照已经包含此前结果。' : c.rule === 'version' ? '这里照搬快照规则；如果曾跳版本，较低的必要增量会被错误丢弃。' : '连续版本水位证明此前增量已执行，不重复施加。'}`;
  } else if (c.rule === 'version') {
    apply(event); s.action = c.kind === 'snapshot' ? '接受更高版本快照' : '错误示范：直接跳到更高增量';
    s.note = `${before} → v${s.version} / ${s.amount} 元。${c.kind === 'snapshot' ? '快照 v3 自带完整退款结果，允许跨过 v2。' : '只执行了到达的增量；水位跳到 v3 不代表 v2 的扣款执行过。'}`;
  } else if (event.version > s.version + 1) {
    if (!s.buffer.includes(event.version)) s.buffer.push(event.version);
    s.buffer.sort((a,b)=>a-b); s.action = '发现缺口：缓冲未来增量'; s.note = `${before} 保持不变；缺少 v${s.version+1}，v${event.version} 放入缓冲区，尚未产生金额效果。`;
  } else {
    apply(event); const consumed = [event.version];
    while (s.buffer.includes(s.version + 1)) { const next = s.version + 1; s.buffer = s.buffer.filter(v=>v!==next); apply(events[next]); consumed.push(next); }
    s.action = '按连续版本应用增量'; s.note = `${before} → v${s.version} / ${s.amount} 元。依次执行 ${consumed.map(v=>`v${v}（${events[v].delta>0?'+':''}${events[v].delta} 元）`).join(' → ')}；每一步只执行一次。`;
  }
  return s;
}
export function inspect(c: Config, phase: number): Physical {
  validate(c); if (!Number.isInteger(phase) || phase < 0 || phase > 5) throw new Error('阶段越界');
  let s: Physical = {phase: 0, version: 1, status: '已创建', amount: 0, buffer: [], applied: [], current: null, action: '等待投递', note: '模型中的金额是这笔订单累计收支：付款 -100 元，退款 +100 元，最终应为 0 元。业务版本由同一聚合分配，事件时间故意模拟了时钟偏差。'};
  for (let p=1;p<=phase;p++) {
    if (p===1) s=receive(s,c,events[3]);
    else if ((p===2 || p===3) && c.delivery==='late') s=receive(s,c,{...events[2],arrival:p});
    else if (p===2 || p===3) s={...s,current:null,action:p===2?'v2 在链路中缺失':'等待并发现超时',note:`没有收到 v2，不能假装扣款已经执行。当前水位 v${s.version}，缓冲 [${s.buffer.join(', ')}]。等待不会自行补出缺失事件。`};
    else if (p===4) s={...s,current:null,action:'核对源记录',note:`可靠源记录：v2 付款 -100，v3 退款 +100，期望净额 0。当前净额 ${s.amount}，已执行版本 [${s.applied.join(', ')}]。${s.buffer.length?'缓冲中仍有 v3，需回补 v2。':c.kind==='delta' && !s.applied.includes(2)?'水位虽是 v3，但缺少 v2 的效果。':'结合版本与记录检查，不能仅凭净额为 0 判定已追平。'}`};
    else if (c.delivery==='missing') s=receive(s,c,{...events[2],arrival:5});
    else s={...s,current:null,action:'核对完成',note:`本轮没有待回补的网络缺口。最终 v${s.version} / ${s.amount} 元。${c.kind==='delta' && s.amount!==0?'错误水位已经丢掉必要增量；需重建投影或受控补偿，不能仅切换规则并声称自动恢复。':'用同一投递顺序切换事件语义或处理规则，比较因果差异。'}`};
    s={...s,phase:p};
  }
  return s;
}
