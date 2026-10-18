export type Source = 'untyped' | 'int' | 'byte';
export type Target = 'byte' | 'uint16' | 'int';
export interface Input { literal: string; source: Source; target: Target; convert: boolean }
export interface Result { validLiteral: boolean; declaration: boolean; typeAllowed: boolean; representable: boolean; accepted: boolean; value: number | null; issue: string }
export interface Snapshot { stage: number; operation: string; cause: string; declaration: string; typeGate: string; rangeGate: string; output: string | null }
export const initialInput: Input = { literal: '12', source: 'int', target: 'byte', convert: false };
export const bounds: Record<Target, [number, number]> = { byte: [0, 255], uint16: [0, 65535], int: [-2147483648, 2147483647] };
export function fits(value: number, type: Target) { return Number.isInteger(value) && value >= bounds[type][0] && value <= bounds[type][1]; }
export function evaluate(input: Input): Result {
  const validLiteral = /^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,3})?$/.test(input.literal) && Math.abs(Number(input.literal)) <= 65536;
  const value = validLiteral ? Number(input.literal) : null;
  const declaration = value !== null && (input.source === 'untyped' || fits(value, input.source));
  const typeAllowed = declaration && (input.source === 'untyped' || input.source === input.target || input.convert);
  const representable = declaration && value !== null && fits(value, input.target);
  const accepted = declaration && typeAllowed && representable;
  const issue = !validLiteral ? '请输入 -65536 到 65536 的十进制字面量，最多 3 位小数，不使用前导零；本模型不解析表达式。' : !declaration ? `声明就失败：${input.literal} 不能作为 ${input.source} 类型的整数常量。` : !typeAllowed ? `类型门拒绝：已绑定 ${input.source}，不会因为值很小就自动变为 ${input.target}。可移除类型或显式转换。` : !representable ? `可表示性门拒绝：${input.literal} 必须是 ${bounds[input.target][0]} 到 ${bounds[input.target][1]} 的整数。常量转换不能截断或取模。` : `两道检查均通过：参数得到 ${input.literal}（${input.target}）。`;
  return { validLiteral, declaration, typeAllowed, representable, accepted, value, issue };
}
export function code(input: Input) { return `const n${input.source === 'untyped' ? '' : ` ${input.source}`} = ${input.literal}\nfunc packet(n ${input.target}) { /* 使用 n */ }\npacket(${input.convert ? `${input.target}(n)` : 'n'})`; }
export function trace(input: Input): Snapshot[] {
  const r = evaluate(input);
  const start: Snapshot = { stage: 0, operation: '准备检查', cause: '先记录预测。常量的类型与目标是否能表示这个值，是两个不同问题。', declaration: '待检查', typeGate: '待检查', rangeGate: '待检查', output: null };
  const declared: Snapshot = { ...start, stage: 1, operation: '检查常量声明', declaration: r.declaration ? input.source === 'untyped' ? '无类型数值常量' : `已绑定 ${input.source}` : '声明失败', cause: r.declaration ? input.source === 'untyped' ? '声明没有绑定具体类型，稍后可由使用上下文决定。无类型常量不等于 int 变量。' : `n 已经具有 ${input.source} 类型；数值不因类型标记而改变。` : r.issue };
  const typed: Snapshot = { ...declared, stage: 2, operation: '检查类型路径', typeGate: !r.declaration ? '未到达' : r.typeAllowed ? '通过' : '拒绝', cause: !r.declaration ? r.issue : r.typeAllowed ? input.convert ? `显式 ${input.target}(n) 提供转换路径；但常量仍需可表示，不能绕过数值检查。` : input.source === 'untyped' ? `无类型常量可尝试适配 ${input.target}，接下来检查值。` : '声明类型与参数类型相同。' : r.issue };
  const represented: Snapshot = { ...typed, stage: 3, operation: '检查可表示性', rangeGate: !r.declaration || !r.typeAllowed ? '未到达' : r.representable ? '通过' : '拒绝', cause: !r.declaration || !r.typeAllowed ? '前一检查未通过，当前路径已停止；回退查看证据，修改后重新检查。' : r.representable ? `${input.literal} 是整数且落在 ${input.target} 的范围内，可以精确表示。` : r.issue };
  return [start, declared, typed, represented, { ...represented, stage: 4, operation: r.accepted ? '调用成立' : '编译不通过', cause: r.issue, output: r.accepted ? `len=${r.value}` : null }];
}

