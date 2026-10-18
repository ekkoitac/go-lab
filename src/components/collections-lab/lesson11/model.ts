export type Passing = 'value' | 'pointer';
export interface Config { initial: number[]; index: number; amount: number; passing: Passing }
export interface ArrayState { phase: number; original: number[]; local: number[] | null; localStorage: 'A' | 'B' | null; operation: string }
export function snapshot(config: Config, phase: number): ArrayState {
  if (!config.initial.length || !config.initial.every(Number.isSafeInteger) || !Number.isInteger(config.index) || config.index < 0 || config.index >= config.initial.length || !Number.isSafeInteger(config.amount)) throw new Error('Invalid array configuration');
  const at = Math.max(0, Math.min(3, Math.trunc(phase)));
  const original = [...config.initial];
  const local = at > 0 ? [...config.initial] : null;
  if (at >= 2) {
    local![config.index] -= config.amount;
    if (config.passing === 'pointer') original[config.index] -= config.amount;
  }
  return { phase: at, original, local: at === 3 ? null : local, localStorage: at > 0 && at < 3 ? config.passing === 'value' ? 'B' : 'A' : null,
    operation: ['等待调用', config.passing === 'value' ? '复制数组值到形参 b' : '复制地址到形参 b', `执行 b[${config.index}] -= ${config.amount}`, '函数返回，局部变量离开作用域'][at] };
}
export function copiedPointerArray(action: 'none' | 'write' | 'replace') {
  return { a: ['X', 'Y'], b: [action === 'replace' ? 'Z' : 'X', 'Y'], objects: { X: action === 'write' ? 99 : 8, Y: 5, Z: 20 } };
}
export function copyOrder(order: 'copy-first' | 'edit-first', step: number) {
  const a = [4, 9]; let b: number[] | null = null;
  if (order === 'copy-first') { if (step >= 1) b = [...a]; if (step >= 2) a[1] = 3; }
  else { if (step >= 1) a[1] = 3; if (step >= 2) b = [...a]; }
  return { a, b, step, order };
}

