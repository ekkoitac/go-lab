export type Strategy = 'all' | 'representation' | 'local';
export type Change = 'rounding' | 'currency';
export interface Config { strategy: Strategy; change: Change; mills: number; currency: 'CNY' | 'XYZ'; owner: boolean }
export const initialConfig: Config = { strategy: 'all', change: 'rounding', mills: 1005, currency: 'CNY', owner: true };
export const strategyNames: Record<Strategy, string> = { all: '共享表示与全部规则', representation: '共享表示与通用校验，隔离业务规则', local: '全部由各业务复制维护' };
export function cents(mills: number, rule: 'nearest' | 'down'): number {
  if (!Number.isSafeInteger(mills) || mills < 0 || mills > 1000000) throw new RangeError('金额必须为 0 至 1000000 的整数厘');
  return rule === 'down' ? Math.floor(mills / 10) : Math.floor((mills + 5) / 10);
}
export function formatCents(value: number | null): string { return value === null ? '拒绝：币种不受支持' : `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`; }
export function inspect(config: Config, phase: number) {
  if (!Number.isInteger(phase) || phase < 0 || phase > 3) throw new RangeError('phase');
  const sharedChange = config.strategy === 'all' || (config.strategy === 'representation' && config.change === 'currency');
  const blocked = phase > 0 && sharedChange && !config.owner;
  const published = phase > 0 && !blocked;
  const settlementUpdated = published && phase >= 2;
  const marketingUpdated = published && phase >= 3 && (sharedChange || config.change === 'currency');
  const output = (team: 'marketing' | 'settlement', updated: boolean): number | null => {
    if (config.change === 'currency' && updated && config.currency === 'XYZ') return null;
    return cents(config.mills, config.change === 'rounding' && updated && (team === 'settlement' || config.strategy === 'all') ? 'down' : 'nearest');
  };
  const marketing = output('marketing', marketingUpdated);
  const settlement = output('settlement', settlementUpdated);
  const expectedMarketing = config.change === 'currency' && config.currency === 'XYZ' ? null : cents(config.mills, 'nearest');
  const expectedSettlement = config.change === 'currency' && config.currency === 'XYZ' ? null : cents(config.mills, config.change === 'rounding' ? 'down' : 'nearest');
  const implementations = published ? (config.change === 'currency' && config.strategy === 'local' ? 2 : 1) : 0;
  const upgrades = Number(settlementUpdated) + Number(marketingUpdated);
  const changedMarketing = marketing !== output('marketing', false);
  const trace = ['v1 基线：双方均采用按分四舍五入；旧校验接受 CNY 和 XYZ。'];
  if (phase > 0) trace.push(blocked ? '没有共同维护者：共享 v2 未发布，双方继续使用 v1。' : sharedChange ? '共同维护者发布共享 v2；调用方仍固定使用 v1，发布库不等于升级应用。' : config.change === 'currency' ? '两个业务副本各准备一次相同校验修复，需要分别维护。' : '只修改结算的本地舍入规则，共享表示未变。');
  if (phase >= 2) trace.push(blocked ? '结算升级被阻止：没有可用的 v2。' : `结算部署变更 → ${formatCents(settlement)}。${config.change === 'rounding' ? '改为向下取整到分。' : '新增 CNY 白名单。'}`);
  if (phase >= 3) trace.push(blocked ? '营销升级被阻止：没有可用的 v2。' : marketingUpdated ? `营销${sharedChange ? '升级同一共享 v2' : '部署自己的校验修复'} → ${formatCents(marketing)}。${config.change === 'rounding' ? '共享舍入规则传播到了估算。' : '双方统一拒绝不受支持的币种。'}` : '营销无需升级：估算规则没有改变，继续按分四舍五入。');
  return { phase, sharedChange, blocked, published, marketing, settlement, expectedMarketing, expectedSettlement, marketingUpdated, settlementUpdated, changedMarketing, marketingMatches: marketing === expectedMarketing, settlementMatches: settlement === expectedSettlement, implementations, upgrades, trace };
}

