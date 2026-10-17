export type Init = 'empty' | 'reserve' | 'length';
export type Method = 'append' | 'index';
export interface Config { count: number; capacity: number; init: Init; method: Method }
export interface State { config: Config; values: number[]; capacity: number; next: number; growths: number; copied: number; panic: boolean; event: string }
export function start(config: Config): State {
  if (!Number.isInteger(config.count) || config.count < 1 || config.count > 6 || !Number.isInteger(config.capacity) || config.capacity < 0 || config.capacity > 8) throw new Error('实验范围：记录数 1–6，预留容量 0–8');
  const values = config.init === 'length' ? Array<number>(config.count).fill(0) : [];
  const capacity = config.init === 'length' ? config.count : config.init === 'reserve' ? config.capacity : 0;
  return {config: {...config}, values, capacity, next: 0, growths: 0, copied: 0, panic: false, event: `初始化：len=${values.length}，cap=${capacity}。${values.length ? '零值已经是切片中的元素。' : '还没有元素。'}`};
}
export function finished(s: State) { return s.panic || s.next === s.config.count; }
export function step(s: State): State {
  if (finished(s)) return s;
  const n: State = {...s, values: [...s.values], next: s.next + 1};
  const value = s.next + 1;
  if (s.config.method === 'index') {
    if (s.next >= s.values.length) return {...n, panic: true, event: `xs[${s.next}] 越界：索引必须小于 len=${s.values.length}；cap=${s.capacity} 不能作为索引边界。本次赋值未发生，程序停止。`};
    n.values[s.next] = value;
    n.event = `xs[${s.next}]=${value}：覆盖已有零值，len=${n.values.length}、cap=${n.capacity} 均不变。`;
  } else {
    if (s.values.length === s.capacity) { n.capacity = Math.max(1, s.capacity * 2); n.growths += 1; n.copied += s.values.length; }
    n.values.push(value);
    n.event = `append ${value} 到索引 ${s.values.length}：len ${s.values.length} → ${n.values.length}。${n.capacity !== s.capacity ? `容量不足，模型新建 cap=${n.capacity} 的数组并复制 ${s.values.length} 个旧元素。` : '已有容量足够，复用底层数组。'}`;
  }
  return n;
}
export function run(config: Config) { let s=start(config); while(!finished(s)) s=step(s); return s; }
export function result(s: State): 'correct' | 'zeros' | 'panic' { return s.panic ? 'panic' : s.values.length > s.config.count ? 'zeros' : 'correct'; }
export const outcomes = {correct: '恰好得到所需记录', zeros: '前面多出一批零值', panic: '下标越界，停止运行'};
export function code(c: Config) { return c.init === 'empty' ? 'make([]int, 0)' : c.init === 'length' ? `make([]int, ${c.count})` : `make([]int, 0, ${c.capacity})`; }
