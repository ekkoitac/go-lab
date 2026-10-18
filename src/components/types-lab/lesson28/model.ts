export type Kind = 'slice' | 'array' | 'nil-slice' | 'map' | 'int' | 'string' | 'nil';
export type Operation = 'key' | 'equal' | 'nil';
export type Outcome = 'stored' | 'true' | 'false' | 'panic';
export interface Value { kind: Kind; a: number; b: number }
export interface Config { operation: Operation; left: Value; right: Value }
export interface Result { outcome: Outcome; explanation: string; route: string[] }
export const kinds: Record<Kind, string> = { slice: '切片 []int', array: '数组 [2]int', 'nil-slice': 'nil 切片 []int', map: 'map[int]int', int: 'int', string: 'string', nil: 'nil 接口' };
export const initial: Config = { operation: 'key', left: { kind: 'slice', a: 1, b: 2 }, right: { kind: 'slice', a: 1, b: 2 } };
export function dynamicType(v: Value): string | null {
  return ({ slice: '[]int', array: '[2]int', 'nil-slice': '[]int', map: 'map[int]int', int: 'int', string: 'string', nil: null })[v.kind];
}
export function comparable(v: Value) { return !['slice', 'nil-slice', 'map'].includes(v.kind); }
export function expression(v: Value): string {
  switch (v.kind) {
    case 'slice': return `[]int{${v.a}, ${v.b}}`;
    case 'array': return `[2]int{${v.a}, ${v.b}}`;
    case 'nil-slice': return '[]int(nil)';
    case 'map': return `map[int]int{${v.a}: ${v.b}}`;
    case 'int': return `${v.a}`;
    case 'string': return `"${v.a},${v.b}"`;
    case 'nil': return 'nil';
  }
}
export function inspect(c: Config): Result {
  const { left, right, operation } = c;
  if (operation === 'nil') return {
    outcome: left.kind === 'nil' ? 'true' : 'false',
    explanation: left.kind === 'nil' ? 'x 没有动态类型，x == nil 为 true。' : `x 的动态类型 ${dynamicType(left)} 存在，所以 x == nil 为 false；不会比较内部切片，也不会 panic。`,
    route: ['接口可与 nil 比较', '只检查接口是否为空', left.kind === 'nil' ? 'true' : 'false'],
  };
  if (operation === 'key') return comparable(left)
    ? { outcome: 'stored', explanation: `${expression(left)} 可作为 map[any] 的键；写入 true 后，用相同动态类型和相等值查找可得到 true。nil 接口也可以当 map[any] 的键。`, route: ['map[any] 静态合法', '动态键可比较', '写入并查找 true'] }
    : { outcome: 'panic', explanation: `动态键类型 ${dynamicType(left)} 不可比较。写入 map[any] 时 panic，键槽仍为空；any 不会替切片定义按元素相等。`, route: ['map[any] 静态合法', '动态键不可比较', 'panic，未写入'] };
  if (dynamicType(left) !== dynamicType(right)) return { outcome: 'false', explanation: `动态类型 ${dynamicType(left) ?? '无'} 与 ${dynamicType(right) ?? '无'} 不同，接口比较直接为 false，不会进入动态值比较。`, route: ['any == any 静态合法', '动态类型不同', 'false'] };
  if (!comparable(left)) return { outcome: 'panic', explanation: `两个接口的动态类型同为 ${dynamicType(left)}，要继续比较动态值，但该类型不可比较，因此 panic。即使两个 nil 切片也一样。`, route: ['any == any 静态合法', '动态类型相同且不可比较', 'panic'] };
  const equal = left.kind === 'nil' || (left.a === right.a && (left.kind === 'int' || left.b === right.b));
  return { outcome: equal ? 'true' : 'false', explanation: left.kind === 'nil' ? '两个接口都没有动态类型和值，所以相等。' : `动态类型相同且可比较，继续比较${left.kind === 'array' ? '每个数组元素' : '动态值'}，结果为 ${equal}。`, route: ['any == any 静态合法', '动态类型相同且可比较', equal ? 'true' : 'false'] };
}
export function repair(c: Config): Config {
  const toArray = (v: Value): Value => v.kind === 'slice' ? { ...v, kind: 'array' } : { ...v };
  return { ...c, left: toArray(c.left), right: toArray(c.right) };
}
export function code(c: Config): string {
  const left = `var x any = ${expression(c.left)}`;
  return c.operation === 'key' ? `${left}\nseen := map[any]bool{}\nseen[x] = true\nfmt.Println(seen[x])` : c.operation === 'nil' ? `${left}\nfmt.Println(x == nil)` : `${left}\nvar y any = ${expression(c.right)}\nfmt.Println(x == y)`;
}
export const outcomes: Record<Outcome, string> = { stored: '写入成功，查找 true', true: 'true', false: 'false', panic: 'panic' };
