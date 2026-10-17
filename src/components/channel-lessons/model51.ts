export type Mode51 = 'concurrent' | 'same';
export type Action51 = 'send' | 'receive' | 'process' | 'waitDone';
export type Outcome51 = 'waiting' | 'handoff' | 'processed' | 'confirmed' | 'blocked';
export interface State51 {
  mode: Mode51;
  sender: 'ready' | 'waiting' | 'sent';
  receiver: 'ready' | 'waiting' | 'processing' | 'done';
  confirmation: 'unchecked' | 'waiting' | 'confirmed';
  outcome: Outcome51 | null;
  message: string;
}
export function initial51(mode: Mode51 = 'concurrent'): State51 {
  return {mode, sender:'ready', receiver:'ready', confirmation:'unchecked', outcome:null, message:'选择要调度的角色，先预测结果，再执行一步。订单值固定为 7。'};
}
export function deadlocked51(s: State51) { return s.mode === 'same' && s.sender === 'waiting'; }
export function available51(s: State51, action: Action51): boolean {
  if (deadlocked51(s)) return false;
  if (action === 'send') return s.sender === 'ready';
  if (action === 'receive') return s.mode === 'concurrent' && s.receiver === 'ready';
  if (action === 'process') return s.receiver === 'processing';
  return s.mode === 'concurrent' && s.sender === 'sent' && s.confirmation === 'unchecked';
}
export function step51(s: State51, action: Action51): State51 {
  if (!available51(s, action)) return {...s, outcome:'blocked', message: deadlocked51(s) ? '唯一 goroutine 停在 ch <- 7；后面的 <-ch 无法执行。在这个没有其他任务的封闭程序里发生死锁。' : '当前代码位置不能执行此操作。'};
  if (action === 'send') {
    if (s.receiver === 'waiting') return {...s, sender:'sent', receiver:'processing', outcome:'handoff', message:'发送 7 与等待中的接收配对；通信完成，接收者现在才可以开始业务处理。'};
    return {...s, sender:'waiting', outcome:'waiting', message: s.mode === 'same' ? '发送停住了：唯一 goroutine 无法走到下一行接收，封闭程序死锁。' : '发送者停在 ch <- 7。容量为 0，7 留在待完成的发送操作中，没有进入缓存。'};
  }
  if (action === 'receive') {
    if (s.sender === 'waiting') return {...s, sender:'sent', receiver:'processing', outcome:'handoff', message:'接收者取到 7，交接配对完成。双方可继续，但开票业务尚未完成。'};
    return {...s, receiver:'waiting', outcome:'waiting', message:'接收者停在 <-ch，等待发送者到场。先启动接收也不会凭空得到数据。'};
  }
  if (action === 'process') return {...s, receiver:'done', confirmation:s.confirmation === 'waiting' ? 'confirmed' : s.confirmation, outcome:'processed', message:s.confirmation === 'waiting' ? '开票完成并 close(done)，等待 done 的发送者被唤醒，业务结束得到确认。' : '开票完成并 close(done)。发送者还需执行 <-done，才能通过协议确认完成。'};
  if (s.receiver === 'done') return {...s, confirmation:'confirmed', outcome:'confirmed', message:'done 已关闭，<-done 立即返回：此时才有业务完成的明确证据。'};
  return {...s, confirmation:'waiting', outcome:'waiting', message:'数据交接已经完成，但开票仍未完成；发送者停在 <-done 等待业务结束通知。'};
}
