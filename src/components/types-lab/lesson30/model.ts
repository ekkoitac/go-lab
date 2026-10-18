export type Channel = 'Mail' | 'SMS' | 'Push';
export type Route = 'infer' | 'explicit' | 'queue' | 'clone';
export type Config = { channels: [Channel, Channel]; route: Route; cloneType: 'Mail' | 'Sender' };
export const initial: Config = { channels: ['Mail', 'SMS'], route: 'infer', cloneType: 'Sender' };
export const routes: {id: Route; label: string}[] = [
  {id:'infer', label:'pair(a, b)：自动推断 T'},
  {id:'explicit', label:'pair[Sender](a, b)：显式指定 T'},
  {id:'queue', label:'[]Sender：共同能力队列'},
  {id:'clone', label:'Clone[T]：保留输入输出类型'},
];
export function inspect(c: Config) {
  const [a,b] = c.channels;
  const allowed = c.route === 'infer' ? a === b : c.route === 'clone' ? c.cloneType === 'Sender' || c.channels.every(x => x === 'Mail') : true;
  const elementType = c.route === 'infer' ? (a === b ? a : '?') : c.route === 'clone' ? c.cloneType : 'Sender';
  const args = `${a}{}, ${b}{}`;
  const code = c.route === 'infer' ? `queue := pair(${args})` : c.route === 'explicit' ? `queue := pair[Sender](${args})` : c.route === 'queue' ? `queue := []Sender{${args}}` : `input := []${c.cloneType}{${args}}\nqueue := Clone(input)`;
  const reason = c.route === 'infer' ? a === b ? `两个已定型实参均为 ${a}，推断 T=${a}，返回 []${a}。` : `${a} 与 ${b} 是不同的已定型实参；这里不会自动寻找共同接口作为 T，调用无法编译。` : c.route === 'clone' ? allowed ? `输入 []${c.cloneType} → T=${c.cloneType} → 输出 []${c.cloneType}。Clone 保留元素静态类型；T=Sender 时仍可保存不同动态类型。` : '输入声明为 []Mail，SMS/Push 不能赋给 Mail；错误出在输入切片构造，Clone 还未执行。' : `每个通道都实现 Send() string，可赋给 Sender。${c.route === 'explicit' ? 'T 明确为 Sender，pair 仍然是泛型函数。' : '接口队列按相同行为调度不同具体实现。'}`;
  return {allowed, elementType, code, reason, output: allowed ? c.channels.map(send) : []};
}
export function send(c: Channel) { return `${c.toLowerCase()}:ok`; }
export function snapshot(c: Config, step: number) {
  const r = inspect(c);
  const phase = Math.max(0, Math.min(4, step));
  const sent = r.allowed ? Math.max(0, phase - 2) : 0;
  return { phase, sent, output: r.output.slice(0, sent), built: r.allowed && phase >= 2,
    status: phase === 0 ? '等待检查' : !r.allowed ? '编译失败，运行未开始' : phase === 1 ? '编译通过，尚未构造' : phase === 2 ? '容器就绪，尚未调用 Send' : `已发送 ${sent}/2` };
}
export function repair(c: Config): Config { return {...c, channels:[...c.channels], route: c.route === 'clone' ? 'clone' : 'explicit', cloneType:'Sender'}; }
export function maxStep(c: Config) { return inspect(c).allowed ? 4 : 1; }
