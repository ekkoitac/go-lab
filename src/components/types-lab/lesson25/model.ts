export type Payload = 'int' | 'string' | 'empty' | 'float64' | 'Version' | 'typedNil' | 'nil';
export type Target = 'int' | 'string' | 'float64' | 'Version' | '*Version';
export type Form = 'single' | 'checked';
export type Config = { payload: Payload; target: Target; form: Form };
export type Outcome = 'success' | 'zero' | 'panic';
export const initial: Config = { payload: 'int', target: 'string', form: 'single' };
export const payloads: Record<Payload, { label: string; type: Target | null; value: string; code: string }> = {
  int: { label: 'int(42)', type: 'int', value: '42', code: '42' },
  string: { label: 'string("42")', type: 'string', value: '"42"', code: '"42"' },
  empty: { label: 'string("")：空字符串', type: 'string', value: '""', code: '""' },
  float64: { label: 'float64(42)', type: 'float64', value: '42', code: 'float64(42)' },
  Version: { label: 'Version(42)：命名类型', type: 'Version', value: '42', code: 'Version(42)' },
  typedNil: { label: '(*Version)(nil)：带类型的 nil', type: '*Version', value: 'nil', code: '(*Version)(nil)' },
  nil: { label: 'nil 接口', type: null, value: '无动态值', code: 'nil' },
};
export const targets: Target[] = ['int', 'string', 'float64', 'Version', '*Version'];
export function zero(target: Target) { return target === 'string' ? '""' : target === '*Version' ? 'nil' : '0'; }
export function inspect(c: Config) {
  const source = payloads[c.payload];
  const matched = source.type === c.target;
  const outcome: Outcome = matched ? 'success' : c.form === 'single' ? 'panic' : 'zero';
  const value = outcome === 'panic' ? null : matched ? source.value : zero(c.target);
  const ok = c.form === 'checked' ? matched : null;
  const explanation = matched
    ? `动态类型 ${source.type} 与目标 ${c.target} 相同，取出原值 ${source.value}。${source.value === 'nil' ? '断言成功不代表指针可以解引用。' : ''}`
    : `${source.type === null ? '接口没有动态类型' : `动态类型 ${source.type} 不等于目标 ${c.target}`}。${outcome === 'panic' ? '单值形式触发 panic，结果变量不会得到一个零值。' : `两结果形式得到 ${c.target} 的零值 ${zero(c.target)} 和 ok=false；原始载荷没有被转换。`}`;
  return { matched, outcome, value, ok, source, explanation };
}
export function assertionCode(c: Config) { return `${c.form === 'single' ? 'x' : 'x, ok'} := v.(${c.target})`; }
export function repair(c: Config): Config { return { ...c, form: 'checked' }; }
export type Policy = 'single' | 'ignore' | 'guard';
export function handle(payload: Payload, policy: Policy) {
  const result = inspect({ payload, target: 'string', form: policy === 'single' ? 'single' : 'checked' });
  const accepted = result.outcome !== 'panic' && (policy === 'ignore' || result.matched);
  const response = result.outcome === 'panic' ? 'panic：请求中断' : accepted ? `accepted ${result.value}` : `unsupported ${result.source.type ?? '<nil>'}`;
  return { ...result, accepted, response, contract: result.outcome !== 'panic' && accepted === result.matched };
}


