export type OpenResult = 'success' | 'missing' | 'denied';
export type Policy = 'ignore' | 'early' | 'checked';
export type Outcome = 'original' | 'secondary' | 'early-close' | 'success';
export interface Config { result: OpenResult; policy: Policy }
export interface ResourceState {
  stage: string; file: 'unopened' | 'nil' | 'open' | 'closed'; primary: string | null;
  reported: string | null; deferred: 'none' | 'nil' | 'file'; readCalls: number;
  closeCalls: number; closeError: string | null; event: string; done: boolean;
}
export const initialConfig: Config = { result: 'missing', policy: 'ignore' };
export function buildTrace(config: Config): ResourceState[] {
  let s: ResourceState = { stage: '准备', file: 'unopened', primary: null, reported: null, deferred: 'none', readCalls: 0, closeCalls: 0, closeError: null, event: '先预测，再执行；文件尚未打开。', done: false };
  const trace = [s];
  const push = (patch: Partial<ResourceState>) => { s = { ...s, ...patch }; trace.push(s); };
  const error = config.result === 'missing' ? 'open config.ini: file does not exist' : config.result === 'denied' ? 'open config.ini: permission denied' : null;
  push({ stage: 'Open', file: error ? 'nil' : 'open', primary: error, event: error ? 'Open 失败：f=nil，err 保留路径与原因。' : 'Open 成功：取得可用文件，开始承担清理责任。' });
  const register = () => push({ stage: 'defer 注册', deferred: error ? 'nil' : 'file', event: error ? '注册 defer 时接收者求值为 nil；此刻并未调用 Close。' : '注册 defer，保存当前文件接收者；此刻文件仍打开。' });
  if (config.policy !== 'checked') register();
  if (config.policy !== 'ignore') {
    push({ stage: '检查 err', event: error ? 'err != nil：直接返回 Open 错误，不进入 Read。' : 'err == nil：允许使用文件并注册清理。', reported: error });
    if (!error && config.policy === 'checked') register();
  }
  if (!error || config.policy === 'ignore') push({ stage: 'Read', readCalls: 1, reported: error ? 'invalid argument' : null, event: error ? '对 nil *os.File 调用 Read 得到 os.ErrInvalid；若只返回这个错误，Open 的失败原因就丢了。' : 'Read 使用有效文件，读取配置成功。' });
  push({ stage: 'return', event: '函数准备返回，接下来按注册记录执行 defer。' });
  if (s.deferred !== 'none') push({ stage: 'defer 执行', closeCalls: 1, closeError: error ? 'invalid argument' : null, file: error ? 'nil' : 'closed', event: error ? '对 nil *os.File 执行 Close 得到 os.ErrInvalid。这个示例忽略 Close 的返回值，不把它说成必然 panic。' : '函数退出时执行 Close，文件由打开变为关闭。' });
  push({ stage: '完成', done: true, event: error ? config.policy === 'checked' ? '原始 Open 错误返回；没有读取，也没有注册或调用 Close。' : config.policy === 'early' ? '原始错误保留，但多注册并执行了一次无效 Close。' : '返回的是二次 Read 错误；原始 Open 原因没有交给调用者。' : '读取完成，退出时关闭文件。' });
  return trace;
}
export function outcome(config: Config): Outcome {
  if (config.result === 'success') return 'success';
  return config.policy === 'checked' ? 'original' : config.policy === 'early' ? 'early-close' : 'secondary';
}
export const outcomeLabels: Record<Outcome, string> = {
  original: '返回 Open 原因；不读取、不关闭', secondary: '返回二次 Read 错误；无效 Close',
  'early-close': '返回 Open 原因；仍调用无效 Close', success: '读取成功；退出时关闭文件',
};
