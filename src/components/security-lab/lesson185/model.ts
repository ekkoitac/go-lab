export type Context = 'sql-value' | 'sql-order' | 'shell';
export type Outcome = 'data' | 'structure' | 'reject';
export type Config = {context: Context; input: string; optionBoundary: boolean};
export type Lane = {structure: string; data: string[]; outcome: Outcome; explanation: string};
export type State = {config: Config; phase: number; prediction: Outcome | ''; reason: string};
export const initialConfig: Config = {context: 'sql-value', input: "O'Reilly", optionBoundary: true};
export const labels: Record<Outcome, string> = {data: '输入保持为数据', structure: '输入进入语法或选项', reject: '未知结构被拒绝'};
export const stages = ['接收原始输入', '构造调用边界', '解释器读取结构', '核对数据去向'];
export function initialState(config: Config = initialConfig): State { return {config: {...config}, phase: 0, prediction: '', reason: ''}; }
export function compare(config: Config): {raw: Lane; protected: Lane} {
  const {context, input, optionBoundary} = config;
  if (context === 'sql-value') return {
    raw: {structure: `SELECT id FROM customers WHERE name = '${input}'`, data: [], outcome: 'structure', explanation: '字符串拼接把用户内容交给 SQL 语法解析；引号也进入语句文本。这表示边界暴露，不断言每个输入都成功利用。'},
    protected: {structure: 'SELECT id FROM customers WHERE name = ?', data: [input], outcome: 'data', explanation: '值通过绑定通道送达；单引号与空格仍是原始值的一部分，语句模板不变。占位符写法随驱动而异。'},
  };
  if (context === 'sql-order') {
    const columns: Record<string, string> = {'时间': 'created_at', '名称': 'name'};
    const column = Object.hasOwn(columns, input) ? columns[input] : undefined;
    return {
      raw: {structure: `SELECT id FROM customers ORDER BY ${input}`, data: [], outcome: 'structure', explanation: '排序字段是 SQL 结构位置，原样拼接会把选择当作语法。'},
      protected: column ? {structure: `SELECT id FROM customers ORDER BY ${column}`, data: [], outcome: 'data', explanation: `原始选择“${input}”只查受控映射，列名由程序给出。这里保持数据身份指选择值，不是把列名绑定到 ?。`}
        : {structure: '不构造 SQL 调用', data: [], outcome: 'reject', explanation: '未知选择没有对应的可信列名，因此拒绝；不会删除字符或擅自改写原始输入。ORDER BY ? 不能替代列名映射。'},
    };
  }
  const option = input.length > 1 && input.startsWith('-') && !optionBoundary;
  return {
    raw: {structure: `sh -c "cat ${input}"`, data: [], outcome: 'structure', explanation: '用户内容进入 shell 命令文本；空格、分号等可能改变命令结构。这里不模拟任意 shell 语法。'},
    protected: {structure: optionBoundary ? '固定程序 /bin/cat · argv = ["--", 原始输入]' : '固定程序 /bin/cat · argv = [原始输入]', data: optionBoundary ? ['--', input] : [input], outcome: option ? 'structure' : 'data', explanation: input === '-' ? '参数 - 保持为一个数据项，但 cat 将这个特殊操作数解释为标准输入；即使有 --，也不能把它变成名为 - 的普通文件。' : input === '' ? '空字符串仍为一个空 argv 项；cat 不会因此取得普通文件。这只是数据身份观察，不代表文件存在或操作成功。' : option ? '没有 shell，但 cat 会把以 - 开头的参数当选项候选；参数数组并不取消目标程序的选项解释。' : optionBoundary ? '此模型选用支持 -- 的 cat：-- 结束选项解析，后一个完整参数进入操作数通道；此例按文件名处理，原始字符保留。特殊操作数仍遵循 cat 的语义。' : '这个输入不以 - 开头；作为一个 argv 项到达 cat，shell 元字符不会再被 shell 解释。'},
  };
}
export type Action = {type: 'step' | 'back' | 'reset'} | {type: 'configure'; config: Config} | {type: 'predict'; value: Outcome | ''} | {type: 'reason'; value: string};
export function transition(state: State, action: Action): State {
  if (action.type === 'configure') return initialState(action.config);
  if (action.type === 'reset') return initialState(state.config);
  if (action.type === 'back') return {...state, phase: Math.max(0, state.phase - 1)};
  if (action.type === 'step') return state.prediction && state.reason.trim() ? {...state, phase: Math.min(3, state.phase + 1)} : state;
  if (state.phase > 0) return state;
  if (action.type === 'predict') return {...state, prediction: action.value};
  if (action.type === 'reason') return {...state, reason: action.value};
  return state;
}
export function feedback(state: State): string {
  const lane = compare(state.config).protected;
  return `${state.prediction === lane.outcome ? '预测与观察一致' : '预测需要修正'}：${labels[lane.outcome]}。${lane.explanation}`;
}


