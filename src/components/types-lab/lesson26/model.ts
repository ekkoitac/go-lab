export type Input = 'int' | 'string' | 'bool' | 'float64' | 'nil' | 'typedNil';
export type Branch = 'int' | 'string' | '*User' | 'nil';
export type Config = { input: Input; text: string; branches: Branch[]; grouped: boolean; fallback: boolean };
export const initial: Config = { input:'bool', text:'42', branches:['int','string'], grouped:false, fallback:false };
export const inputs: {id:Input; label:string}[] = [{id:'int',label:'int(42)'},{id:'string',label:'string 文本'},{id:'bool',label:'bool(true)'},{id:'float64',label:'float64(42)'},{id:'nil',label:'nil 接口'},{id:'typedNil',label:'(*User)(nil)'}];
export function inspect(c: Config) {
  const dynamicType = c.input === 'nil' ? null : c.input === 'typedNil' ? '*User' : c.input;
  const value = c.input === 'nil' ? '无值' : c.input === 'typedNil' ? 'nil 指针' : c.input === 'string' ? JSON.stringify(c.text) : c.input === 'bool' ? 'true' : '42';
  const cases = c.grouped ? ['int, string', ...c.branches.filter(b => b !== 'int' && b !== 'string')] : [...c.branches];
  const match = cases.find(b => b === (dynamicType ?? 'nil') || (b === 'int, string' && (dynamicType === 'int' || dynamicType === 'string')));
  const route = match ?? (c.fallback ? 'default' : '无匹配');
  const staticType = !match || match === 'nil' || match === 'int, string' ? 'any' : match;
  const status = match ? '支持' : c.fallback ? '明确拒绝' : '空成功';
  const output = match === 'int' ? 'count:42' : match === 'string' ? `label:${c.text}` : match === '*User' ? 'user:nil（未解引用）' : match === 'nil' ? 'empty input' : match === 'int, string' ? `value:${c.input === 'string' ? c.text : '42'}` : c.fallback ? `unsupported ${dynamicType ?? '<nil>'}` : '""';
  return {dynamicType, value, cases, route, staticType, status, output};
}
export function toggle(c: Config, branch: Branch): Config {
  return { ...c, branches:c.branches.includes(branch) ? c.branches.filter(b => b !== branch) : [...c.branches, branch], grouped: branch === 'int' || branch === 'string' ? false : c.grouped };
}
export function repair(c: Config): Config { return {...c, branches:[...c.branches], fallback:true}; }
export type Operation = 'add' | 'length' | 'nil';
export function probe(c: Config, operation: Operation) {
  const r = inspect(c);
  if (r.route === '无匹配') return {allowed:false, explanation:'未进入任何 case，那里没有 x 的局部作用域。'};
  const allowed = operation === 'add' ? r.staticType === 'int' : operation === 'length' ? r.staticType === 'string' : r.staticType === 'any' || r.staticType === '*User';
  return {allowed, explanation: allowed ? `x 的静态类型为 ${r.staticType}，该表达式可以编译。${operation === 'nil' ? `结果为 ${c.input === 'nil' || (r.staticType === '*User' && c.input === 'typedNil') ? 'true' : 'false'}。` : ''}` : `x 的静态类型为 ${r.staticType}，不允许这个操作；多类型 case 不能直接使用仅某一种具体类型支持的操作。`};
}
export function switchCode(c: Config) {
  const r = inspect(c);
  return `switch x := v.(type) {\n${r.cases.map(b => `case ${b}:\n    ${b === 'int' ? 'return fmt.Sprintf("count:%d", x)' : b === 'string' ? 'return "label:" + x' : b === 'nil' ? 'return "empty input"' : b === '*User' ? 'if x == nil { return "user:nil" }' : 'return fmt.Sprintf("value:%v", x)'}`).join('\n')}${c.fallback ? '\ndefault:\n    return fmt.Sprintf("unsupported %T", x)' : ''}\n}\nreturn ""`;
}
