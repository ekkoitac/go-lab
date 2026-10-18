export type Policy = 'zero' | 'defaults' | 'presence' | 'replace-zero';
export type Config = { limit: number; enabled: boolean; name: string };
export type Input = { policy: Policy; provided: boolean; limit: number; enabled: boolean; pending: number };
export type Snapshot = { phase: number; config: Config | null; started: number | null; operation: string; cause: string };
export const initialInput: Input = { policy: 'zero', provided: false, limit: 0, enabled: true, pending: 5 };
export function validateInput(input: Input) {
  if (!Number.isInteger(input.limit) || input.limit < 0 || input.limit > 6 || !Number.isInteger(input.pending) || input.pending < 0 || input.pending > 8) throw new RangeError('限额须为 0–6，待办须为 0–8 的整数');
}
export function resolveConfig(input: Input): Config {
  validateInput(input);
  if (input.policy === 'zero') return { limit: 0, enabled: false, name: '' };
  if (input.policy === 'defaults') return { limit: 3, enabled: true, name: 'download' };
  const limit = input.policy === 'replace-zero' ? (input.limit === 0 || !input.provided ? 3 : input.limit) : (input.provided ? input.limit : 3);
  return { limit, enabled: input.enabled, name: 'download' };
}
export function scheduled(config: Config, pending: number) { return config.enabled ? Math.min(config.limit, pending) : 0; }
export function trace(input: Input): Snapshot[] {
  const config = resolveConfig(input);
  const zero = { limit: 0, enabled: false, name: '' };
  const cause = input.policy === 'zero' ? '未执行业务初始化：三个字段仍保持类型零值。' : input.policy === 'defaults' ? '构造函数显式写入 3、true 和 download；不是 Go 自动推断。' : input.policy === 'replace-zero' && input.provided && input.limit === 0 ? '把 0 当成未提供：显式暂停被错误覆盖为 3。' : !input.provided ? 'Provided=false：未提供限额，因此填入业务默认 3。' : `Provided=true：保留用户输入 ${input.limit}，包括有意选择的 0。`;
  return [
    { phase: 0, config: null, started: null, operation: '执行前', cause: '下一步声明 Config；业务默认尚未写入。' },
    { phase: 1, config: zero, started: null, operation: 'var c Config', cause: '结构体字段递归初始化：int → 0，bool → false，string → 空字符串。没有随机垃圾值。' },
    { phase: 2, config, started: null, operation: '应用选中的配置策略', cause },
    { phase: 3, config, started: scheduled(config, input.pending), operation: '检查 Enabled，再按 Limit 调度', cause: !config.enabled ? 'Enabled=false，调度入口关闭；即使有待办也不启动。' : `Enabled=true，启动 min(限额 ${config.limit}, 待办 ${input.pending}) = ${scheduled(config, input.pending)} 个任务。${config.limit === 0 ? '零限额在本业务表示暂停。' : ''}` },
  ];
}
