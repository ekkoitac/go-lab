export type Config = { bytes: number; window: number; alias: boolean };
export type Action = 'cap' | 'copy' | 'drop-buffer' | 'keep-alias' | 'drop-alias';
export type State = Config & { buffer: boolean; token: 'A' | 'B'; capacity: number; copiedBytes: number; operation: string };
export const baseline: Config = { bytes: 1024, window: 2, alias: false };
export function initial(config: Config = baseline): State {
  if (![config.bytes, config.window].every(Number.isInteger) || config.window < 1 || config.bytes < config.window) throw new Error('窗口必须位于非空数组内');
  return { ...config, buffer: true, token: 'A', capacity: config.bytes, copiedBytes: 0, operation: 'token := buffer[:n]：建立小窗口，尚未复制' };
}
export function inspect(state: State) {
  const roots = [state.buffer ? 'buffer' : null, state.token === 'A' ? 'token' : null, state.alias ? 'other' : null].filter((x): x is string => x !== null);
  return { ...state, roots, aReachable: roots.length > 0, eligible: roots.length === 0, reachablePayloadBytes: (roots.length ? state.bytes : 0) + (state.token === 'B' ? state.window : 0), bBytes: state.token === 'B' ? state.window : 0 };
}
export function allowed(state: State, action: Action) {
  return action === 'cap' ? state.capacity !== state.window : action === 'copy' ? state.token === 'A' : action === 'drop-buffer' ? state.buffer : action === 'keep-alias' ? state.buffer && !state.alias : state.alias;
}
export function transition(state: State, action: Action): State {
  if (!allowed(state, action)) return state;
  if (action === 'cap') return { ...state, capacity: state.window, operation: 'token = token[:n:n]：容量收窄，引用目标保持不变' };
  if (action === 'copy') return { ...state, token: 'B', capacity: state.window, copiedBytes: state.window, operation: 'make + copy：token 改指向独立数组 B，复制 n 个字节' };
  if (action === 'drop-buffer') return { ...state, buffer: false, operation: 'buffer = nil：只断开 buffer 这条边' };
  if (action === 'keep-alias') return { ...state, alias: true, operation: 'other := buffer[:1]：另一条引用也指向 A' };
  return { ...state, alias: false, operation: 'other = nil：断开其他别名的引用' };
}
export function replay(config: Config, actions: Action[]) { return inspect(actions.reduce(transition, initial(config))); }
export function comparison(config: Config) {
  return { cap: replay(config, ['cap', 'drop-buffer']), clone: replay(config, ['copy', 'drop-buffer']) };
}
export const transferTasks = [
  { title: '图片上传：取 8 字节文件头', bytes: 4096, window: 8, alias: true, actions: ['copy', 'drop-buffer'] as Action[], code: '// queue 之前已保存 image[1:2]\nheader = clone(header); image = nil' },
  { title: '网络响应：保留 4 字节魔数', bytes: 2048, window: 4, alias: false, actions: ['cap', 'drop-buffer'] as Action[], code: 'magic = magic[:4:4]; response = nil' },
  { title: '文件索引：保存 6 字节标签', bytes: 8192, window: 6, alias: true, actions: ['copy', 'drop-buffer', 'drop-alias'] as Action[], code: 'tag = clone(tag); file = nil; cache = nil' },
];

