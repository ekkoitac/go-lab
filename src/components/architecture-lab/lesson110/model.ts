export type Config = { algorithmBug: boolean; rollout: 0 | 25 | 100; compatible: boolean; sharedAuthority: boolean; rollback: 'verified' | 'route' }
export const defaults: Config = { algorithmBug: false, rollout: 25, compatible: true, sharedAuthority: true, rollback: 'verified' }
export const phases = ['准备同一批输入', '只读影子对账', '决定是否放量', '执行正式扣款', '同路由超时重试', '故障后回退并重试']
export type Writer = 'old' | 'new'
export type Charge = { key: string; writer: Writer; amount: number; format: 'v1' | 'v2'; authority: string }
export type Snapshot = { phase: number; shadow: { key: string; old: number; next: number }[]; gate: 'pending' | 'pass' | 'blocked'; route: number; charges: Charge[]; retries: number; duplicates: number; oldCanRead: boolean; rollback: string; trace: string[] }
export const requests = [{ key: 'B01', bucket: 10 }, { key: 'B02', bucket: 35 }, { key: 'B03', bucket: 60 }, { key: 'B04', bucket: 85 }]
export const writerName = (writer: Writer) => writer === 'old' ? '旧版' : '新版'
export function simulate(config: Config, requestedPhase: number): Snapshot {
  const phase = Math.max(0, Math.min(5, Math.floor(Number.isFinite(requestedPhase) ? requestedPhase : 0)))
  const s: Snapshot = { phase, shadow: [], gate: 'pending', route: 0, charges: [], retries: 0, duplicates: 0, oldCanRead: true, rollback: '尚未执行', trace: [] }
  const charge = (key: string, writer: Writer) => {
    const authority = config.sharedAuthority ? '共同扣款权威' : `${writerName(writer)}独立幂等表`
    if (s.charges.some(c => c.key === key && c.authority === authority)) { s.trace.push(`${key} → ${writerName(writer)}：${authority}已有记录，返回原结果，新增扣款 0。`); return }
    s.charges.push({ key, writer, amount: 100, format: writer === 'new' && !config.compatible ? 'v2' : 'v1', authority })
    s.trace.push(`${key} → ${writerName(writer)}：记录幂等键并扣款 ¥100；数据 ${writer === 'new' && !config.compatible ? 'v2（旧版不可读）' : 'v1（兼容）'}。`)
  }
  if (phase >= 1) {
    s.shadow = requests.map(r => ({ key: r.key, old: 100, next: config.algorithmBug && r.key === 'B01' ? 120 : 100 }))
    s.trace.push(`复制只读输入：旧、新计算 ${s.shadow.filter(r => r.old !== r.next).length} 笔不同；此步骤两边都不调用扣款。`)
  }
  if (phase >= 2) {
    s.gate = s.shadow.some(r => r.old !== r.next) ? 'blocked' : 'pass'
    s.route = s.gate === 'pass' ? config.rollout : 0
    s.trace.push(s.gate === 'blocked' ? '计费差异阈值为 0：停止放量，所有正式请求保持旧版。' : `样本差异为 0：批准 ${config.rollout}% 稳定分组；样本一致不代表全面正确。`)
  }
  if (phase >= 3) requests.forEach(r => charge(r.key, r.bucket < s.route ? 'new' : 'old'))
  if (phase >= 4) {
    s.retries++
    s.trace.push('B01 扣款成功，但响应丢失：使用相同业务键、相同路由重试。')
    charge('B01', requests[0].bucket < s.route ? 'new' : 'old')
  }
  s.oldCanRead = s.charges.every(c => c.format === 'v1')
  if (phase >= 5) {
    const hasNewWrites = s.charges.some(c => c.writer === 'new')
    const issues = [!s.oldCanRead ? '旧读者无法读取 v2 数据' : '', hasNewWrites && !config.sharedAuthority ? '旧版查不到新版幂等记录' : ''].filter(Boolean)
    if (config.rollback === 'verified' && issues.length) {
      s.rollback = `阻止回退：${issues.join('；')}`
      s.trace.push('回退演练未通过，停止新放量并保留当前处理路径；需要兼容修复 / 对账迁移后重新验证，不能直接恢复服务。')
    } else {
      s.route = 0
      s.rollback = s.oldCanRead ? '路由已回旧版' : '路由已回旧版，但旧读者报错'
      s.trace.push('只切路由不会撤销已经发生的扣款；账本全部保留。')
      if (s.oldCanRead) { s.retries++; charge('B01', 'old') }
      else s.trace.push('读取现存 v2 账单失败，B01 重试在扣款前终止。')
    }
  }
  s.duplicates = s.charges.length - new Set(s.charges.map(c => c.key)).size
  return s
}
export function transferFeedback(choice: string): { correct: boolean; text: string } {
  return choice === 'repair'
    ? { correct: true, text: '先停止放量，核对实际扣款，修复旧读兼容并验证跨版本去重，再决定回退或向前修复。已扣款不能靠切流撤销；需要退款时另走明确的补偿流程。' }
    : { correct: false, text: choice === 'restore' ? '恢复旧快照会丢失新扣款的记录，却不会撤回支付系统里的扣款。应保全账本再对账。' : '切回旧版只改变后续路由：v2 数据与已发生扣款仍在，旧幂等表也没有新记录。重新选择能先验证这些条件的方案。' }
}
