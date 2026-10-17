export type PoolConfig = { resetOnPut: boolean; discard: boolean; hasNew: boolean; staleWrite: boolean };
export type PoolSource = 'reused' | 'new' | 'nil';
export type PoolState = { step: number; pool: string | null; owner: 'A' | 'pool' | 'B' | 'none'; id: string | null; content: string; allocations: number; source: PoolSource | null; violation: boolean; feedback: string };
export const defaultConfig: PoolConfig = { resetOnPut: false, discard: true, hasNew: false, staleWrite: false };
export const initialPool = (): PoolState => ({ step: 0, pool: null, owner: 'A', id: 'buffer-1', content: 'A:订单;', allocations: 1, source: null, violation: false, feedback: 'A 正在使用 buffer-1。选择运行时分支与修复方案，先预测 B.Get 的来源。' });
export function sourceFor(config: PoolConfig): PoolSource { return config.discard ? config.hasNew ? 'new' : 'nil' : 'reused'; }
export function nextPool(previous: PoolState, config: PoolConfig): PoolState {
  if (previous.step >= 5) return previous;
  const s = { ...previous, step: previous.step + 1 };
  if (s.step === 1) return { ...s, pool: s.id, owner: 'pool', content: config.resetOnPut ? '' : s.content, feedback: config.resetOnPut ? 'Reset 清空逻辑内容，再 Put：A 必须停止使用该对象。Reset 不保证底层字节被安全擦除。' : 'Put 不会自动 Reset：A 的旧内容仍在对象中；A 必须停止使用。' };
  if (s.step === 2) return config.discard ? { ...s, pool: null, id: null, owner: 'none', content: '', feedback: '本次选择“运行时丢弃池中项”的合法分支。不是断言每次 GC 必清空，Pool 也不是可靠缓存。' } : { ...s, feedback: '本次选择“保留且后续 Get 命中该对象”的合法分支。现实中即使刚 Put，也不保证取回它。' };
  if (s.step === 3) {
    if (s.pool) return { ...s, pool: null, owner: 'B', source: 'reused', feedback: `本次 B.Get 命中 ${s.id}，内容为 ${s.content || '空'}；没有新增分配。` };
    if (config.hasNew) return { ...s, id: 'buffer-2', owner: 'B', content: '', allocations: s.allocations + 1, source: 'new', feedback: 'Get 无可用项 → 调用 New → B 获得新的空缓冲。重建是正常路径。' };
    return { ...s, source: 'nil', feedback: 'Get 无可用项且没有 New → 返回 nil。若直接 .(*bytes.Buffer) 将 panic；流程在模型中继续展示后果。' };
  }
  if (s.step === 4) return s.source === 'nil' ? { ...s, feedback: 'B 没有缓冲，无法 WriteString。需要提供 New 或显式处理 nil。' } : { ...s, content: s.content + 'B:响应;', feedback: s.content ? 'B 追加响应后混入 A 的旧内容：修复归还时的重置，再重跑保留分支。' : 'B 从空内容开始，输出只有自己的响应。' };
  if (config.staleWrite) return { ...s, violation: true, content: s.source === 'reused' ? s.content + 'A:越权;' : s.content, feedback: s.source === 'reused' ? 'A 在 Put 后仍通过旧引用写入同一对象，B 的内容被污染。若并发访问，还可能产生数据竞争。' : 'A 在 Put 后使用旧引用仍违反交接约定。本次 B 没取回旧对象，因此 B 的内容没有变化；这不代表写法安全。' };
  return { ...s, feedback: 'A 在 Put 后停止访问，交接约定得到遵守。再试“保留 + 未重置”和“丢弃 + 未设置 New”，检验两个不同边界。' };
}
export function poolAt(step: number, config: PoolConfig): PoolState { let state = initialPool(); for (let i = 0; i < Math.min(5, Math.max(0, step)); i++) state = nextPool(state, config); return state; }
