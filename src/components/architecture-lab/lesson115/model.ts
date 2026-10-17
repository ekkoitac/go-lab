export type Cause = 'missing' | 'invalid' | 'quota' | 'unknown' | 'mimic';
export type Wrap = 'w' | 'text' | 'none';
export type Method = 'equal' | 'text' | 'is-as';
export type Category = 'missing' | 'invalid' | 'quota' | 'unknown';
export interface Config { cause: Cause; inner: Wrap; outer: Wrap; method: Method; localized: boolean }
export interface ErrorNode { kind: 'sentinel' | 'typed' | 'plain' | 'wrapper'; identity?: string; type?: string; text: string; limit?: number; cause?: ErrorNode }
export interface State { config: Config; phase: number }
export const defaults: Config = { cause: 'missing', inner: 'w', outer: 'w', method: 'equal', localized: false };
export function initial(config: Config = defaults): State { return { config: { ...config }, phase: 0 }; }
export function configure(state: State, patch: Partial<Config>): State { return initial({ ...state.config, ...patch }); }
export function advance(state: State): State { return { ...state, phase: Math.min(4, state.phase + 1) }; }
export function rewind(state: State): State { return { ...state, phase: Math.max(0, state.phase - 1) }; }
export function rootError(config: Config): ErrorNode {
  switch (config.cause) {
    case 'missing': return { kind: 'sentinel', identity: 'ErrMissing', text: config.localized ? '资源不存在' : 'missing' };
    case 'invalid': return { kind: 'sentinel', identity: 'ErrInvalid', text: config.localized ? '输入无效' : 'invalid' };
    case 'quota': return { kind: 'typed', type: '*QuotaError', limit: 3, text: config.localized ? '已达配额上限 3' : 'quota exceeded: limit=3' };
    case 'mimic': return { kind: 'plain', text: 'missing' };
    default: return { kind: 'plain', text: 'SQL demo: connection refused at private-db:5432' };
  }
}
export function wrap(error: ErrorNode, mode: Wrap, context: string): ErrorNode {
  if (mode === 'none') return error;
  return { kind: 'wrapper', text: `${context}: ${error.text}`, ...(mode === 'w' ? { cause: error } : {}) };
}
export function chain(error: ErrorNode): ErrorNode[] { return [error, ...(error.cause ? chain(error.cause) : [])]; }
export function classify(error: ErrorNode, method: Method): { category: Category; evidence: string } {
  if (method === 'equal') {
    if (error.identity === 'ErrMissing') return { category: 'missing', evidence: '== 只检查当前错误对象；当前就是 ErrMissing。' };
    if (error.identity === 'ErrInvalid') return { category: 'invalid', evidence: '== 只检查当前错误对象；当前就是 ErrInvalid。' };
    return { category: 'unknown', evidence: '== 未命中：包装对象不是 sentinel 本身；类型错误也不是这两个 sentinel。' };
  }
  if (method === 'text') {
    const category = error.text.includes('missing') ? 'missing' : error.text.includes('invalid') ? 'invalid' : error.text.includes('quota') ? 'quota' : 'unknown';
    return { category, evidence: `strings.Contains 只查展示文本，得到 ${category}；不能证明错误身份或类型。` };
  }
  const nodes = chain(error);
  if (nodes.some(node => node.identity === 'ErrMissing')) return { category: 'missing', evidence: 'errors.Is 沿可解包链找到同一个 ErrMissing sentinel。' };
  if (nodes.some(node => node.identity === 'ErrInvalid')) return { category: 'invalid', evidence: 'errors.Is 沿可解包链找到同一个 ErrInvalid sentinel。' };
  const typed = nodes.find(node => node.type === '*QuotaError');
  if (typed) return { category: 'quota', evidence: `errors.As 沿链找到可赋值的 *QuotaError；读取结构化 Limit=${typed.limit}，未匹配字符串。` };
  return { category: 'unknown', evidence: '可达链中没有已知 sentinel 或 *QuotaError。保留受控诊断，公开安全兜底。' };
}
export const mapping: Record<Category, { status: number; code: string; message: string }> = {
  missing: { status: 404, code: 'RESOURCE_NOT_FOUND', message: '资源不存在' },
  invalid: { status: 400, code: 'INVALID_INPUT', message: '请检查输入' },
  quota: { status: 429, code: 'QUOTA_EXCEEDED', message: '请求超过配额' },
  unknown: { status: 500, code: 'INTERNAL_ERROR', message: '服务暂时不可用' },
};
export function inspect(state: State) {
  let error = rootError(state.config);
  if (state.phase >= 1) error = wrap(error, state.config.inner, 'repository.load');
  if (state.phase >= 2) error = wrap(error, state.config.outer, 'service.get');
  const classification = state.phase >= 3 ? classify(error, state.config.method) : null;
  return { error, nodes: chain(error), classification, response: state.phase >= 4 ? mapping[classification!.category] : null,
    diagnostic: state.phase >= 4 ? { traceId: 'demo-115', message: error.text, reachableKinds: chain(error).map(node => node.identity ?? node.type ?? node.kind) } : null };
}
export const stages = ['构造原始原因', '存储层包装', '服务层包装', '边界分类', '生成响应与内部诊断'];
