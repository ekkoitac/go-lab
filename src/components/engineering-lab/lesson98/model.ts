export type CopyPolicy = 'descriptor' | 'elements' | 'deep' | 'readonly';
export type ConfigKind = 'strings' | 'maps';
export type Mutation = 'element' | 'nested';
export interface Settings { kind: ConfigKind; policy: CopyPolicy; mutation: Mutation }
export interface ConfigState {
  step: number; settings: Settings;
  arrays: Record<string, string[]>; maps: Record<string, {mode: string}>;
  global: string; a: string | null; b: string | null;
  blocked: boolean; aValue: string | null; bValue: string | null;
  globalValue: string; explanation: string;
}
export const initialSettings: Settings = {kind:'strings', policy:'descriptor', mutation:'element'};
export const policies: Record<CopyPolicy, string> = {
  descriptor:'仅复制切片描述符', elements:'复制外层元素', deep:'复制元素及内部 map', readonly:'受控只读访问',
};
export function normalize(settings: Settings): Settings {
  return {...settings, mutation: settings.kind === 'strings' ? 'element' : settings.mutation};
}
// Explicit heap IDs describe aliasing, not measured Go addresses or allocations.
export function stateAt(input: Settings, requestedStep: number): ConfigState {
  const settings = normalize(input);
  const step = Math.max(0, Math.min(3, Math.trunc(requestedStep)));
  const arrays: Record<string, string[]> = {G: [settings.kind === 'strings' ? 'stable' : 'M0']};
  const maps: Record<string, {mode:string}> = settings.kind === 'maps' ? {M0:{mode:'stable'}} : {};
  const value = (ref:string) => settings.kind === 'strings' ? arrays[ref][0] : maps[arrays[ref][0]].mode;
  const obtain = (request:'A'|'B') => {
    if (settings.policy === 'descriptor' || settings.policy === 'readonly') return 'G';
    arrays[request] = [...arrays.G];
    if (settings.kind === 'maps' && settings.policy === 'deep') {
      const id = `M${request}`;
      maps[id] = {...maps[arrays.G[0]]};
      arrays[request][0] = id;
    }
    return request;
  };
  const a = step >= 1 ? obtain('A') : null;
  const blocked = step >= 2 && settings.policy === 'readonly';
  if (step >= 2 && a && !blocked) {
    if (settings.kind === 'strings') arrays[a][0] = 'debug';
    else if (settings.mutation === 'nested') maps[arrays[a][0]].mode = 'debug';
    else { maps.Mnew = {mode:'debug'}; arrays[a][0] = 'Mnew'; }
  }
  const b = step >= 3 ? obtain('B') : null;
  let explanation = '全局默认配置为 stable；请求 A 和 B 尚未取配置。';
  if (step === 1) explanation = settings.policy === 'readonly'
    ? 'A 仅持有读取入口。底层配置仍共享，但接口不暴露切片或 map，也没有写入方法。'
    : settings.policy === 'descriptor'
      ? 'A 获得独立切片描述符（ptr / len / cap）；ptr 仍指向全局数组 G，元素没有复制。'
      : settings.kind === 'maps' && settings.policy === 'elements'
        ? 'A 的外层数组独立，但复制过去的元素仍引用 map M0。'
        : 'A 的可修改数据与全局数据已按所选层级分离。';
  if (step === 2) explanation = blocked
    ? '修改被访问边界拒绝：Go 没有只读 slice 类型，这里用不暴露可变容器的读取函数实现只读共享。'
    : value('G') === 'debug'
      ? settings.kind === 'maps' && settings.mutation === 'nested'
        ? `A 写入 ${arrays[a!][0]} 的 mode；全局也引用这个 map，因此全局变为 debug。`
        : 'A 替换共享数组 G 的第 0 个元素，全局配置随之变为 debug。'
      : settings.kind === 'maps' && settings.mutation === 'element'
        ? 'A 只替换自己的数组元素为新 map；全局数组的元素仍引用原 map M0。'
        : '本次写入只到达 A 的私有数据，全局保持 stable。';
  if (step === 3) explanation = `B 后来从全局取配置，读到 ${value(b!)}。${value(b!) === 'debug' ? '这是跨请求污染；B 即使此刻再复制，也只会复制已经污染的值。' : '本次请求 A 没有改变全局可见值。'} 本模型按顺序执行，并未运行并发或 race 检测。`;
  return {step, settings, arrays, maps, global:'G', a, b, blocked,
    aValue:a ? value(a) : null, bValue:b ? value(b) : null,
    globalValue:value('G'), explanation};
}
export function codeFor(input:Settings):string {
  const s=normalize(input);
  const factory=s.policy==='descriptor' ? 'a := defaults'
    : s.policy==='readonly' ? 'mode := configMode() // 只返回字符串值'
    : s.kind==='strings' ? 'a := append([]string(nil), defaults...)'
    : s.policy==='elements' ? 'a := append([]map[string]string(nil), defaults...)'
    : 'a := make([]map[string]string, len(defaults))\nfor i, m := range defaults {\n  a[i] = maps.Clone(m) // 本例 map 的值都是 string\n}';
  const write=s.policy==='readonly' ? '// 读取 API 不提供修改 defaults 的方法'
    : s.kind==='strings' ? 'a[0] = "debug"'
    : s.mutation==='nested' ? 'a[0]["mode"] = "debug"'
    : 'a[0] = map[string]string{"mode": "debug"}';
  return `${factory}\n${write}`;
}
