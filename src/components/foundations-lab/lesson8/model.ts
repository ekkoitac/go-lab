export type Kind = 'slice' | 'map' | 'pointer' | 'channel';
export type Operation = 'append' | 'read' | 'write' | 'deref' | 'send' | 'receive';
export type Outcome = 'success' | 'panic' | 'blocked';
export type Setup = 'nil' | 'ready' | 'filled' | 'closed';
export interface Input { kind: Kind; operation: Operation; setup: Setup; value: number }
export interface Snapshot { stage: string; resource: string; cells: string[]; nil: boolean; output: string; outcome: Outcome | null; cause: string; code: string }
export const operations: Record<Kind, Operation[]> = { slice: ['append'], map: ['read', 'write'], pointer: ['deref'], channel: ['send', 'receive'] };
export const labels: Record<Operation, string> = { append: 'append 并接收返回值', read: '读取键 a', write: '写入键 a', deref: '解引用读取', send: '发送', receive: '接收' };
export const initialInput: Input = { kind: 'map', operation: 'write', setup: 'nil', value: 7 };
export function trace(input: Input): Snapshot[] {
  const { kind, operation, setup, value } = input;
  if (!operations[kind]?.includes(operation) || (!['nil', 'ready', 'filled', 'closed'].includes(setup)) || (kind !== 'channel' && !['nil', 'ready'].includes(setup)) || !Number.isInteger(value) || value < -9 || value > 99) throw new RangeError('模型类型、操作与初始化条件不匹配');
  const types = { slice: '[]int', map: 'map[string]int', pointer: '*int', channel: 'chan int' };
  const names = { slice: 's', map: 'm', pointer: 'p', channel: 'ch' };
  const initial: Snapshot = { stage: '声明零值', resource: `${names[kind]} ${types[kind]}`, cells: [], nil: true, output: '尚未执行操作', outcome: null, cause: '具体类型决定可执行的操作；nil 并没有抹去类型。', code: `var ${names[kind]} ${types[kind]}` };
  const prepared: Snapshot = { ...initial, cells: [], stage: '准备条件', nil: setup === 'nil', cause: '保留零值，不分配底层对象。', code: '// 保留 nil' };
  if (setup !== 'nil') {
    prepared.code = kind === 'map' ? 'm = make(map[string]int)' : kind === 'slice' ? 's = make([]int, 0)' : kind === 'pointer' ? 'p = new(int)' : 'ch = make(chan int, 1)';
    prepared.cause = kind === 'pointer' ? 'new(int) 分配值为 0 的整数，p 指向它。' : kind === 'channel' ? '分配容量为 1 的 channel；是否有消息决定接收能否继续。' : '分配非 nil 的空容器；长度仍为 0。';
    if (kind === 'pointer') prepared.cells = ['0'];
    if (setup === 'filled') { prepared.cells = [String(value)]; prepared.code += `; ch <- ${value}`; }
    if (setup === 'closed') { prepared.code += '; close(ch)'; prepared.cause = '关闭已分配的空 channel；closed 不是 nil。'; }
  }
  const result: Snapshot = { ...prepared, cells: [...prepared.cells], stage: '执行操作', outcome: 'success' };
  if (operation === 'append') { result.nil = false; result.cells = [String(value)]; result.code = `s = append(s, ${value})`; result.output = `s=[${value}] · len=1 · nil=false`; result.cause = 'append 返回含新元素的切片；赋回 s 后，s 指向底层数组。nil 切片是合法起点。'; }
  if (operation === 'read') { result.code = 'v, ok := m["a"]'; result.output = 'v=0 · ok=false'; result.cause = '缺失键读取返回元素零值和 false；读取不会初始化 map，map 状态保持不变。'; }
  if (operation === 'write') { result.code = `m["a"] = ${value}`; if (prepared.nil) { result.outcome = 'panic'; result.output = 'panic: assignment to entry in nil map'; result.cause = 'nil map 没有可写存储；先 make，再重跑该写入。'; } else { result.cells = [`a: ${value}`]; result.output = `m["a"]=${value}`; result.cause = 'make 提供可写 map，写入建立键 a 与数值的关联。'; } }
  if (operation === 'deref') { result.code = 'v := *p'; result.outcome = prepared.nil ? 'panic' : 'success'; result.output = prepared.nil ? 'panic: nil pointer dereference' : 'v=0'; result.cause = prepared.nil ? 'p 没有指向对象，解引用无法读取。先 new(int) 分配目标。' : 'p 已指向 new(int) 分配的整数，读取其零值 0。'; }
  if (operation === 'send' || operation === 'receive') {
    result.code = operation === 'send' ? `ch <- ${value}` : 'v, ok := <-ch';
    if (prepared.nil) { result.outcome = 'blocked'; result.output = 'goroutine 阻塞 · 操作未完成'; result.cause = 'nil channel 的发送和接收都无法完成。阻塞不会返回零值，也不会把 channel 关闭。'; }
    else if (setup === 'closed') { result.outcome = operation === 'send' ? 'panic' : 'success'; result.output = operation === 'send' ? 'panic: send on closed channel' : 'v=0 · ok=false'; result.cause = operation === 'send' ? '向关闭 channel 发送会 panic。' : '已关闭且已排空的 channel 接收立即返回零值和 false，与 nil channel 的阻塞不同。'; }
    else if ((operation === 'send' && prepared.cells.length === 1) || (operation === 'receive' && prepared.cells.length === 0)) { result.outcome = 'blocked'; result.output = 'goroutine 阻塞 · 操作未完成'; result.cause = operation === 'send' ? '容量为 1 的缓冲区已满，且本模型没有接收者腾出位置。' : '缓冲区为空，且本模型没有发送者；make 并不保证接收可以完成。'; }
    else if (operation === 'send') { result.cells = [String(value)]; result.output = '发送完成 · 缓冲区 1/1'; result.cause = '容量为 1 的缓冲区有空位，发送存入消息后返回。'; }
    else { result.cells = []; result.output = `v=${value} · ok=true`; result.cause = '接收取走缓冲区的一条消息；缓冲区从 1/1 变为 0/1。'; }
  }
  return [initial, prepared, result];
}
