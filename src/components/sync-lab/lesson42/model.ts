export type TaskId = 'A' | 'B';
export type Task = { id: TaskId; work: number; wait: number };
export type Slice = { tick: number; running: TaskId[]; waiting: TaskId[] };
export type State = { units: 1 | 2; io: boolean; tick: number; tasks: Task[]; timeline: Slice[]; feedback: string };
export function initialState(units: 1 | 2 = 1, io = false): State {
  return {units, io, tick: 0, tasks: [{id:'A',work:0,wait:0},{id:'B',work:0,wait:0}], timeline: [], feedback:'每个任务需要 3 格计算；为下一格选择执行任务。'};
}
export const readyTasks = (state: State) => state.tasks.filter(t => t.work < 3 && t.wait === 0).map(t => t.id);
export const complete = (state: State) => state.tasks.every(t => t.work === 3);
export function advance(state: State, selected: TaskId[]): State {
  if (complete(state)) return state;
  const ready = readyTasks(state);
  if (selected.length > state.units || new Set(selected).size !== selected.length || selected.some(id => !ready.includes(id))) {
    return {...state, feedback:'调度未执行：同一任务不能占两格，任务必须就绪，且不能超过执行单元数。'};
  }
  const waiting = state.tasks.filter(t => t.wait > 0).map(t => t.id);
  const tasks = state.tasks.map(t => {
    if (t.wait > 0) return {...t, wait:t.wait-1};
    if (!selected.includes(t.id)) return t;
    const work = t.work+1;
    return {...t, work, wait:state.io && work === 1 ? 2 : 0};
  });
  const startedIO = tasks.filter(t => t.wait === 2 && selected.includes(t.id)).map(t => t.id);
  const resumed = tasks.filter(t => t.wait === 0 && waiting.includes(t.id)).map(t => t.id);
  return {...state, tick:state.tick+1, tasks, timeline:[...state.timeline,{tick:state.tick+1,running:[...selected],waiting}], feedback:[
    `第 ${state.tick+1} 格：${selected.length ? selected.join('、')+' 各完成 1 格计算' : '计算单元空闲'}。`,
    selected.length === 2 ? '这一格有两个任务同时计算，出现并行。' : '这一格最多一个任务计算，没有计算并行。',
    startedIO.length ? `${startedIO.join('、')} 发起 I/O，接下来等待 2 格；等待不占计算单元。` : '',
    waiting.length ? `${waiting.join('、')} 的 I/O 等待推进 1 格。` : '',
    resumed.length ? `${resumed.join('、')} 现已就绪，可在下一格分配。` : '',
  ].filter(Boolean).join(' ')};
}
export function autoRun(units:1|2, io=false):State {
  let state=initialState(units,io);
  while (!complete(state)) state=advance(state,readyTasks(state).slice(0,units));
  return state;
}
