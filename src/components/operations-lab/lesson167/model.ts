export type PoolConfig = { reset: boolean; discard: boolean; reuse: boolean; alias: boolean; capacity: number; maxCapacity: number };
export type BufferObject = { id: number; storage: string; length: number; capacity: number; owner: 'A' | 'B' | 'pool' | 'discarded' };
export type PoolState = { phase: number; objects: BufferObject[]; pool: number | null; a: number | null; b: number | null; alias: number | null; allocations: number; output: string; event: string; hazard: boolean };
export const defaults: PoolConfig = { reset: true, discard: false, reuse: true, alias: false, capacity: 16, maxCapacity: 32 };
export const operations = ['A：Get', 'A：写入', 'A：按容量归还', '运行时：可丢弃池项', 'B：Get', 'B：Reset 或跳过', 'B：写入并读取', 'A：旧别名误用检查'];
export const secret = 'tenantA-SECRET';
export function initialState(): PoolState { return { phase: 0, objects: [], pool: null, a: null, b: null, alias: null, allocations: 0, output: '', event: '尚未借用。请先预测 B 的最终逻辑输出。', hazard: false }; }
export function logical(object: BufferObject | undefined): string { return object ? object.storage.slice(0, object.length) : ''; }
function write(object: BufferObject, value: string) {
  const next = logical(object) + value;
  object.storage = next + object.storage.slice(next.length);
  object.length = next.length;
  object.capacity = Math.max(object.capacity, next.length);
}
export function nextState(current: PoolState, config: PoolConfig): PoolState {
  if (current.phase >= operations.length) return current;
  const state: PoolState = { ...current, objects: current.objects.map(o => ({ ...o })) };
  const get = (id: number | null) => state.objects.find(o => o.id === id);
  const fresh = (owner: 'A' | 'B') => { const id = ++state.allocations; state.objects.push({ id, storage: '', length: 0, capacity: config.capacity, owner }); return id; };
  switch (state.phase) {
    case 0: state.a = fresh('A'); state.event = 'A 借到对象 #' + state.a + '，由 New 创建。'; break;
    case 1: write(get(state.a)!, secret); state.event = 'A 写入 tenantA-SECRET，逻辑长度增长。'; break;
    case 2: {
      const a = get(state.a)!;
      state.alias = config.alias ? a.id : null;
      if (a.capacity <= config.maxCapacity) { a.owner = 'pool'; state.pool = a.id; state.event = 'Put #' + a.id + '；A 的使用权结束' + (config.alias ? '，但错误地保留了别名。' : '，释放别名。'); }
      else { a.owner = 'discarded'; state.event = '容量 ' + a.capacity + ' > 准入 ' + config.maxCapacity + '，不 Put，交给回收。'; }
      state.a = null; break;
    }
    case 3:
      if (config.discard && state.pool !== null) { get(state.pool)!.owner = 'discarded'; state.pool = null; state.event = '注入合法运行时事件：丢弃池项。它不保证在某一次 GC 才发生。'; }
      else state.event = '本条轨迹没有丢弃池项；这不承诺下一次 Get 命中。';
      break;
    case 4:
      if (config.reuse && state.pool !== null) { state.b = state.pool; get(state.b)!.owner = 'B'; state.pool = null; state.event = '本条合法轨迹中 B 复用 #' + state.b + '。Get 不会自动 Reset。'; }
      else { state.b = fresh('B'); state.event = 'B 获得新对象 #' + state.b + '；即使池项存在，也不能依赖 Get 返回它。'; }
      break;
    case 5:
      if (config.reset) { get(state.b)!.length = 0; state.event = 'B.Reset()：逻辑长度归零，容量和底层存储未擦除。String()/Bytes() 只暴露当前逻辑内容。'; }
      else state.event = '跳过 Reset；当前逻辑内容为 ' + JSON.stringify(logical(get(state.b))) + '。';
      break;
    case 6: write(get(state.b)!, 'tenantB'); state.output = logical(get(state.b)); state.event = 'B 写入后 String() = ' + JSON.stringify(state.output) + '。'; break;
    case 7:
      if (state.alias !== null) { const object = get(state.alias)!; write(object, '!'); state.hazard = true; state.output = logical(get(state.b)); state.event = state.alias === state.b ? 'A 越权写旧别名：它与 B 指向同一对象，B 再读取时出现 !。这里按顺序演示污染；并发误用还可能产生数据竞争。' : 'A 仍越权使用已放弃的旧对象，但本次 B 是另一对象，B 输出未变。一次没出错不证明所有权正确。'; }
      else state.event = 'A 未保留别名，归还后没有再次访问。检查输出与驻留容量，性能收益还需基准验证。';
      break;
  }
  state.phase++;
  return state;
}
export function run(config: PoolConfig, count = operations.length): PoolState {
  let state = initialState(); for (let i = 0; i < Math.min(count, operations.length); i++) state = nextState(state, config); return state;
}
export function classify(output: string): string { return output.includes(secret) ? output.endsWith('!') ? 'both' : 'old' : output.endsWith('!') ? 'alias' : 'clean'; }

/** Execute the learner's B lifecycle against an already dirty candidate. */
export function executeOrder(order: string[]): { state: PoolState; error: string | null } {
  let state = run(defaults, 4);
  let borrowed = false;
  let returned = false;
  for (const action of order) {
    if (action === 'Get') {
      if (borrowed || returned) return { state, error: '不能重复借用；一次借用只应有一个 Get。' };
      state = nextState({ ...state, phase: 4 }, defaults);
      borrowed = true;
    } else {
      if (!borrowed || returned) return { state, error: action + ' 需要当前持有借用权；先 Get，且 Put 后不能继续访问。' };
      if (action === 'Reset') state = nextState({ ...state, phase: 5 }, defaults);
      if (action === 'Write') state = nextState({ ...state, phase: 6 }, defaults);
      if (action === 'Put') {
        const id = state.b;
        state = { ...state, phase: 8, pool: id, b: null, objects: state.objects.map(o => o.id === id ? { ...o, owner: 'pool' as const } : o), event: 'B 已归还对象；输出保留的是 Write 时读取到的值。后来 Reset 无法撤销之前的输出。' };
        returned = true;
      }
    }
  }
  return { state, error: returned ? null : '操作未归还对象。' };
}
