export type Term = '~int' | 'int64' | '~int64' | 'string' | 'bool';
export type InputType = 'int' | 'int64' | 'Cents' | 'string' | 'bool';
export type Config = { any: boolean; terms: Term[]; type: InputType; a: string; b: string };
export type Outcome = 'body-error' | 'argument-error' | 'invalid-input' | 'sum' | 'concat' | 'overflow';
export const terms: Term[] = ['~int', 'int64', '~int64', 'string', 'bool'];
export const inputTypes: InputType[] = ['int', 'int64', 'Cents', 'string', 'bool'];
export const initial: Config = { any: true, terms: [], type: 'Cents', a: '120', b: '30' };
export const outcomes: Record<Outcome, string> = { 'body-error': '函数体无法通过编译', 'argument-error': '函数体合法，但调用类型不满足约束', 'invalid-input': '输入不能表示为该类型的值', sum: '数值相加，返回类型保持不变', concat: '编译通过，但得到字符串拼接', overflow: '编译通过，运行时整数溢出回绕' };
export const maxInt64 = 9223372036854775807n;
export const minInt64 = -9223372036854775808n;
export function constraint(c: Config) { return c.any ? 'any' : c.terms.length ? c.terms.join(' | ') : 'interface{} /* 空接口即 any */'; }
export function permits(c: Config, type: InputType) {
  if (c.any || !c.terms.length) return true;
  return c.terms.some(t => t === '~int' ? type === 'int' : t === '~int64' ? type === 'int64' || type === 'Cents' : t === type);
}
export function toggleTerm(c: Config, term: Term): Config {
  let next = c.terms.filter(t => t !== term);
  if (!c.terms.includes(term)) {
    next = next.filter(t => !(term === 'int64' && t === '~int64') && !(term === '~int64' && t === 'int64'));
    next.push(term);
  }
  return { ...c, any: false, terms: terms.filter(t => next.includes(t)) };
}
export function repair(c: Config): Config { return { ...c, any: false, terms: ['~int', '~int64'] }; }
export function inspect(c: Config): { body: boolean; argument: boolean; outcome: Outcome; output: string; detail: string; exact?: string } {
  const body = !c.any && c.terms.length > 0 && !c.terms.includes('bool');
  const argument = permits(c, c.type);
  if (!body) return { body, argument, outcome: 'body-error', output: '没有运行结果', detail: c.terms.includes('bool') && !c.any ? '约束中包含 bool，bool + bool 无定义。即使本次传入 Cents，函数体仍须对整个集合成立。' : 'any（或空接口）包括 bool、结构体等不支持 + 的类型；具体调用传入数字不能补救函数体。' };
  if (!argument) return { body, argument, outcome: 'argument-error', output: '没有运行结果', detail: `${c.type} 不在约束集合内。int64 仅表示 int64 本身；~int64 还包含底层类型为 int64 的 Cents。` };
  if (c.type === 'string') return { body, argument, outcome: 'concat', output: `string(${JSON.stringify(c.a + c.b)})`, detail: 'string 支持 +，但 + 执行拼接；金额业务需要相加，能编译没有保证业务正确。' };
  if (!/^-?\d+$/.test(c.a) || !/^-?\d+$/.test(c.b)) return { body, argument, outcome: 'invalid-input', output: '请填写十进制整数', detail: '此模拟只接收十进制整数值，不解析 Go 表达式。' };
  const a = BigInt(c.a), b = BigInt(c.b);
  if (a < minInt64 || a > maxInt64 || b < minInt64 || b > maxInt64) return { body, argument, outcome: 'invalid-input', output: '输入超出有符号 64 位范围', detail: '输入值必须先能表示为所选类型；这与两个合法变量相加后溢出是两件事。' };
  const exact = a + b, wrapped = BigInt.asIntN(64, exact), overflow = wrapped !== exact;
  return { body, argument, outcome: overflow ? 'overflow' : 'sum', output: `${c.type}(${wrapped})`, exact: String(exact), detail: overflow ? `数学和为 ${exact}，64 位结果回绕为 ${wrapped}。Go 运行时整数加法不自动报溢出，也不 panic。` : `两个 ${c.type} 值相加，T 仍是 ${c.type}；约束中的 ~ 不会把返回值改成底层类型。` };
}
export function code(c: Config) { const bound = c.any || !c.terms.length ? 'any' : `interface{ ${constraint(c)} }`; const value = (v: string) => c.type === 'string' ? JSON.stringify(v) : /^-?\d+$/.test(v) ? String(BigInt(v)) : v; return `type Cents int64\nfunc sum[T ${bound}](a, b T) T {\n  return a + b\n}\n// a、b 是已具有以下类型的变量\na := ${c.type}(${value(c.a)})\nb := ${c.type}(${value(c.b)})\nresult := sum(a, b)`; }
