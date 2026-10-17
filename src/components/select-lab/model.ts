export type Branch = 'a' | 'b';
export type Outcome = Branch | 'default';
export type Prediction = Outcome | 'both' | 'wait';
export type Stage = 1 | 2 | 3 | 4 | 5;
export type Board = {
  a: boolean;
  b: boolean;
  cancelled: boolean;
  cancellation: boolean;
  order: [Branch, Branch];
  withDefault: boolean;
};
export type SelectState = {
  stage: Stage;
  board: Board;
  phase: 'setup' | 'waiting' | 'ready' | 'selected' | 'done';
  choice: Outcome | null;
  runStart: Board | null;
  snapshot: Board | null;
  source: 'random' | 'demo';
  prediction: Prediction[];
  feedback: string | null;
  label: string;
  runs: {outcome: Outcome; source: 'random' | 'demo'; snapshot: Board}[];
};
export type Action =
  | {type: 'supply'; branch: Branch}
  | {type: 'swap'}
  | {type: 'default'; enabled: boolean}
  | {type: 'predict'; value: Prediction}
  | {type: 'check'}
  | {type: 'execute'}
  | {type: 'next'}
  | {type: 'retry'}
  | {type: 'clear'}
  | {type: 'alternative'};
export type Timeline = {states: SelectState[]; cursor: number};

export function initialState(stage: Stage = 1): SelectState {
  return {
    stage, board: {a: false, b: false, cancelled: false, cancellation: stage === 5,
      order: stage === 5 ? ['b', 'a'] : ['a', 'b'], withDefault: false},
    phase: 'setup', choice: null, runStart: null, snapshot: null, source: 'random',
    prediction: [], feedback: null, label: '从空通道开始布置条件', runs: [],
  };
}

export function readyBranches(board: Board): Branch[] {
  // Channel identity, not source-code order, determines eligibility.
  return (['a', 'b'] as const).filter(id => id === 'a' ? board.a : board.cancellation ? board.cancelled : board.b);
}

export function legalPredictions(board: Board): Exclude<Prediction, 'both'>[] {
  const ready = readyBranches(board);
  return ready.length ? ready : [board.withDefault ? 'default' : 'wait'];
}

export function branchName(board: Board, branch: Branch): string {
  return board.cancellation ? branch === 'a' ? '请求结果' : '取消信号' : branch.toUpperCase();
}

export function predictionFeedback(board: Board, prediction: Prediction[]): string {
  const legal = legalPredictions(board);
  const names = legal.map(id => id === 'wait' ? '继续等待' : id === 'default' ? '执行 default' : branchName(board, id));
  const correct = legal.length === prediction.length && legal.every(id => prediction.includes(id));
  if (correct) return `预测正确。可能结果：${names.join(' 或 ')}。${legal.length === 2 ? '两种结果都合法，但一次只执行一个分支。' : '由当前就绪条件决定。'}`;
  const reasons: string[] = [];
  if (prediction.includes('both')) reasons.push('一次 select 只执行一个分支，不会把两个都执行。');
  if (legal.length === 2 && (!prediction.includes('a') || !prediction.includes('b'))) reasons.push('两个分支都已就绪，排在后面或较晚到达的也可能被选中。');
  if (prediction.includes('wait') && readyBranches(board).length) reasons.push('已有通信可以进行，无需继续等待。');
  if (prediction.includes('default') && readyBranches(board).length) reasons.push('default 只在所有通信都不能进行时执行。');
  return `再观察一下。${reasons.join('')}当前可能结果：${names.join(' 或 ')}。可以修改预测，也可以继续实验。`;
}

function choose(s: SelectState, random: () => number): SelectState {
  const ready = readyBranches(s.board);
  if (!ready.length && !s.board.withDefault) return {...s, phase: 'waiting', choice: null, snapshot: null, label: '没有就绪通信：goroutine 停在 select，等待消息或信号'};
  const choice = ready.length ? ready[ready.length === 1 ? 0 : random() < 0.5 ? 0 : 1] : 'default';
  return {...s, phase: 'ready', choice, snapshot: structuredClone(s.board), label: ready.length ? `选择时有 ${ready.length} 个就绪分支；下一步揭示本次选择` : '没有就绪通信：本次将执行 default'};
}

