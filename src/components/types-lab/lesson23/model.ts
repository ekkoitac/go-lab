export type Origin = 'outer' | 'billing' | 'shipping';
export type Outcome = Origin | 'ambiguous' | 'missing';
export type Config = { billing: boolean; shipping: 'direct' | 'nested' | 'off'; outer: boolean; selector: string };
export type Branch = { name: string; origin?: Origin; value?: string; children: Branch[] };
export type Candidate = { path: string; depth: number; origin: Origin; value: string };
export type Resolution = { outcome: Outcome; candidates: Candidate[]; selected?: Candidate; explanation: string };
export const initial: Config = { billing: true, shipping: 'direct', outer: false, selector: 'o.City' };
export function buildTree(config: Config, cities = { outer: '北京', billing: '上海', shipping: '杭州' }): Branch {
  const city = (origin: Origin): Branch => ({ name: 'City', origin, value: cities[origin], children: [] });
  const shipping: Branch = { name: 'Shipping', children: [city('shipping')] };
  return { name: 'o', children: [
    ...(config.outer ? [city('outer')] : []),
    ...(config.billing ? [{ name: 'Billing', children: [city('billing')] }] : []),
    ...(config.shipping === 'direct' ? [shipping] : config.shipping === 'nested' ? [{ name: 'Envelope', children: [shipping] }] : []),
  ] };
}
export function allCandidates(tree: Branch, prefix = tree.name, depth = 0): Candidate[] {
  return tree.children.flatMap(child => child.origin
    ? [{ path: `${prefix}.City`, depth, origin: child.origin, value: child.value! }]
    : allCandidates(child, `${prefix}.${child.name}`, depth + 1));
}
type FieldCandidate = { node: Branch; path: string; depth: number };
function findField(tree: Branch, name: string, prefix: string, depth = 0): FieldCandidate[] {
  return tree.children.flatMap(child => [
    ...(child.name === name ? [{ node: child, path: `${prefix}.${child.name}`, depth }] : []),
    ...(!child.origin ? findField(child, name, `${prefix}.${child.name}`, depth + 1) : []),
  ]);
}
export function resolve(tree: Branch, selector: string): Resolution {
  const pieces = selector.split('.');
  const missing = (explanation: string): Resolution => ({ outcome: 'missing', candidates: [], explanation });
  if (pieces[0] !== tree.name || pieces.at(-1) !== 'City') return missing('此模型只查询以 o 开头、以 City 结束的字段选择器。');
  let node = tree;
  let prefix = tree.name;
  for (const part of pieces.slice(1, -1)) {
    const fields = findField(node, part, prefix);
    const shallow = fields.filter(field => field.depth === Math.min(...fields.map(item => item.depth)));
    if (!shallow.length) return missing(`${prefix} 下没有可访问的 ${part} 字段；当前路径不存在。`);
    if (shallow.length > 1) return { outcome: 'ambiguous', candidates: [], explanation: `${prefix}.${part} 在最浅层存在多个同名字段。` };
    node = shallow[0].node;
    prefix = shallow[0].path;
  }
  const all = allCandidates(node, prefix);
  if (!all.length) return missing(`${prefix} 下没有 City 字段。`);
  const minDepth = Math.min(...all.map(candidate => candidate.depth));
  const candidates = all.filter(candidate => candidate.depth === minDepth);
  if (candidates.length > 1) return { outcome: 'ambiguous', candidates, explanation: `从 ${prefix} 出发，最浅深度 ${minDepth} 有 ${candidates.length} 条 City 路径：${candidates.map(c => c.path).join('、')}。同深度无法唯一选择，编译失败；声明先后不解决歧义。` };
  const selected = candidates[0];
  return { outcome: selected.origin, candidates, selected, explanation: `从 ${prefix} 出发，最浅深度 ${minDepth} 只有 ${selected.path}，读取 ${selected.value}。${all.length > 1 ? '更深的 City 被遮蔽，但内部字段仍存在，可用显式路径访问。' : '省略嵌入字段名只是选择器便利，字段仍存储在原结构中。'}` };
}
export function shippingPath(config: Config): string {
  return config.shipping === 'nested' ? 'o.Envelope.Shipping.City' : 'o.Shipping.City';
}
export function describe(result: Resolution): string {
  return result.outcome === 'ambiguous' ? '编译失败：选择器歧义' : result.outcome === 'missing' ? '编译失败：字段不存在' : `${result.selected!.path} → ${result.selected!.value}`;
}

