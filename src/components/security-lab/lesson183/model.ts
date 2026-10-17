export type Scenario = 'redirect' | 'dns' | 'large' | 'normal';
export type Outcome = 'pending' | 'internal' | 'blocked' | 'limited' | 'completed';
export type Config = {partner: 'atlas' | 'birch' | 'cedar'; scenario: Scenario; egress: boolean; redirects: 'unchecked' | 'each' | 'disabled'; limits: boolean; bytes: number; seconds: number};
export type Frame = {stage: string; host: string; resolved: string; dial: string; connections: string[]; bytes: number; seconds: number; outcome: Outcome; evidence: string};
export const partners = {atlas:'atlas.example.invalid',birch:'birch.example.invalid',cedar:'cedar.example.invalid'};
export const defaults: Config = {partner:'atlas',scenario:'redirect',egress:false,redirects:'unchecked',limits:false,bytes:12,seconds:6};
export const outcomes: Record<Outcome,string> = {pending:'待执行',internal:'触达内网',blocked:'连接前拒绝',limited:'资源限制终止',completed:'完成读取'};
/** Pure symbolic teaching model: no network operations or production IP classifier. */
export function trace(config: Config): Frame[] {
  const frames: Frame[] = [];
  let state: Frame = {stage:'选择合作方',host:partners[config.partner],resolved:'尚未解析',dial:'尚未拨号',connections:[],bytes:0,seconds:0,outcome:'pending',evidence:`${config.partner} 只映射到服务端固定配置；这里没有任意 URL 输入。`};
  const add=(change: Partial<Frame>)=>{state={...state,...change,connections:change.connections ?? [...state.connections]};frames.push(state);};
  add({});
  add({stage:'初次解析检查',resolved:'合作方公网 P',evidence:'初始域名与解析地址通过模型配置检查；此时尚未建立连接。'});
  const first=config.scenario==='dns'?'内网 I':'合作方公网 P';
  if(config.egress && first==='内网 I') {add({stage:'实际拨号检查',dial:first,outcome:'blocked',evidence:'DNS 在初查后变化。受控出口检查实际拨号地址，拒绝内网 I；连接数仍为 0。'});return frames;}
  add({stage:'实际拨号',dial:first,connections:[first],evidence:first==='内网 I'?'DNS 在初查后变化；初查 P 并没有约束本次拨号 I。':'实际连接到合作方公网 P。模型假定 TLS 身份验证通过。'});
  if(first==='内网 I'){add({stage:'边界突破',outcome:'internal',evidence:'证据：初次解析 P → 实际拨号 I；修复应落在实际连接，不只增加字符串过滤。'});return frames;}
  if(config.scenario==='redirect') {
    add({stage:'收到重定向',host:'unapproved.example.invalid',resolved:'内网 I',evidence:'合作方返回新的目标；尚未建立第二条连接。新的目标不在合作方配置中。'});
    if(config.redirects!=='unchecked'){add({stage:'重定向决策',outcome:'blocked',evidence:config.redirects==='disabled'?'禁止跟随重定向；已有公网连接保留为历史，但内网未连接。':'逐跳核对目标配置，新的目标未获批准；在第二次拨号前拒绝。'});return frames;}
    if(config.egress){add({stage:'第二跳出口检查',dial:'内网 I',outcome:'blocked',evidence:'未审核的跳转进入拨号阶段，但实际出口拒绝内网 I；仍只有一次公网连接。'});return frames;}
    add({stage:'第二跳实际拨号',dial:'内网 I',connections:[...state.connections,'内网 I'],outcome:'internal',evidence:'自动跟随且出口未约束实际地址：第二跳触达内网。只检查第一跳不能保护第二跳。'});return frames;
  }
  const bytes=config.scenario==='large'?config.bytes:2,seconds=config.scenario==='large'?config.seconds:1;
  if(config.limits && (bytes>4 || seconds>3)) {
    const rate=bytes/Math.max(seconds,0.001),elapsed=Math.min(seconds,3,4/Math.max(rate,0.001));
    add({stage:'有界响应读取',bytes:Math.min(bytes,4,rate*elapsed),seconds:elapsed,outcome:'limited',evidence:`响应计划 ${bytes} KB / ${seconds} 秒，超过 4 KB 或 3 秒边界，停止读取。目标合法不代表资源无限。`});
  } else add({stage:'响应读取',bytes,seconds,outcome:'completed',evidence:`读取 ${bytes} KB，用时 ${seconds} 秒。${config.limits?'未超过 4 KB / 3 秒边界。':'当前未设置读取边界；这次完成不证明其他响应也有界。'}`});
  return frames;
}
export function result(config:Config):Outcome{return trace(config).at(-1)!.outcome;}
export const sequence = ['合作方 ID 映射','初次解析检查','实际拨号出口检查','TLS 身份验证','响应与逐跳控制','有界读取'];
export function orderFeedback(order:string[]):string {
  const at=(s:string)=>order.indexOf(s);
  if(sequence.some(s=>at(s)<0))return '缺少边界步骤，不能运行。';
  if(at(sequence[2])<at(sequence[1]))return '应先拿到解析结果，再在实际拨号边界检查；两者不能相互替代。';
  if(at(sequence[3])<at(sequence[2]))return 'TLS 身份验证发生在连接流程中；先约束实际拨号目的地。';
  if(at(sequence[4])<at(sequence[3]))return '先验证 TLS 身份，再处理可信连接上的响应。';
  if(at(sequence[0])!==0 || at(sequence[5])!==5)return '先从受控配置选择目的地，最终读取仍需资源边界。';
  return '顺序成立。若收到重定向，回到目标配置、解析和实际拨号检查；不能跳过这些边界。';
}
