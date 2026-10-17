export type Policy = 'unbounded' | 'backpressure' | 'disconnect';
export interface Config { production: number; consumption: number; capacity: number; policy: Policy }
export interface Entry { id: number; born: number }
export interface Snapshot { config: Config; tick: number; log: Entry[]; nextID: number; queue: number[]; cursor: number; feedCursor: number; delivered: number[]; status: 'connected' | 'disconnected' | 'cancelled' | 'gap'; paused: boolean; gap: [number, number] | null; acceptedGaps: [number, number][]; produced: number; fetched: number; throttled: number; event: string }
export interface LabState { history: Snapshot[] }
export const defaults: Config = { production: 3, consumption: 1, capacity: 4, policy: 'disconnect' };
export const retention = 4;
export function initial(config: Config = defaults): LabState { return { history: [{ config: { ...config }, tick: 0, log: [], nextID: 1, queue: [], cursor: 0, feedCursor: 0, delivered: [], status: 'connected', paused: false, gap: null, acceptedGaps: [], produced: 0, fetched: 0, throttled: 0, event: '订阅已建立；每步先消费，再生产并入队。' }] }; }
export function current(state: LabState) { return state.history[state.history.length - 1]; }
function save(state: LabState, next: Snapshot): LabState { return { history: [...state.history, next] }; }
function disconnect(snapshot: Snapshot, status: Snapshot['status'], event: string): Snapshot { return { ...snapshot, status, queue: [], feedCursor: snapshot.cursor, fetched: 0, event }; }
export function configure(state: LabState, patch: Partial<Config>): LabState {
  const before = current(state);
  const config = { ...before.config, ...patch };
  config.production = Math.max(0, Math.min(5, Math.trunc(config.production)));
  config.consumption = Math.max(0, Math.min(5, Math.trunc(config.consumption)));
  config.capacity = Math.max(1, Math.min(12, Math.trunc(config.capacity)));
  let next = { ...before, config, event: '参数已修改，保留日志、已收记录和游标；读取速率不受缓冲大小影响。' };
  if (config.policy !== 'unbounded' && before.queue.length > config.capacity) next = disconnect(next, 'disconnected', '新容量小于当前队列：立即断开并释放队列，保留已确认游标。待发送记录可尝试从日志重放。');
  return save(state, next);
}
function expiredGap(s: Snapshot): [number, number] | null {
  const earliest = s.log[0]?.id ?? s.nextID;
  return s.cursor + 1 < earliest ? [s.cursor + 1, earliest - 1] : null;
}
export function advance(state: LabState): LabState {
  const before = current(state), config = before.config;
  let next: Snapshot = { ...before, tick: before.tick + 1, queue: [...before.queue], log: [...before.log], delivered: [...before.delivered], produced: 0, fetched: 0, throttled: 0 };
  if (next.status === 'connected' && !next.paused) {
    const received = next.queue.splice(0, config.consumption); next.delivered.push(...received);
    if (received.length) next.cursor = received[received.length - 1];
  }
  const pending = next.log.filter(e => e.id > next.feedCursor).length;
  const free = Math.max(0, config.capacity - next.queue.length);
  const amount = next.status === 'connected' && config.policy === 'backpressure' ? Math.min(config.production, Math.max(0, free - pending)) : config.production;
  next.produced = amount; next.throttled = config.production - amount;
  for (let i = 0; i < amount; i++) next.log.push({ id: next.nextID++, born: next.tick });
  next.log = next.log.filter(e => e.born > next.tick - retention);
  if (next.status === 'connected') {
    const earliest = next.log[0]?.id ?? next.nextID;
    if (next.feedCursor + 1 < earliest) {
      next = disconnect({ ...next, gap: [next.cursor + 1, earliest - 1] }, 'gap', '尚未进入连接队列的记录已过保留期；停止订阅并报告缺口，不能声称无损。');
    } else {
      const available = next.log.filter(e => e.id > next.feedCursor).map(e => e.id);
      if (config.policy === 'disconnect' && available.length > free) next = disconnect(next, 'disconnected', '慢客户端超过缓冲预算：断开，清空连接队列，保留最后收到的 ID。');
      else {
        const added = config.policy === 'unbounded' ? available : available.slice(0, free);
        next.queue.push(...added); next.fetched = added.length;
        if (added.length) next.feedCursor = added[added.length - 1];
        next.event = next.throttled ? '背压限制了本步上游生产；这里假设上游能安全减速。' : '按逻辑时钟推进：消费旧队列，再追加日志并填充连接队列。';
      }
    }
  } else next.event = '连接未订阅：全局日志继续推进；该订阅没有拉取任务或连接队列。';
  return save(state, next);
}
export function pause(state: LabState): LabState { const before = current(state); return save(state, { ...before, paused: !before.paused, event: before.paused ? '恢复客户端读取；消费速率按设置执行。' : '客户端暂停读取，服务端仍可能生产并排队。' }); }
export function close(state: LabState, cancel = false): LabState { return save(state, disconnect(current(state), cancel ? 'cancelled' : 'disconnected', cancel ? '取消传递到订阅生产任务；订阅与待发送队列均已释放。全局日志源独立存在。' : '主动断开并释放连接队列，保留已接收游标以便续读。')); }
export function reconnect(state: LabState): LabState {
  const before = current(state), gap = expiredGap(before);
  if (gap) return save(state, disconnect({ ...before, gap }, 'gap', '续读失败：需要的记录已过期。必须明确接受缺口再从最新位置订阅。'));
  const pending = before.log.filter(e => e.id > before.cursor).map(e => e.id);
  const queue = before.config.policy === 'unbounded' ? pending : pending.slice(0, before.config.capacity);
  return save(state, { ...before, status: 'connected', queue, feedCursor: queue.at(-1) ?? before.cursor, gap: null, fetched: queue.length, event: '新订阅按已接收游标重放；仍受原缓冲和速率约束，可能再次过载。' });
}
export function acceptGap(state: LabState): LabState {
  const before = current(state);
  if (!before.gap) return state;
  return save(state, { ...before, status: 'connected', queue: [], cursor: before.nextID - 1, feedCursor: before.nextID - 1, gap: null, acceptedGaps: [...before.acceptedGaps, [before.cursor + 1, before.nextID - 1]], fetched: 0, event: '已明确跳过到最新位置；缺口与跳过记录被保留展示，不算无损恢复。' });
}
export function rewind(state: LabState): LabState { return state.history.length > 1 ? { history: state.history.slice(0, -1) } : state; }


