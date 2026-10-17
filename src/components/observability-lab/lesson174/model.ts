export type Strategy = 'raw' | 'path' | 'template';
export type RequestRow = { url: string; status: string; tenant: string };
export type Config = { orders: number; tenants: number; statuses: number; tenantLabel: boolean; unknown: boolean };
export const defaultConfig: Config = { orders: 3, tenants: 2, statuses: 2, tenantLabel: false, unknown: true };
export const strategies: Strategy[] = ['raw', 'path', 'template'];
export const names: Record<Strategy, string> = { raw: '原始 URL', path: '仅去 query', template: '路由模板' };
export function routeLabel(url: string, strategy: Strategy): string {
  if (strategy === 'raw') return url;
  const path = url.split(/[?#]/)[0];
  if (strategy === 'path') return path;
  // Deliberately finite teaching classifier; production must use router metadata.
  return /^\/orders\/[^/]+$/.test(path) ? '/orders/:id' : 'unmatched';
}
export function requests(config: Config): RequestRow[] {
  const rows: RequestRow[] = [];
  for (let i = 0; i < config.orders; i++) {
    for (let query = 1; query <= 2; query++) rows.push({ url: `/orders/${101 + i}?view=${query}`, status: `${2 + i % config.statuses}xx`, tenant: `t${1 + i % config.tenants}` });
  }
  if (config.unknown) for (let i = 1; i <= 2; i++) rows.push({ url: `/random/${i}`, status: '2xx', tenant: 't1' });
  return rows;
}
export function seriesKey(row: RequestRow, strategy: Strategy, tenantLabel: boolean): string {
  return JSON.stringify([routeLabel(row.url, strategy), row.status, ...(tenantLabel ? [row.tenant] : [])]);
}
export function summarize(rows: RequestRow[], strategy: Strategy, tenantLabel: boolean, domains: { statuses: number; tenants: number }) {
  const labels = [...new Set(rows.map(row => routeLabel(row.url, strategy)))];
  const series = [...new Set(rows.map(row => seriesKey(row, strategy, tenantLabel)))];
  const routeDomain = strategy === 'template' ? 2 : labels.length;
  return { labels, series, observed: series.length, upper: routeDomain * domains.statuses * (tenantLabel ? domains.tenants : 1), routeDomain, bounded: strategy === 'template' };
}
export function snapshot(config: Config, cursor: number) {
  const all = requests(config);
  const seen = all.slice(0, Math.max(0, Math.min(all.length, cursor)));
  return { cursor: seen.length, total: all.length, rows: seen, next: all[seen.length] ?? null, results: Object.fromEntries(strategies.map(strategy => [strategy, summarize(seen, strategy, config.tenantLabel, config)])) as Record<Strategy, ReturnType<typeof summarize>> };
}
export function addsSeries(config: Config, cursor: number, strategy: Strategy = 'template') {
  const before = snapshot(config, cursor);
  return before.next !== null && snapshot(config, cursor + 1).results[strategy].observed > before.results[strategy].observed;
}
export const transferRows: RequestRow[] = [
  { url: '/orders/801?x=1', status: '2xx', tenant: 'red' },
  { url: '/orders/802?x=2', status: '2xx', tenant: 'blue' },
  { url: '/orders/802?x=3', status: '5xx', tenant: 'blue' },
  { url: '/alien/a', status: '2xx', tenant: 'red' },
  { url: '/alien/b', status: '2xx', tenant: 'red' },
];
