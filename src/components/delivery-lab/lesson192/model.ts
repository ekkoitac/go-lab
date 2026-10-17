export type Options = {delta: number; concurrent: boolean; retry: boolean};
export type Lane = {value: number; version: number; reads: Partial<Record<'A'|'B', {value: number; version: number}>>; successes: number; conflicts: number; log: string[]};
export const defaults: Options = {delta: 10, concurrent: true, retry: false};
const fresh = (): Lane => ({value: 100, version: 1, reads: {}, successes: 0, conflicts: 0, log: []});
export function simulate(input: Options, requested: number) {
  const options = {...input, delta: Number.isFinite(input.delta) ? Math.max(1, Math.min(50, Math.round(input.delta))) : 10};
  const steps = options.concurrent ? ['readA','readB','writeA','writeB','retryB'] : ['readA','writeA','readB','writeB','retryB'];
  const cursor = Number.isFinite(requested) ? Math.max(0, Math.min(5, Math.floor(requested))) : 0;
  const fake = fresh(), reference = fresh();
  const events: string[] = [];
  for (const action of steps.slice(0, cursor)) {
    const actor = action.endsWith('A') ? 'A' : 'B';
    for (const [lane, guarded] of [[fake,false],[reference,true]] as const) {
      if (action.startsWith('read')) {
        lane.reads[actor] = {value: lane.value, version: lane.version};
        lane.log.push(`${actor} 读取 ${lane.value} / v${lane.version}`);
      } else if (action === 'retryB') {
        if (guarded && lane.conflicts > 0 && options.retry) {
          lane.reads.B = {value: lane.value, version: lane.version};
          lane.value += options.delta; lane.version++; lane.successes++;
          lane.log.push(`B 重新读取后重试成功 → ${lane.value} / v${lane.version}`);
        } else lane.log.push(guarded && lane.conflicts > 0 ? '冲突留给调用方处理；本轮未重试' : '无已报告冲突，无重试');
      } else {
        const read = lane.reads[actor]!;
        if (guarded && read.version !== lane.version) {
          lane.conflicts++;
          lane.log.push(`${actor} 期待 v${read.version}，实际 v${lane.version}：返回冲突，值不变`);
        } else {
          lane.value = read.value + options.delta; lane.version++; lane.successes++;
          lane.log.push(`${actor} 写入 ${lane.value}，报告成功 → v${lane.version}`);
        }
      }
    }
    events.push(action === 'retryB' ? '处理冲突' : `${actor} ${action.startsWith('read') ? '读取快照' : '提交修改'}`);
  }
  const lost = (lane: Lane) => lane.successes * options.delta - (lane.value - 100);
  return {options, cursor, fake, reference, fakeLost: lost(fake), referenceLost: lost(reference), event: events.at(-1) ?? '等待 A 读取', next: steps[cursor] ?? '本轮完成', done: cursor === 5};
}
export type SortRow = {id: string; rank: number|null};
export function sortContract(rows: SortRow[], corrected: boolean): SortRow[] {
  const result = rows.map(row => ({...row}));
  return corrected ? result.sort((a,b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.id.localeCompare(b.id)) : result;
}
export function coverage(shared: boolean, integration: boolean) {
  return {fake: shared ? ['正常读写','未找到错误','版本冲突契约'] : [], real: [...(shared ? ['正常读写','未找到错误','版本冲突契约'] : []), ...(integration ? ['真实隔离级别','驱动错误映射','取消与网络'] : [])]};
}
export function evaluateAssertions(kind: 'value'|'calls') {
  const run = simulate(defaults,4);
  const result = (lane: Lane, lost: number) => ({value:lane.value, successes:lane.successes, conflicts:lane.conflicts, attempts:lane.successes+lane.conflicts, passed:kind==='calls' ? lane.successes+lane.conflicts===2 : lost===0 && lane.successes===1 && lane.conflicts===1});
  return {fake:result(run.fake,run.fakeLost), reference:result(run.reference,run.referenceLost)};
}
