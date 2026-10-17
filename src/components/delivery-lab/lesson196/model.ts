export type Recovery = 'code' | 'backup' | 'forward';
export interface Config { recovery: Recovery; preserveRaw: boolean; lossy: boolean; newOrders: number; rpoMinutes: number }
export interface Row { id: string; cents?: number; decimal?: string; raw?: number; createdMinute: number }
export interface State { stage: number; app: 'v1' | 'v2-broken' | 'v2-fixed'; rows: Row[]; backup: Row[]; ledger: Row[]; event: string; }
export const defaults: Config = { recovery: 'code', preserveRaw: true, lossy: true, newOrders: 2, rpoMinutes: 0 };
export const stages = ['原始订单', '保存备份', '迁移金额', '接受新写入', '回滚旧代码', '执行恢复路径', '核账验收'];
const seed = (): Row[] => [{ id: 'A', cents: 1299, createdMinute: -2 }, { id: 'B', cents: 2501, createdMinute: -1 }];
export function initialState(): State { return { stage: 0, app: 'v1', rows: seed(), backup: [], ledger: seed(), event: '订单 A=1299 分、B=2501 分；外部支付账保存原始已收金额。' }; }
export function advance(s: State, config: Config): State {
  if (s.stage >= 6) return s;
  const n: State = { ...s, stage: s.stage + 1, rows: s.rows.map(r => ({ ...r })), backup: s.backup.map(r => ({ ...r })), ledger: s.ledger.map(r => ({ ...r })) };
  if (n.stage === 1) { n.backup = n.rows.map(r => ({ ...r })); n.event = 't=0 保存 A、B 快照；此备份不包含之后的订单。'; }
  if (n.stage === 2) { n.app = 'v2-broken'; n.rows = n.rows.map(r => ({ id: r.id, createdMinute: r.createdMinute, decimal: ((r.cents ?? 0) / 100).toFixed(config.lossy ? 0 : 2), ...(config.preserveRaw ? { raw: r.cents } : {}) })); n.event = config.lossy ? '迁移按整元四舍五入：12.99→13，25.01→25。旧 cents 字段被移除，小数信息丢失。' : '迁移保留两位小数，但移除了旧 cents 字段；旧应用仍不兼容。'; }
  if (n.stage === 3) { for (let i = 0; i < config.newOrders; i++) { const cents = 701 + i * 100; const row: Row = { id: `N${i + 1}`, cents, createdMinute: 5 + i }; n.ledger.push(row); n.rows.push({ id: row.id, decimal: (cents / 100).toFixed(2), createdMinute: row.createdMinute, ...(config.preserveRaw ? { raw: cents } : {}) }); } n.event = `备份后新增 ${config.newOrders} 笔已支付订单；支付账不随数据库回滚。新订单保留两位小数。`; }
  if (n.stage === 4) { n.app = 'v1'; n.event = '旧二进制部署成功；v1 只识别整数 cents，当前全部记录读取失败。'; }
  if (n.stage === 5) {
    if (config.recovery === 'code') n.event = '只回滚代码：数据没有改变，旧应用继续读失败。';
    if (config.recovery === 'backup') { n.rows = n.backup.map(r => ({ ...r })); n.event = `恢复 t=0 备份：A、B 可读；丢失 ${config.newOrders} 笔备份后订单，已发生的支付没有撤销。`; }
    if (config.recovery === 'forward') { n.app = 'v2-fixed'; n.rows = n.rows.map(r => ({ ...r, cents: r.raw ?? Math.round(Number(r.decimal) * 100) })); n.event = config.preserveRaw ? '修复版使用迁移来源中的原始分值，补回兼容字段；保留全部新写入。' : config.lossy ? '修复版只能把舍入后的字符串转回分；不可逆信息没有来源，单笔金额出现差异。' : '无损字符串可精确转回分；补回兼容字段并保留新写入。'; }
  }
  if (n.stage === 6) { const report = audit(n, config); n.event = report.passed ? '核账通过：订单集合与每笔金额一致、读取成功、恢复点符合目标。' : `核账未通过：${report.missingIds.length} 笔缺失，${report.mismatchIds.length} 笔金额不符，${report.unreadableIds.length} 笔不可读。请按证据修复后再验收。`; }
  return n;
}
export function audit(s: State, config: Config) {
  const missingIds = s.ledger.filter(l => !s.rows.some(r => r.id === l.id)).map(l => l.id);
  const unreadableIds = s.rows.filter(r => r.cents === undefined || s.app === 'v2-broken').map(r => r.id);
  const mismatchIds = s.rows.filter(r => r.cents !== undefined && s.ledger.find(l => l.id === r.id)?.cents !== r.cents).map(r => r.id);
  const lostWindowMinutes = missingIds.length ? Math.max(...s.ledger.map(r => r.createdMinute), 0) : 0;
  const expectedCents = s.ledger.reduce((sum, r) => sum + (r.cents ?? 0), 0);
  const actualCents = s.rows.reduce((sum, r) => sum + (r.cents ?? Math.round(Number(r.decimal) * 100)), 0);
  return { missingIds, mismatchIds, unreadableIds, lostWindowMinutes, rpoMet: lostWindowMinutes <= config.rpoMinutes, expectedCents, actualCents, passed: !missingIds.length && !mismatchIds.length && !unreadableIds.length && lostWindowMinutes <= config.rpoMinutes };
}
export function run(config: Config): State { let state = initialState(); for (let i = 0; i < 6; i++) state = advance(state, config); return state; }
