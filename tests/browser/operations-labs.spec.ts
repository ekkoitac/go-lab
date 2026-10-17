import {test, expect, type Locator, type Page} from '@playwright/test';

test.use({actionTimeout: 10000});
const ids = process.env.OPS_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 161 + i);

async function fits(page: Page, root: Locator, context: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), context + ': page overflow').toBe(true);
  const overflow = await root.evaluate(el => {
    if (el.scrollWidth <= el.clientWidth + 1) return [];
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > r.right + 1).map(n => ({tag: n.tagName, text: n.textContent?.slice(0, 60)}));
  });
  expect(overflow, context + ': panel overflow').toEqual([]);
  const clipped = await root.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
    const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
    return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, context + ': SVG labels').toEqual([]);
}

async function completePrediction(root: Locator) {
  for (const select of await root.locator('select').all()) {
    if (!await select.isEnabled() || await select.inputValue()) continue;
    const value = await select.locator('option').evaluateAll(options => options.map(o => o as HTMLOptionElement).find(o => !o.disabled && o.value)?.value);
    if (value) await select.selectOption(value);
  }
  for (const field of await root.locator('textarea,input[type=text],input:not([type])').all()) {
    if (await field.isEnabled() && !await field.inputValue()) await field.fill('根据当前条件比较资源、等待与处理过程，再用结果检查预测。');
  }
  const groups = new Set<string>();
  for (const radio of await root.locator('input[type=radio]').all()) {
    const name = await radio.getAttribute('name') ?? '';
    if (!groups.has(name) && await radio.isEnabled()) { await radio.check(); groups.add(name); }
  }
}

for (const id of ids) for (const width of [1440, 390, 320]) test(`${id} observation and four help modes at ${width}px`, async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], attempts: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url());});
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-' + id);
  await expect(lab).toBeVisible();
  const model = lab.getByTestId('live-model').first();
  await expect(model).toBeVisible();
  await completePrediction(lab);
  const initial = await model.getAttribute('data-state');
  const step = lab.locator('[data-ops-action=step]').first();
  await expect(step).toBeEnabled();
  await step.click();
  await expect(model).not.toHaveAttribute('data-state', initial!);
  await fits(page, lab, `${id} observed ${width}`);
  await lab.locator('[data-ops-action=back]').first().click();
  await expect(model).toHaveAttribute('data-state', initial!);
  await completePrediction(lab);
  await step.click();
  await lab.locator('[data-ops-action=reset]').first().click();
  const reset = await model.getAttribute('data-state');
  const editor = page.locator('.cm-content').first();
  const originalCode = await editor.count() ? await editor.innerText() : null;
  const draft = page.locator('.decision-notebook textarea').first();
  const originalDraft = await draft.count() ? await draft.inputValue() : null;
  const texts: string[] = [];
  for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
    const button = page.locator('.help-panel').getByRole('button', {name, exact: true});
    await button.click();
    await expect(button).toHaveClass(/selected/);
    const help = page.getByTestId('operations-help-' + id);
    await expect(help).toBeVisible();
    await fits(page, help, `${id} ${name} ${width}`);
    texts.push(await help.innerText());
    if (originalCode !== null) expect(await editor.innerText()).toBe(originalCode);
    if (originalDraft !== null) await expect(draft).toHaveValue(originalDraft);
    await expect(model).toHaveAttribute('data-state', reset!);
    if (name === '画图' && width !== 390) await help.screenshot({path: `.runtime/operations-labs/help-${id}-${width}.png`, animations: 'disabled'});
  }
  expect(new Set(texts).size, 'four distinct teaching modes').toBe(4);
  await page.getByRole('button', {name: '收起帮助', exact: true}).click();
  if (width !== 390) await lab.screenshot({path: `.runtime/operations-labs/lab-${id}-${width}.png`, animations: 'disabled'});
  expect(errors).toEqual([]);
  expect(attempts).toEqual([]);
});
if (ids.includes(161)) test('161 same-load interventions and help isolation', async ({page}) => {
  await page.goto('/#lesson/161');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-161');
  const model = lab.getByTestId('live-model');
  await lab.getByLabel('你的因果理由').fill('编码只占20毫秒，改进四分之一只能节省5毫秒。');
  for (let i = 0; i < 3; i++) await lab.locator('[data-ops-action=step]').click();
  await expect(lab).toContainText('800 → 795 ms');
  const baseline = await model.getAttribute('data-state');
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-practice-161');
  await h.getByLabel('你的因果理由').fill('下游无余量，扩大连接池不能消除等待。');
  for (let i = 0; i < 3; i++) await h.locator('[data-ops-action=step]').click();
  await expect(h).toContainText('800 → 800 ms');
  await h.locator('[data-ops-action=reset]').click();
  await h.getByLabel('下游有余量，连接等待修复具备前提').check();
  await h.getByLabel('预测：本轮是否至少节省 200ms？').selectOption('large');
  await h.getByLabel('你的因果理由').fill('下游有容量后才能验证连接治理的收益。');
  for (let i = 0; i < 3; i++) await h.locator('[data-ops-action=step]').click();
  await expect(h).toContainText('800 → 275 ms');
  await expect(model).toHaveAttribute('data-state', baseline!);
});

