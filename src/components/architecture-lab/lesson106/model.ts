export type Layout = 'single' | 'multi' | 'repos';
export interface Config { layout: Layout; workspace: boolean; publish: boolean; upgrade: boolean }
export const initialConfig: Config = { layout: 'multi', workspace: true, publish: false, upgrade: false };
export const layoutNames: Record<Layout, string> = { single: '单 module · 多 cmd', multi: '同仓 · 多 module', repos: '多仓 · 多 module' };
export const phases = ['准备边界', '修改源码', '本地联调', '发布与更新', '干净环境构建'];
export function inspect(config: Config, rawPhase: number) {
  const phase = Math.max(0, Math.min(4, Math.trunc(Number.isFinite(rawPhase) ? rawPhase : 0)));
  const split = config.layout !== 'single';
  const published = split && phase >= 3 && config.publish;
  const required = split && phase >= 3 && config.upgrade ? 'v1.1.0' : 'v1.0.0';
  const cleanBuilds = !split || (published && required === 'v1.1.0');
  const localBuilds = !split || config.workspace;
  return {
    phase, modules: split ? 4 : 1, repositories: config.layout === 'repos' ? 4 : 1, commands: 3,
    source: phase >= 1 ? 'NewRule()' : 'OldRule()',
    required: split ? required : '同 module 源码',
    published: split ? (published ? 'v1.1.0' : 'v1.0.0') : '随产品交付',
    localSource: !split ? '当前 module 源码' : config.workspace ? 'go.work 中的本地 domain' : 'require 的 domain v1.0.0',
    local: phase >= 2 ? localBuilds : null,
    clean: phase >= 4 ? cleanBuilds : null,
    reason: !split ? '三个命令编译同一 module 中的 domain，新函数随产品源码一起验证。' : !config.upgrade ? '消费方仍 require v1.0.0；该版本没有 NewRule，干净构建失败。' : !config.publish ? '消费方 require v1.1.0，但这个版本尚未发布；干净构建无法取得它。' : 'domain v1.1.0 已发布，三个消费方也已更新 require；干净构建取得含 NewRule 的版本。',
  };
}
export function assessTransfer(choice: string) {
  if (choice === 'module') return '符合约束：SDK 单独 module，具有自己的版本与兼容承诺；同仓仍可维护。服务命令继续使用原 module，发布时按真实版本单独验证。';
  if (choice === 'repo') return '独立仓库也能发布 SDK，但题目没有源码权限隔离需求；它额外引入跨仓协调。先确定版本边界，仓库拆分需要自己的理由。';
  return '仅增加 cmd 不会建立 SDK 的独立模块版本。SDK 对外承诺不同发布节奏，需要独立 module，并验证消费者使用的已发布版本。';
}
