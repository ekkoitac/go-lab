export type Config = { capacity: 1 | 3; returns: boolean; receives: boolean; edit: boolean };
export type Descriptor = { array: 'A' | 'B'; len: number; cap: number | string };
export const baseline: Config = { capacity: 3, returns: false, receives: false, edit: true };
export function snapshot(config: Config, phase: number) {
  if (![1, 3].includes(config.capacity) || !Number.isInteger(phase) || phase < 0 || phase > 5) throw new Error('Invalid configuration');
  if (config.receives && !config.returns) throw new Error('Cannot receive a void return');
  const arrays: Partial<Record<'A' | 'B', number[]>> = { A: Array.from({ length: config.capacity }, (_, i) => i === 0 ? 7 : 0) };
  let caller: Descriptor = { array: 'A', len: 1, cap: config.capacity };
  let local: Descriptor | null = phase >= 1 ? { ...caller } : null;
  if (phase >= 2) {
    if (config.capacity === 1) { arrays.B = [7, 8]; local = { array: 'B', len: 2, cap: '≥ 2' }; }
    else { arrays.A![1] = 8; local = { array: 'A', len: 2, cap: 3 }; }
  }
  if (phase >= 3 && config.edit) arrays[local!.array]![0] = 9;
  const returned = phase >= 4 && config.returns ? { ...local! } : null;
  if (phase === 5 && config.receives && returned) caller = { ...returned };
  if (phase >= 4) local = null;
  const view = (d: Descriptor | null) => d ? arrays[d.array]!.slice(0, d.len) : null;
  const operation = [
    'cart 初始化；add 尚未调用',
    '调用 add(cart)：复制描述符，两个 len 字段独立',
    config.capacity === 1 ? 's = append(s, 8)：分配 B；只替换局部描述符' : 's = append(s, 8)：复用 A；只把局部 len 改为 2',
    config.edit ? `s[0] = 9：写入数组 ${config.capacity === 1 ? 'B' : 'A'}，不修改任何 len` : '跳过已有元素修改；数组内容保持上一步结果',
    config.returns ? 'return s：把局部描述符作为结果交还；局部变量离开作用域' : '函数结束：局部描述符消失，没有返回值',
    config.receives ? 'cart = add(cart)：调用者接收新描述符' : '调用结束：未赋值，调用者仍保留旧描述符',
  ][phase];
  return { phase, caller, local, returned, arrays, callerValues: view(caller)!, localValues: view(local), returnedValues: view(returned), operation };
}
export function shrink(receive: boolean, first: number, checked: boolean) {
  return checked ? { len: receive ? 1 : 3, values: receive ? [first] : [first, 20, 30] } : null;
}
