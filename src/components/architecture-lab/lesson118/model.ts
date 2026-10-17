export type Mode = 'sync' | 'poll' | 'push';
export type JobStatus = 'accepted' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
export interface Config { mode: Mode; duration: number }
export interface Job { id: string; status: JobStatus; progress: number; retention: number }
export interface Snapshot { config: Config; job: Job | null; pageOpen: boolean; actor: 'owner' | 'other'; dropNotification: boolean; known: 'none' | 'waiting' | 'unknown' | JobStatus; savedId: boolean; connected: boolean; downloaded: boolean; notification: 'none' | 'delivered' | 'lost'; notice: string }
export interface LabState { current: Snapshot; history: Snapshot[] }
export const names: Record<JobStatus, string> = { accepted: '已接收', running: '处理中', succeeded: '成功', failed: '失败', cancelled: '已取消', expired: '结果已过期' };
export const modeNames: Record<Mode, string> = { sync: '同步等待', poll: '持久任务 + 状态查询', push: '持久任务 + 推送与查询' };
export const knownNames = { ...names, none: '尚未请求', waiting: '等待同步响应', unknown: '当前结果未知' };
export const budget = 2;
export function initial(config: Config = { mode: 'push', duration: 3 }): LabState { return { current: { config: { ...config, duration: Number.isFinite(config.duration) ? Math.max(1, Math.min(5, Math.round(config.duration))) : 3 }, job: null, pageOpen: true, actor: 'owner', dropNotification: false, known: 'none', savedId: false, connected: false, downloaded: false, notification: 'none', notice: '准备提交导出。接受任务后仍需执行，任务事实与客户端所知分开显示。' }, history: [] }; }
function commit(state: LabState, current: Snapshot): LabState { return { current, history: [...state.history, state.current] }; }
export function rewind(state: LabState): LabState { return state.history.length ? { current: state.history.at(-1)!, history: state.history.slice(0, -1) } : state; }
export function configure(state: LabState, patch: Partial<Config>): LabState { return initial({ ...state.current.config, ...patch }); }
function notify(current: Snapshot) {
  if (current.config.mode !== 'push') return;
  if (current.pageOpen && current.actor === 'owner' && !current.dropNotification) { current.notification = 'delivered'; current.known = current.job!.status; }
  else current.notification = 'lost';
}
export function canAdvance(state: LabState): boolean { const current = state.current; return !current.job ? current.pageOpen && current.actor === 'owner' : ['accepted', 'running', 'succeeded'].includes(current.job.status); }
export function advance(state: LabState): LabState {
  if (!canAdvance(state)) return state;
  const current = structuredClone(state.current);
  if (!current.job) {
    current.job = { id: 'T-118', status: 'accepted', progress: 0, retention: 0 };
    current.savedId = current.config.mode !== 'sync'; current.connected = current.config.mode === 'sync';
    current.known = current.config.mode === 'sync' ? 'waiting' : 'accepted';
    current.notice = current.savedId ? '任务记录已创建，返回 T-118。此时没有导出结果。' : '同步请求已到达服务端，连接正在等待结果；未提供独立任务查询契约。';
  } else if (current.job.status === 'accepted') {
    current.job.status = 'running'; current.notice = '工作者开始处理。后台状态变为处理中；没有查询的客户端仍只知道已接收。';
  } else if (current.job.status === 'running') {
    current.job.progress++;
    if (current.job.progress >= current.config.duration) {
      current.job.status = 'succeeded'; current.job.retention = 2;
      if (current.config.mode === 'sync' && current.connected && current.pageOpen && current.actor === 'owner') { current.known = 'succeeded'; current.downloaded = true; current.connected = false; }
      notify(current);
      current.notice = '工作者已完成，服务端结果保留 2 个逻辑单位。客户端是否得知，取决于响应、通知或后续查询。';
    } else {
      if (current.config.mode === 'sync' && current.connected && current.job.progress >= budget) { current.connected = false; current.known = 'unknown'; }
      current.notice = current.config.mode === 'sync' && !current.connected ? '同步连接已断开或超时；本模型中后台仍在继续，客户端没有可靠查询契约。' : `处理推进到 ${current.job.progress}/${current.config.duration}；页面开关不会自动取消工作。`;
    }
  } else if (current.job.status === 'succeeded') {
    current.job.retention--;
    if (current.job.retention <= 0) { current.job.status = 'expired'; current.notice = '结果保留期结束，服务端下载不再可用；客户端旧状态不会自动刷新，已下载的本地副本不被撤销。'; }
    else current.notice = '保留期推进 1 单位；服务端结果还可获取 1 单位。';
  }
  return commit(state, current);
}
export function setPage(state: LabState, open: boolean): LabState {
  const current = structuredClone(state.current); current.pageOpen = open;
  if (!open && current.connected) { current.connected = false; current.known = 'unknown'; }
  if (open && current.job) current.known = 'unknown';
  current.notice = open ? current.savedId ? '页面已重开。任务 ID 可用于恢复，但先前状态可能过时；请查询当前事实。' : '页面已重开，此方案尚无可恢复的任务编号。' : '页面已关闭。没有发出取消请求，服务端工作继续。';
  return commit(state, current);
}
export function setActor(state: LabState, actor: Snapshot['actor']): LabState { return commit(state, { ...state.current, actor, known: state.current.job ? 'unknown' : 'none', downloaded: false, connected: false, notice: actor === 'other' ? '切换为其他用户；即使知道任务编号，查询与下载仍需分别授权。' : '切回任务所有者，请重新查询确认当前状态。' }); }
export function setDrop(state: LabState, dropNotification: boolean): LabState { return commit(state, { ...state.current, dropNotification, notice: '只影响之后的推送；已经丢失的通知不会因此重发，请查询恢复。' }); }
function denied(current: Snapshot, action: string): string | null {
  if (!current.pageOpen) return '页面关闭，无法从此客户端发出请求。';
  if (current.actor !== 'owner') return `${action}被拒绝：没有此任务的访问权限（403）。`;
  if (!current.job) return '尚未创建任务。';
  if (current.config.mode === 'sync') return '本例同步方案没有独立任务查询／恢复接口；请对照持久任务方案。';
  return null;
}
export function query(state: LabState): LabState { const current = structuredClone(state.current); const issue = denied(current, '查询'); if (issue) current.notice = issue; else { current.known = current.job!.status; current.notice = `授权查询得到事实：${names[current.job!.status]}。推送是否送达不改变这份任务记录。`; } return commit(state, current); }
export function download(state: LabState): LabState {
  const current = structuredClone(state.current), issue = denied(current, '下载');
  if (issue) current.notice = issue;
  else if (current.job!.status === 'succeeded') { current.downloaded = true; current.known = 'succeeded'; current.notice = '下载单独校验了当前用户权限和结果保留期，已取得本地副本。'; }
  else if (current.job!.status === 'expired') { current.known = 'expired'; current.notice = '下载失败：服务端结果已过期（410）；已下载的本地副本不受影响。'; }
  else current.notice = '下载失败：当前没有可获取的成功结果。';
  return commit(state, current);
}
export function cancel(state: LabState): LabState {
  const current = structuredClone(state.current), issue = denied(current, '取消');
  if (issue) current.notice = issue;
  else if (current.job!.status === 'accepted' || current.job!.status === 'running') { current.job!.status = 'cancelled'; current.known = 'cancelled'; current.notice = '取消先于完成提交：任务进入已取消，后续处理不再推进。取消响应已确认。'; notify(current); }
  else current.notice = '任务已经结束：取消不能撤销已生成或已下载的结果，也不会重启失败任务。';
  return commit(state, current);
}
export function fail(state: LabState): LabState {
  if (state.current.job?.status !== 'running') return state;
  const current = structuredClone(state.current); current.job!.status = 'failed';
  if (current.config.mode === 'sync' && current.connected) { current.known = 'failed'; current.connected = false; }
  notify(current); current.notice = '工作者失败，失败状态留在任务记录中。没有完成通知不等于仍在运行，请按编号查询。';
  return commit(state, current);
}

