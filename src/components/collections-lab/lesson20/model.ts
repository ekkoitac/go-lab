export type Protocol = 'none' | 'reader-only' | 'shared';
export type Config = { protocol: Protocol; snapshot: 'keys' | 'entries'; order: number; writer: boolean };
export type Action = 'collect' | 'sort' | 'write' | 'release' | 'output';
export type Outcome = 'ok' | 'blocked' | 'unsafe';
export type State = Config & { map: Record<string, number>; keys: string[]; values: Record<string, number> | null; reading: boolean; sorted: boolean; rows: string[] | null; conflict: boolean; outcome: Outcome; operation: string };
export const orders = [['zoe','amy','max'],['max','zoe','amy'],['amy','max','zoe']];
export const baseline: Config = {protocol:'none',snapshot:'keys',order:0,writer:true};
export function initial(config: Config = baseline): State { return {...config,map:{zoe:8,amy:5,max:7},keys:[],values:null,reading:false,sorted:false,rows:null,conflict:false,outcome:'ok',operation:'初始：尚未读取共享 map'}; }
export function allowed(s: State, a: Action) { if(s.conflict) return false; return a==='collect' ? !s.keys.length : a==='sort' ? s.keys.length>0&&!s.sorted : a==='write' ? s.writer : a==='release' ? s.reading : s.keys.length>0&&s.rows===null; }
export function transition(s: State, a: Action): State {
  if (!allowed(s,a)) return s;
  if(a==='collect') return {...s,keys:[...orders[s.order%orders.length]],values:s.snapshot==='entries'?{...s.map}:null,reading:true,outcome:'ok',operation:s.snapshot==='entries'?'读取区间开始：复制键和值；整数副本独立':'读取区间开始：只收集键，值还留在共享 map'};
  if(a==='sort') return {...s,keys:[...s.keys].sort(),sorted:true,rows:null,outcome:'ok',operation:'sort.Strings(keys)：只改变目录次序，没有建立同步；请按新目录重新输出'};
  if(a==='release') return {...s,reading:false,outcome:'ok',operation:s.protocol==='none'?'结束本次读取区间；尚未建立任何读写同步':'读取方解锁；后续读取共享值必须再次遵守同步协议'};
  if(a==='write') {
    if(s.reading&&s.protocol==='shared') return {...s,outcome:'blocked',operation:'写者请求 mu.Lock，因读取方持有同一 mu.RLock 而等待；map 不变'};
    if(s.reading) return {...s,conflict:true,outcome:'unsafe',operation:'写者与读取区间重叠且未受同一把锁约束：读写冲突，停止推演确定值'};
    return {...s,map:{...s.map,amy:9},outcome:'ok',operation:s.protocol==='shared'?'写者独占 mu 后更新 amy=9 并释放锁':'本次调度写入 amy=9；这一次未重叠不能证明无同步程序安全'};
  }
  if(s.conflict) return {...s,outcome:'unsafe',operation:'已有未同步的重叠访问：不能给出可靠输出，请回退并修复协议'};
  return {...s,rows:s.keys.map(k=>`${k}:${(s.values??s.map)[k]}`),reading:false,outcome:'ok',operation:s.values?'读取独立整数快照输出；原 map 的后来写入不改变这份快照':s.protocol==='shared'&&!s.reading?'重新获取同一 mu.RLock 读取当前值并输出；键快照不是旧值快照':'按目录读取值并结束读取区间；排序控制顺序，不控制并发安全'};
}
export function replay(config: Config, actions: Action[]) { return actions.reduce(transition,initial(config)); }
export function inspect(s: State) { return {...s,safeProtocol:!s.writer||s.protocol==='shared',snapshotConsistent:s.values!==null&&!s.conflict,outputStableOrder:s.sorted}; }
export const transferTasks = [
  { title:'配置导出', text:'读者在 mu.RLock 内复制所有 string→int 键值，解锁后排序副本；所有写者都用同一个 mu.Lock。', answer:'both', explain:'副本排序建立固定次序，同一把锁保护复制期间的读取；整数副本可以在解锁后独立使用。' },
  { title:'在线积分榜', text:'读者仅在自己的锁 readerMu 内收集键并排序，写者不使用 readerMu，仍更新共享 map。', answer:'order', explain:'排序建立键次序，但私有读锁不能约束写者，仍缺少完整同步。不能用没有报错证明安全。' },
  { title:'冻结的城市目录', text:'启动时完成 map 初始化并安全发布，之后没有任何写者；多个 goroutine 直接 range 输出。', answer:'safe', explain:'没有写者时可以并发只读，但直接 range 的次序仍未指定。' },
];