if (ids.includes(162)) test('162 nearest-rank and unequal-instance aggregation', async ({page}) => {
  await page.goto('/#lesson/162');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-162');
  await lab.getByLabel('全站 P99 是否超过 40ms？').selectOption('over');
  await lab.getByLabel('预测理由', {exact: true}).fill('98个快请求之外，第99个已进入慢样本。');
  for (let i = 0; i < 4; i++) await lab.locator('[data-ops-action=step]').click();
  const model = lab.getByTestId('live-model');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({step: 4, p99: 1010, rank: 99});
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-162');
  await h.getByLabel('预测仪表盘是否正确').selectOption('no');
  await h.getByLabel('修复理由').fill('不能平均两个实例的分位数，应先合并样本或桶。');
  await h.getByRole('button', {name: '运行并核对仪表盘'}).click();
  await expect(h).toContainText('1010');
  await h.getByLabel('仪表盘计算规则').selectOption('merge');
  await h.getByLabel('预测仪表盘是否正确').selectOption('yes');
  await h.getByLabel('修复理由').fill('先合并计数，再按全站样本量确定排名。');
  await h.getByRole('button', {name: '运行并核对仪表盘'}).click();
  await expect(model).toHaveAttribute('data-state', /"p99":1010/);
});

if (ids.includes(163)) test('163 collection, resident pages and native-memory diagnosis', async ({page}) => {
  await page.goto('/#lesson/163');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-163');
  await lab.getByRole('combobox', {name: '我的预测', exact: true}).selectOption('plateau');
  await lab.getByLabel('预测理由', {exact: true}).fill('临时对象可回收，但驻留空闲页仍留在进程。');
  for (let i = 0; i < 6; i++) await lab.locator('[data-ops-action=step]').click();
  const model = lab.getByTestId('live-model');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({round: 3, live: 200, rss: 900, allocated: 900});
  await lab.getByRole('button', {name: '模拟归还空闲页'}).click();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({live: 200, idle: 0, rss: 300});
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-163');
  await expect(h.getByTestId('live-model')).toHaveCount(0);
  await h.getByLabel('下一步取证').selectOption('native');
  await h.getByLabel('诊断依据').fill('live heap和栈不涨，需查Go堆之外的来源。');
  await h.getByRole('button', {name: '提交判断并取证'}).click();
  expect(JSON.parse((await h.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({live: 200, native: 160, rss: 1020});
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({rss: 300});
});

if (ids.includes(164)) test('164 runtime soft goal and hard memory budget are separate', async ({page}) => {
  await page.goto('/#lesson/164');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-164');
  const model = lab.getByTestId('live-model');
  async function run() {
    await lab.getByLabel('预测理由', {exact: true}).fill('软目标只包含Go运行时部分，容器还要计入外部和突发。');
    for (let i = 0; i < 3; i++) await lab.locator('[data-ops-action=step]').click();
  }
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({runtime: 1024, peak: 1304, outcome: 'hard-risk'});
  await lab.locator('[data-ops-action=reset]').click();
  await lab.getByRole('button', {name: '采用扣余量后的预算'}).click();
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({runtime: 744, peak: 1024, headroom: 0});
  await expect(lab).toContainText('刚好碰线');
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-practice-164');
  await h.getByLabel('预测理由', {exact: true}).fill('活跃堆加运行时开销已超过软目标，GC无法回收活对象。');
  for (let i = 0; i < 3; i++) await h.locator('[data-ops-action=step]').click();
  expect(JSON.parse((await h.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({runtime: 600, softExceeded: true, peak: 800});
});

if (ids.includes(165)) test('165 roots and memory budget constrain GOGC benefits', async ({page}) => {
  await page.goto('/#lesson/165');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-165');
  await lab.getByLabel('GOGC', {exact: true}).fill('200');
  await lab.getByRole('radio', {name: '降低', exact: true}).check();
  await lab.getByLabel('预测理由', {exact: true}).fill('同分配率下增长空间翻倍，周期频率与扫描工作减半。');
  await lab.locator('[data-ops-action=step]').click();
  expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({target: 640, growth: 440, cyclesPerSecond: .5, scanWork: 110});
  await lab.getByLabel('软内存预算 MiB', {exact: true}).fill('200');
  await lab.getByRole('radio', {name: '模型无稳态解', exact: true}).check();
  await lab.getByLabel('预测理由', {exact: true}).fill('不可回收的部分已经超过预算，没有增长空间。');
  await lab.locator('[data-ops-action=step]').click();
  expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({infeasible: true, scanWork: null});
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-165');
  await h.getByLabel('分配率 MiB/s', {exact: true}).fill('110');
  await h.getByLabel('修复预测与理由').fill('增长空间被预算限制，降低分配率才能减少扫描工作。');
  await h.getByRole('button', {name: '验证修复方案'}).click();
  await expect(h).toContainText('模型两项约束均满足');
});

if (ids.includes(166)) test('166 quota conservation and explicit override lifecycle', async ({page}) => {
  await page.goto('/#lesson/166');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-166');
  const model = lab.getByTestId('live-model');
  async function run(prediction: string) {
    await lab.getByLabel('预测：本周期结束前会节流吗？').selectOption(prediction);
    await lab.getByLabel('你的因果理由').fill('配额是200 CPU-ms，较高并行度更快消耗同一额度。');
    for (let i = 0; i < 10; i++) await lab.locator('[data-ops-action=step]').click();
  }
  await run('yes');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({time: 100, consumed: 200, throttled: 96.875});
  await lab.locator('[data-ops-action=reset]').click();
  await lab.getByLabel('并行度策略').selectOption('auto');
  await run('no');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({consumed: 200, throttled: 0});
  await page.locator('.help-panel').getByRole('button', {name: '拆步骤', exact: true}).click();
  const h = page.getByTestId('operations-help-166');
  await h.getByRole('button', {name: '显式设置 GOMAXPROCS=64', exact: true}).click();
  await h.getByRole('button', {name: '修改 limit：2 → 4', exact: true}).click();
  await h.getByRole('button', {name: '模拟下一次运行时检查', exact: true}).click();
  expect(JSON.parse((await h.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({actual: 64});
  await h.getByRole('button', {name: '调用 SetDefaultGOMAXPROCS', exact: true}).click();
  expect(JSON.parse((await h.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({actual: 4});
});

if (ids.includes(167)) test('167 Reset, discarded pool entries and stale alias effects', async ({page}) => {
  await page.goto('/#lesson/167');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-167');
  const model = lab.getByTestId('live-model');
  async function run() {
    await lab.getByLabel('预测输出', {exact: true}).selectOption('clean');
    await lab.getByLabel('预测理由', {exact: true}).fill('复用对象要初始化，归还后旧引用不能继续使用。');
    for (let i = 0; i < 8; i++) await lab.locator('[data-ops-action=step]').click();
  }
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({output: 'tenantB', allocations: 1, hazard: false});
  await lab.getByLabel('B 使用前执行 Reset', {exact: true}).uncheck();
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({output: 'tenantA-SECRETtenantB'});
  await lab.getByLabel('归还后注入池项丢弃', {exact: true}).check();
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({output: 'tenantB', allocations: 2});
  await lab.getByLabel('归还后注入池项丢弃', {exact: true}).uncheck();
  await lab.getByLabel('B 使用前执行 Reset', {exact: true}).check();
  await lab.getByLabel('A 保留旧别名并追加 !', {exact: true}).check();
  await run();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({output: 'tenantB!', hazard: true});
});

if (ids.includes(168)) test('168 backpressure, bounded total and repair of accumulating output', async ({page}) => {
  await page.goto('/#lesson/168');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-168');
  const model = lab.getByTestId('live-model');
  async function tick() {
    await lab.getByLabel('预测理由', {exact: true}).fill('当前块写完前不能读取下一块，输出去向决定是否积累。');
    await lab.locator('[data-ops-action=step]').click();
  }
  await tick();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({read: 128, pending: 128, written: 0, peak: 128});
  await tick();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({read: 128, pending: 64, written: 64});
  await lab.getByRole('button', {name: '取消并关闭上游'}).click();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({status: 'cancelled', written: 64});
  await lab.getByLabel('总量上限', {exact: true}).selectOption('256');
  for (let i = 0; i < 7; i++) await tick();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({status: 'limited', written: 256});
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-168');
  await h.getByLabel('修复写入目标').selectOption('direct');
  await h.getByLabel('修复预测与理由').fill('直接向外写，避免内存Writer保留全量输入。');
  await h.getByRole('button', {name: '验证修复', exact: true}).click();
  await expect(h).toContainText('修复满足目标：完整写出');
});

if (ids.includes(169)) test('169 finite-window statistics and overload admission conserve requests', async ({page}) => {
  await page.goto('/#lesson/169');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-169');
  const model = lab.getByTestId('live-model');
  async function run(trend: string) {
    await lab.getByLabel('长期趋势').selectOption(trend);
    await lab.getByLabel('预测理由', {exact: true}).fill('比较到达需求和处理容量，平均在途不能直接当峰值容量。');
    for (let i = 0; i < 10; i++) await lab.getByRole('button', {name: '推进 100ms', exact: true}).click();
  }
  await run('clear');
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({arrivals: 1000, completed: 950, averageL: 48.5, throughput: 950, completedW: 50});
  await lab.getByLabel('服务槽容量', {exact: true}).fill('20');
  await run('grow');
  let s = JSON.parse((await model.getAttribute('data-state'))!);
  expect(s.queue.length).toBeGreaterThan(0);
  expect(s.arrivals).toBe(s.completed + s.rejected + s.active.length + s.queue.length);
  await lab.getByLabel('满载准入策略').selectOption('reject');
  await run('reject');
  s = JSON.parse((await model.getAttribute('data-state'))!);
  expect(s.queue).toHaveLength(0); expect(s.rejected).toBeGreaterThan(0);
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-169');
  await h.getByLabel('候选平均停留').fill('100');
  await h.getByLabel('反推理由').fill('80除以800等于0.1秒，也就是100毫秒。');
  await h.getByRole('button', {name: '验证候选'}).click();
  await expect(h).toContainText('达到均值目标');
});

if (ids.includes(170)) test('170 local savings cannot bypass end-to-end release gates', async ({page}) => {
  await page.goto('/#lesson/170');
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.getByTestId('operations-lab-170');
  const model = lab.getByTestId('live-model');
  await lab.getByLabel('预测理由', {exact: true}).fill('总耗时只减去5%乘30%，还要检查尾延迟和内存。');
  for (let i = 0; i < 4; i++) await lab.locator('[data-ops-action=step]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!)).toMatchObject({reviewed: true, saved: 1.5, memory: 576, p99: 133.5, verdict: '暂停发布，修复或回退'});
  await page.locator('.help-panel').getByRole('button', {name: '让我试试', exact: true}).click();
  const h = page.getByTestId('operations-help-170');
  await h.getByLabel('修复对照条件').selectOption('same');
  await h.getByLabel('修复保留内存').selectOption('128');
  await h.getByLabel('修复尾延迟').selectOption('10');
  await h.getByLabel('修复预测与理由').fill('控制混淆变量并降低副作用，才能同时检查所有门槛。');
  await h.getByRole('button', {name: '重跑三组并验收修复'}).click();
  expect(JSON.parse((await h.getByTestId('live-model').getAttribute('data-state'))!)).toMatchObject({saved: 1.5, memory: 384, p99: 108.5, verdict: '教学门槛通过，进入真实验证'});
  expect(JSON.parse((await model.getAttribute('data-state'))!).verdict).toContain('暂停发布');
});
