export type Method = 'static' | 'plugin' | 'rpc'
export type Failure = 'normal' | 'panic' | 'timeout' | 'file'
export interface Config { os: 'linux' | 'windows'; buildMatch: boolean; protocolMatch: boolean; failure: Failure; restricted: boolean }
export const defaults: Config = { os: 'linux', buildMatch: true, protocolMatch: true, failure: 'panic', restricted: false }
export const methods: Method[] = ['static', 'plugin', 'rpc']
export const names: Record<Method, string> = { static: '静态注册', plugin: 'Go plugin', rpc: '子进程 RPC' }
export const phases = ['等待实验', '检查装载条件', '装载 / 启动', '建立调用契约', '执行扩展', '回收与恢复']
export interface Snapshot { method: Method; phase: number; host: string; extension: string; call: string; file: string; loaded: boolean; trace: string[] }
export function simulate(config: Config, method: Method, inputPhase: number): Snapshot {
  const phase = Math.max(0, Math.min(5, Number.isFinite(inputPhase) ? Math.floor(inputPhase) : 0))
  const s: Snapshot = { method, phase, host: '运行中', extension: '未启动', call: '未发起', file: '未访问', loaded: false, trace: [] }
  if (!phase) return s
  if (method === 'plugin' && (config.os === 'windows' || !config.buildMatch)) {
    s.extension = '装载被阻止'
    s.call = '无法调用'
    s.trace.push(config.os === 'windows' ? 'Windows 不支持 Go plugin，停止装载。' : '共同依赖 / 工具链构建不兼容，本例在装载时拒绝。')
    return s
  }
  s.trace.push(method === 'static' ? '扩展随宿主同版编译，目标平台已有可执行文件。' : method === 'plugin' ? 'Linux 且工具链、构建选项与共同依赖一致，通过本例装载检查。' : '目标平台已有子进程可执行文件；独立构建，不依赖宿主 Go ABI。')
  if (phase < 2) return s
  s.loaded = true
  s.extension = method === 'rpc' ? '子进程运行中' : '宿主进程内已装载'
  s.trace.push(method === 'rpc' ? '启动独立进程；尚未声明任何权限隔离。' : '扩展与宿主共享地址空间和操作系统权限。')
  if (phase < 3) return s
  if (method === 'rpc' && !config.protocolMatch) {
    s.call = '握手拒绝（v1 ≠ v2）'
    s.trace.push('宿主只接受 v1，扩展只提供 v2；未发送业务请求。')
    if (phase === 5) { s.extension = '已回收'; s.loaded = false; s.trace.push('回收未通过握手的子进程；需修正协议后重试。') }
    return s
  }
  s.call = '调用契约就绪'
  s.trace.push(method === 'rpc' ? '双方支持 v1，握手成功，允许发送业务请求。' : '使用编译期 Go 接口调用，不执行 RPC 版本握手。')
  if (phase < 4) return s
  if (config.failure === 'panic') {
    s.extension = '因未恢复 panic 退出'; s.loaded = false; s.call = '失败'
    if (method === 'rpc') s.trace.push('扩展进程退出 → RPC 连接断开 → 本次调用失败，宿主仍运行。')
    else { s.host = '已退出'; s.trace.push('未恢复 panic 终止所在进程 → 扩展与宿主一同退出。') }
  } else if (config.failure === 'timeout') {
    s.extension = '扩展不响应'; s.call = '等待结果'
    s.trace.push('本例扩展无限阻塞且不响应取消；请求尚未返回。')
  } else if (config.failure === 'file') {
    const denied = method === 'rpc' && config.restricted
    s.file = denied ? '操作系统拒绝' : '读取成功'
    s.call = denied ? '返回权限错误' : '返回文件内容'
    s.trace.push(denied ? '另行配置并验证的 OS 文件权限策略拒绝此路径；并非 RPC 自带保护。' : '同一用户有读取权限 → 扩展直接读取用户文件；进程边界不会自动拒绝。')
  } else { s.call = '成功'; s.trace.push('扩展返回结果，宿主完成请求。') }
  if (phase < 5) return s
  if (s.host === '已退出') { s.trace.push('宿主已退出，不能继续回收；需外部重新启动宿主。'); return s }
  if (method === 'rpc') {
    if (config.failure === 'timeout') s.call = '超时失败'
    s.extension = '已回收'; s.loaded = false
    s.trace.push(config.failure === 'timeout' ? '到达宿主截止时间 → 标记调用超时 → 终止并回收不响应的子进程。' : '确认子进程退出并回收资源；失败请求不会自动变成成功。')
  } else if (config.failure === 'timeout') s.trace.push('宿主仍运行，但阻塞调用未结束；不能安全强杀某个 Go goroutine。')
  else s.trace.push(method === 'plugin' ? '调用结束，Go plugin 无法卸载，代码继续驻留宿主。' : '调用结束，静态扩展仍属于宿主二进制。')
  return s
}
export function transferFeedback(method: Method, restricted: boolean, protocol: boolean): string[] {
  const issues: string[] = []
  if (method !== 'rpc') issues.push('Windows + 独立发布 + 扩展崩溃后宿主继续服务，需要独立进程和调用失败处理。')
  if (!restricted) issues.push('独立进程仍可继承用户权限；还需由操作系统实际强制的文件权限限制。')
  if (!protocol) issues.push('独立发布需要协商兼容协议；不兼容时应拒绝业务调用。')
  return issues
}
