export type Source = 'local' | 'pointer' | 'map-value' | 'map-pointer' | 'copy-back';
export type Route = 'direct' | 'interface';
export type Outcome = 'compile-error' | 'increment';
export interface Config { source: Source; route: Route }
export const sources: { id: Source; label: string; expression: string; type: 'Counter' | '*Counter'; addressable: boolean }[] = [
  { id: 'local', label: '局部变量 c', expression: 'c', type: 'Counter', addressable: true },
  { id: 'pointer', label: '指针 &c', expression: '&c', type: '*Counter', addressable: false },
  { id: 'map-value', label: 'map 的结构体元素', expression: 'm["x"]', type: 'Counter', addressable: false },
  { id: 'map-pointer', label: 'map 的指针元素', expression: 'mp["x"]', type: '*Counter', addressable: false },
  { id: 'copy-back', label: 'map 取副本，调用后写回', expression: 'tmp', type: 'Counter', addressable: true },
];
export function methodSet(pointer: boolean): string[] { return pointer ? ['Read', 'Inc'] : ['Read']; }
export function inspect(config: Config) {
  const source = sources.find(s => s.id === config.source)!;
  const implicitAddress = config.route === 'direct' && source.type === 'Counter' && source.addressable;
  const allowed = source.type === '*Counter' || implicitAddress;
  const target = config.source.startsWith('map') || config.source === 'copy-back' ? 'map 中的计数器' : '原变量 c';
  const expression = config.route === 'interface' ? `apply(${source.expression})` : `${source.id === 'pointer' ? '(&c)' : source.expression}.Inc()`;
  const code = config.source === 'copy-back' ? `tmp := m["x"]\n${expression}\nm["x"] = tmp` : expression;
  const reason = allowed
    ? implicitAddress
      ? `${source.expression} 是可寻址的 Counter。直接方法调用按 (&${source.expression}).Inc() 处理；Counter 的方法集仍然只有 Read。${config.source === 'copy-back' ? 'Inc 先修改 tmp，随后显式赋值把 1 写回 map。' : 'Inc 通过地址把原变量 N 从 0 改为 1。'}`
      : '*Counter 的方法集包含 Read 和 Inc，无需隐式取址。Inc 经非空指针把目标 N 从 0 改为 1。'
    : config.route === 'interface'
      ? '接口赋值只检查静态类型的方法集。Counter 的方法集没有 Inc；即使表达式可寻址，也不会为接口自动取址。编译失败，Inc 没有执行。'
      : 'map 的结构体元素不可寻址，不能为 m["x"] 自动取地址；Counter 本身的方法集没有 Inc。编译失败，map 中的 N 仍是 0。';
  return { ...source, code, allowed, implicitAddress, outcome: (allowed ? 'increment' : 'compile-error') as Outcome, before: 0, after: allowed ? 1 : 0, reason, target };
}
export function repair(config: Config): Config {
  return { ...config, source: config.source === 'map-value' || config.source === 'copy-back' ? 'map-pointer' : 'pointer' };
}
