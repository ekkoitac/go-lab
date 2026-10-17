export type Action52 = 'send' | 'receive' | 'finish';
export type Outcome52 = 'buffered' | 'blocked' | 'handoff' | 'received' | 'waiting' | 'finished';
export interface Buffer52 {
  capacity: number; queue: number[]; pending: number | null; processing: number | null;
  receiverWaiting: boolean; next: number; sent: number; completed: number[];
  lastAction: Action52 | null; outcome: Outcome52 | null; explanation: string;
}
export function create52(capacity = 2): Buffer52 {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4) throw new Error('容量必须是 1 到 4 的整数');
  return { capacity, queue: [], pending: null, processing: null, receiverWaiting: false, next: 1, sent: 0, completed: [], lastAction: null, outcome: null, explanation: '先让生产者发送三次，观察容量为 2 的队列在哪里出现等待。' };
}
export function can52(s: Buffer52, action: Action52): boolean {
  return action === 'send' ? s.pending === null : action === 'receive' ? s.processing === null && !s.receiverWaiting : s.processing !== null;
}
export function step52(s: Buffer52, action: Action52): Buffer52 {
  if (!can52(s, action)) return s;
  const n: Buffer52 = { ...s, queue: [...s.queue], completed: [...s.completed], lastAction: action };
  if (action === 'send') {
    const value = n.next++;
    if (n.receiverWaiting) {
      n.receiverWaiting = false; n.processing = value; n.sent++; n.outcome = 'handoff';
      n.explanation = `接收者已在等待：消息 ${value} 直接交接，发送完成；len 仍为 0，业务处理尚未完成。`;
    } else if (n.queue.length < n.capacity) {
      n.queue.push(value); n.sent++; n.outcome = 'buffered';
      n.explanation = `消息 ${value} 放入空槽，发送完成。队列 ${n.queue.length}/${n.capacity}；消费者还没有处理它。`;
    } else {
      n.pending = value; n.outcome = 'blocked';
      n.explanation = `队列已满，消息 ${value} 保留在生产者的发送操作中，尚未入队；生产者停在 ch <- ${value}。没有覆盖或丢弃旧消息。`;
    }
  } else if (action === 'receive') {
    if (n.queue.length) {
      n.processing = n.queue.shift()!; n.outcome = 'received';
      n.explanation = `按 FIFO 取出消息 ${n.processing}，消费者开始处理。`;
      if (n.pending !== null) {
        const waiting = n.pending; n.queue.push(waiting); n.pending = null; n.sent++;
        n.explanation += ` 空槽让等待中的发送 ${waiting} 完成并入队，队列变为 [${n.queue.join(', ')}]，len 仍是 ${n.queue.length}。`;
      } else n.explanation += ` len 降为 ${n.queue.length}，释放一个槽位。`;
    } else {
      n.receiverWaiting = true; n.outcome = 'waiting';
      n.explanation = '队列为空，接收者停在 <-ch 等待；下次发送可以直接交接。';
    }
  } else {
    n.completed.push(n.processing!); n.explanation = `消息 ${n.processing} 处理完成；处理耗时与缓冲容量是不同因素。`;
    n.processing = null; n.outcome = 'finished';
  }
  return n;
}
