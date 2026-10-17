export type Proof = 'self' | 'trusted';
export interface Config { pinned: boolean; metadata: boolean; dirty: boolean; proof: Proof }
export interface BuildRecord { commit: string; dirty: boolean; go: string; dependencies: string; flags: string; environment: string }
export interface Artifact { id: 'artifact-A' | 'artifact-B'; record: BuildRecord | null; proof: Proof }
export interface State { config: Config; step: number; artifacts: Artifact[]; latest: Artifact['id'] | null; deployment: { actual: Artifact['id']; recorded: string } | null; candidates: string[]; note: string }
export const defaults: Config = { pinned: false, metadata: false, dirty: true, proof: 'self' };
export function initial(config: Config = defaults): State { return { config: { ...config }, step: 0, artifacts: [], latest: null, deployment: null, candidates: [], note: '先预测：latest 被另一份制品覆盖之后，部署记录能否定位原来的字节内容？' }; }
export function makeArtifact(id: Artifact['id'], config: Config): Artifact {
  return { id, proof: config.proof, record: config.metadata ? { commit: 'commit-a1', dirty: id === 'artifact-B' && config.dirty, go: 'Go 1.24.1', dependencies: id === 'artifact-A' ? '锁定清单 deps-A' : '锁定清单 deps-B', flags: '-trimpath; CGO_ENABLED=0', environment: 'linux/amd64; builder-image-7' } : null };
}
export function trace(s: State): { identity: boolean; source: boolean; trusted: boolean; reproducible: false; candidates: string[] } {
  const candidates = !s.deployment ? [] : s.config.pinned ? [s.deployment.actual] : s.artifacts.map(a => a.id);
  const artifact = s.artifacts.find(a => a.id === candidates[0]);
  const identity = candidates.length === 1 && !!s.deployment && s.config.pinned;
  return { identity, source: identity && !!artifact?.record, trusted: identity && artifact?.proof === 'trusted', reproducible: false, candidates };
}
export function advance(s: State): State {
  if (s.step >= 5) return s;
  if (s.step === 0) return { ...s, step: 1, artifacts: [makeArtifact('artifact-A', s.config)], latest: 'artifact-A', note: '构建 A：保存内容身份 artifact-A，latest 现在指向 A。下一步部署它。' };
  if (s.step === 1) return { ...s, step: 2, deployment: { actual: 'artifact-A', recorded: s.config.pinned ? 'artifact-A' : 'latest' }, note: s.config.pinned ? '部署记录绑定 A 的内容身份；以后 latest 的移动不会改写这条记录。' : '生产实际运行 A，但记录只保存 latest；名字没有保存它当时指向的内容。' };
  if (s.step === 2) return { ...s, step: 3, artifacts: [...s.artifacts, makeArtifact('artifact-B', s.config)], note: `构建 B：提交仍是 a1，但依赖改为 deps-B${s.config.dirty ? '，且含未提交修改' : ''}。输入变化产生不同内容身份；B 尚未部署。` };
  if (s.step === 3) return { ...s, step: 4, latest: 'artifact-B', note: '发布标签 latest：A → B。服务器仍运行 A，标签移动没有重新部署。下一步只凭保存的部署记录追踪。' };
  const result = trace(s);
  return { ...s, step: 5, candidates: result.candidates, note: !result.identity ? '记录只写 latest，候选 A / B 无法消歧。读取现在的 latest 会误指 B；需补采生产文件摘要并关联历史制品。' : !result.source ? '身份锁定 A，但没有保存构建输入，仍无法追到完整来源。修复：在 CI 保存摘要绑定的构建记录。' : `已沿部署记录定位 A 和构建输入。${result.trusted ? '本模型假定签名验证和构建者信任策略通过。' : '记录由任意上传者自述，来源真实性尚未验证。'} 有记录仍不能证明逐字节复现。` };
}
export function nextLabel(step: number): string { return ['构建 A', '部署 A', '构建 B', '让 latest 指向 B', '调查生产来源', '调查结束'][step] ?? '调查结束'; }
