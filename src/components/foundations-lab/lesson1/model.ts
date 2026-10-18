export type Operator = ':=' | '=';
export interface ScopeConfig { original: number; replacement: number; operator: Operator; branch: boolean }
export interface ScopeFrame { phase: string; line: number; outer: number; inner: number | null; inBlock: boolean; read: 'outer' | 'inner' | null; output: number | null; change: string }

export function scopeTrace(config: ScopeConfig): ScopeFrame[] {
  const { original, replacement, operator, branch } = config;
  for (const value of [original, replacement]) if (!Number.isInteger(value) || value < 0 || value > 999) throw new RangeError('实验输入限 0–999 整数');
  if (operator !== ':=' && operator !== '=') throw new RangeError('未知运算符');
  const writtenOuter = branch && operator === '=' ? replacement : original;
  const inner = branch && operator === ':=' ? replacement : null;
  return [
    { phase: '外层声明完成', line: 0, outer: original, inner: null, inBlock: false, read: null, output: null, change: `建立外层绑定 A，price = ${original}。` },
    { phase: branch ? '进入 if 块' : '跳过 if 块', line: 1, outer: original, inner: null, inBlock: branch, read: null, output: null, change: branch ? '条件为 true，进入新词法块；此时还没有内层 price。' : '条件为 false，内层声明和赋值均不执行。' },
    { phase: branch ? '执行分支语句' : '分支语句未执行', line: 2, outer: writtenOuter, inner, inBlock: branch, read: null, output: null, change: !branch ? '没有写入；外层 A 保持原值。' : operator === ':=' ? `:= 创建内层绑定 B = ${replacement}；外层 A 仍为 ${original}。` : `= 查找已有绑定 A，把 ${original} 改为 ${replacement}，没有创建 B。` },
    { phase: branch ? '在块内读取 price' : '块内读取被跳过', line: 3, outer: writtenOuter, inner, inBlock: branch, read: branch ? inner === null ? 'outer' : 'inner' : null, output: null, change: !branch ? '整个分支未执行，_ = price 也不执行。' : inner === null ? `块内没有 B，沿外层查找 A，读到 ${writtenOuter}。` : `最近的同名绑定是 B，读到 ${inner}；A 依然存在，但被遮蔽。` },
    { phase: '离开 if 块', line: 4, outer: writtenOuter, inner: null, inBlock: false, read: null, output: null, change: inner === null ? '退出分支后，没有内层绑定需要离开作用域。' : 'B 离开作用域；这不是把 B 的值复制回 A。' },
    { phase: '返回外层价格', line: 5, outer: writtenOuter, inner: null, inBlock: false, read: 'outer', output: writtenOuter, change: `return price 在外层块中解析到 A，最终返回 ${writtenOuter}。` },
  ];
}

export function transferResult(declareInside: boolean, outer = 3, local = 7, update = 9) {
  scopeTrace({ original: outer, replacement: local, operator: declareInside ? ':=' : '=', branch: true });
  scopeTrace({ original: outer, replacement: update, operator: '=', branch: true });
  return { outer: declareInside ? outer : update, inside: update, writesTo: declareInside ? 'B' : 'A' };
}