/** Each decision is sampled once. Later display steps never sample again. */
export function transition(s: SelectState, action: Action, random: () => number = Math.random): SelectState {
  const configurable = s.phase === 'setup';
  switch (action.type) {
    case 'supply': {
      if ((!configurable && s.phase !== 'waiting') || readyBranches(s.board).includes(action.branch)) return s;
      const board = {...s.board};
      if (action.branch === 'a') board.a = true;
      else if (board.cancellation) board.cancelled = true;
      else board.b = true;
      const label = board.cancellation && action.branch === 'b' ? '发出取消：关闭信号通道，取消持续生效' : `放入 ${branchName(board, action.branch)} 消息`;
      const next = {...s, board, feedback: null, label};
      if (s.phase !== 'waiting') return next;
      const awakened = choose(next, random);
      return {...awakened, label: `${label}；唤醒等待中的 select，已固定本次选择`};
    }
    case 'swap':
      return configurable ? {...s, board: {...s.board, order: [s.board.order[1], s.board.order[0]]}, feedback: null, label: '交换 case 位置；通道内容和身份保持不变'} : s;
    case 'default':
      return configurable && s.board.withDefault !== action.enabled ? {...s, board: {...s.board, withDefault: action.enabled}, prediction: action.enabled ? s.prediction : s.prediction.filter(p=>p!=='default'), feedback: null, label: action.enabled ? '加入 default：无就绪通信时不等待' : '移除 default：无就绪通信时等待'} : s;
    case 'predict':
      return configurable ? {...s, prediction: s.prediction.includes(action.value) ? s.prediction.filter(p => p !== action.value) : [...s.prediction, action.value], feedback: null, label: '修改对所有可能结果的预测'} : s;
    case 'check':
      return configurable ? {...s, feedback: predictionFeedback(s.board, s.prediction), label: '对照当前条件检查预测'} : s;
    case 'execute':
      return configurable ? choose({...s, runStart: structuredClone(s.board), source: 'random', feedback: s.stage > 1 && s.prediction.length ? predictionFeedback(s.board, s.prediction) : s.feedback}, random) : s;
    case 'next':
      if (s.phase === 'ready') return {...s, phase: 'selected', label: s.choice === 'default' ? '选中 default；不接收任何消息' : `本次选中 ${branchName(s.board, s.choice!)}；另一个分支不执行`};
      if (s.phase !== 'selected' || !s.choice || !s.snapshot) return s;
      return {...s, phase: 'done', board: {...s.board, a: s.choice === 'a' ? false : s.board.a, b: s.choice === 'b' && !s.board.cancellation ? false : s.board.b},
        runs: [...s.runs, {outcome: s.choice, source: s.source, snapshot: s.snapshot}],
        label: s.choice === 'default' ? '执行 default 后离开 select，没有取走消息' : s.choice === 'b' && s.board.cancellation ? '已响应取消并离开 select；取消信号仍然生效' : `已接收 ${branchName(s.board, s.choice)} 并离开 select；未选中的通道保持原状`};
    case 'retry': {
      const snapshot = s.snapshot ?? s.runStart;
      if (!snapshot || (s.phase !== 'done' && s.phase !== 'waiting')) return s;
      return {...s, board: structuredClone(snapshot), phase: 'setup', choice: null, runStart: null, snapshot: null, source: 'random', feedback: null, label: '恢复选择前的相同条件；下一次执行重新选择'};
    }
    case 'clear': {
      if (s.phase === 'ready' || s.phase === 'selected') return s;
      const fresh = initialState(s.stage);
      return {...fresh, board: {...fresh.board, order: [...s.board.order], withDefault: s.board.withDefault}, runs: s.runs, label: '清空通道，安排新条件；保留已完成的对照记录'};
    }
    case 'alternative': {
      if (s.phase !== 'done' || !s.snapshot || readyBranches(s.snapshot).length !== 2 || (s.choice !== 'a' && s.choice !== 'b')) return s;
      return {...s, board: structuredClone(s.snapshot), phase: 'ready', choice: s.choice === 'a' ? 'b' : 'a', source: 'demo', feedback: null, label: '合法路径演示：恢复相同条件，展示另一种结果（不计入随机记录）'};
    }
  }
}

export function createTimeline(stage: Stage = 1): Timeline {
  return {states: [initialState(stage)], cursor: 0};
}

export function applyAction(t: Timeline, action: Action, random: () => number = Math.random): Timeline {
  const current = t.states[t.cursor], next = transition(current, action, random);
  if (next === current) return t;
  const states = [...t.states.slice(0, t.cursor + 1), next];
  return {states, cursor: states.length - 1};
}

export function seek(t: Timeline, cursor: number): Timeline {
  return {...t, cursor: Math.max(0, Math.min(t.states.length - 1, cursor))};
}
