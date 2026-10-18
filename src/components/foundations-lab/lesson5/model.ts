export type Policy = 'exact' | 'absolute' | 'combined';
export interface Input { a: number; b: number; target: number; scale: number; absolute: number; relative: number; policy: Policy }
export const initialInput: Input = { a: 0.1, b: 0.2, target: 0.3, scale: 1, absolute: 1e-9, relative: 1e-9, policy: 'exact' };
export function compare(a: number, b: number, absolute: number, relative: number, policy: Policy) {
  if (!Number.isFinite(absolute) || !Number.isFinite(relative) || absolute < 0 || relative < 0) throw new RangeError('容差必须是非负有限数');
  const difference = Math.abs(a - b);
  const magnitude = Math.max(Math.abs(a), Math.abs(b));
  const threshold = policy === 'exact' ? 0 : policy === 'absolute' ? absolute : Math.max(absolute, relative * magnitude);
  // Equality handles identical infinities and signed zero before subtraction; NaN never equals.
  const equal = a === b || (Number.isFinite(a) && Number.isFinite(b) && policy !== 'exact' && difference < threshold);
  return { difference, magnitude, threshold, equal };
}
export function evaluate(input: Input) {
  if (![input.a, input.b, input.target, input.scale].every(Number.isFinite) || input.scale <= 0) throw new RangeError('输入必须有限，尺度必须为正');
  const a = input.a * input.scale, b = input.b * input.scale, target = input.target * input.scale;
  const sum = a + b;
  if (![a, b, target, sum].every(Number.isFinite)) throw new RangeError('缩放或相加溢出');
  return { a, b, target, sum, ...compare(sum, target, input.absolute, input.relative, input.policy) };
}
export function trace(input: Input) {
  const result = evaluate(input);
  return [
    { stage: '准备输入', cause: '先提交比较结果和理由，再逐步追踪。', a: null, b: null, sum: null, equal: null },
    { stage: '存入 float64 变量', cause: '每个十进制输入先舍入到可表示的二进制浮点数。下方显示 17 位有效数字，便于区分相邻值。', a: result.a, b: result.b, sum: null, equal: null },
    { stage: '相加并舍入', cause: '读取变量后相加，再舍入为 float64；数值尺度会影响可表示值之间的间隔。', a: result.a, b: result.b, sum: result.sum, equal: null },
    { stage: '应用比较规则', cause: input.policy === 'exact' ? '== 比较浮点数值是否相等；非零误差不会自动被忽略。' : '先接受精确相等，否则检查差值是否严格小于当前容差；容差边界本身不算通过。', a: result.a, b: result.b, sum: result.sum, equal: result.equal },
  ];
}
export const format = (value: number) => value === 0 ? '0' : value.toPrecision(17);
export const repairs = [
  { name: '大尺度读数', left: 1e9 + 1, right: 1e9, expected: true, explanation: '本任务允许相对误差 1e-8；差 1 在此尺度内可接受。' },
  { name: '接近零', left: 1e-12, right: 0, expected: true, explanation: '本任务允许绝对误差 1e-9；仅相对比较会在零附近过严。' },
  { name: '真实偏差', left: 0.31, right: 0.3, expected: false, explanation: '差 0.01 超过此任务预算，不能因为想得到 true 而放大容差。' },
];
