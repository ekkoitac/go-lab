import {test, expect, type Page, type Locator} from '@playwright/test';
const ids = process.env.DB_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 131 + i);
async function open(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId('database-lab-' + id);
  await expect(lab).toBeVisible();
  return lab;
}
async function prepareStep(lab: Locator, id: number) {
  if (id === 131) {
    await lab.getByLabel('下一步全部池上限 + 预留 = ?').fill('420');
    await lab.getByLabel('理由（包含副本数或计算式）').fill('12 个副本乘以每池 30，再加预留 60。');
  }
  if (id === 133) {
    await lab.getByLabel('最终可确认的结果').selectOption('rolledback');
    await lab.getByLabel('你的依据').fill('两笔写入属于同一个 Tx，入账失败可丢弃草稿。');
  }
  if (id === 134) {
    await lab.getByLabel('这个动作的结果').selectOption('locked');
    await lab.getByLabel('动作后已提交的在线人数').selectOption('2');
    await lab.getByLabel('我的理由').fill('申请锁尚未提交下线，在线人数仍是 2。');
  }
  if (id === 135) {
    await lab.getByLabel('单步后 broker 累计接收次数').fill('0');
    await lab.getByLabel('单步后累计业务效果次数').fill('0');
    await lab.getByLabel('你的理由').fill('订单和待发记录提交，尚未进行投递和消费。');
  }
  if (id === 137) {
    await lab.getByRole('radio',{name:'旧昵称 v8',exact:true}).check();
    await lab.getByLabel('我的理由').fill('主库提交后副本尚未应用位点 9。');
  }
  if (id === 138) {
    await lab.getByLabel('先预测本次动作结果').selectOption('ok');
    await lab.getByLabel('我的理由').fill('新增列保留旧列，旧实例仍能工作。');
  }  if (id === 136) await lab.getByLabel('为什么？').fill('锁定酒店不会撤回外部产生的短信和费用。');}
async function fits(page: Page, root: Locator, context: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), context + ' page overflow').toBe(true);
  expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth + 1), context + ' panel overflow').toBe(true);
  const clipped = await root.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
    const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
    return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, context + ' clipped SVG labels').toEqual([]);
}
for (const width of [1440, 390]) test(`database observations and four help modes at ${width}px`, async ({page}) => {
  test.setTimeout(240000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], attempts: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url()); });
  for (const id of ids) {
    const lab = await open(page, id), model = lab.getByTestId('live-model').first();
    await expect(model).toBeVisible();
    await fits(page, lab, `${id} observation`);
    const initial = await model.getAttribute('data-state');
    expect(initial).toBeTruthy();
    const step = lab.locator('[data-db-action=step]').first();
    await prepareStep(lab, id);
    await expect(step).toBeEnabled();
    await step.focus(); await page.keyboard.press('Enter');
    await expect(model).not.toHaveAttribute('data-state', initial!);
    const advanced = await model.getAttribute('data-state');
    await lab.locator('[data-db-action=back]').first().click();
    await expect(model).toHaveAttribute('data-state', initial!);
    await prepareStep(lab, id);
    await step.click(); await expect(model).toHaveAttribute('data-state', advanced!);
    await lab.locator('[data-db-action=reset]').first().click();
    await expect(model).toHaveAttribute('data-state', initial!);
    const before = await model.getAttribute('data-state');
    const draft = page.locator('.decision-notebook textarea');
    const editor = page.locator('.workbench-column .cm-content').first();
    const originalDraft = await draft.count() ? await draft.inputValue() : null;
    const originalCode = await editor.count() ? await editor.innerText() : null;
    const texts: string[] = [];
    for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      await expect(page.locator('.help-panel').getByRole('button', {name, exact: true})).toHaveClass(/selected/);
      const help = page.getByTestId('database-help-' + id);
      await expect(help).toBeVisible();
      await fits(page, help, `${id} ${name}`);
      texts.push(await help.innerText());
      if(originalDraft !== null) await expect(draft).toHaveValue(originalDraft);
      if(originalCode !== null) expect(await editor.innerText()).toBe(originalCode);
      await expect(help.getByTestId('database-lab-' + id)).toHaveCount(0);
      await expect(model).toHaveAttribute('data-state', before!);
      if (name === '画图') await help.screenshot({path: `.runtime/database-labs/help-${id}-${width}.png`, animations: 'disabled'});
    }
    expect(new Set(texts).size, `${id} help modes have distinct purposes`).toBe(4);
    await page.getByRole('button', {name: '收起帮助', exact: true}).click();
    await lab.screenshot({path: `.runtime/database-labs/lab-${id}-${width}.png`, animations: 'disabled'});
  }
  expect(errors).toEqual([]); expect(attempts).toEqual([]);
});
if (ids.includes(131)) test('131 surge changes the budget while shrinking pools increases modeled waiting', async ({page}) => {
  const lab = await open(page, 131);
  await lab.getByLabel('每池上限（正数）').fill('15');
  await prepareStep(lab, 131); await lab.locator('[data-db-action=step]').click();
  let state = JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.total).toBe(240); expect(state.over).toBe(0);
  await prepareStep(lab, 131); await lab.locator('[data-db-action=step]').click();
  state = JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.total).toBe(285); expect(state.over).toBe(45);
  await lab.getByLabel('每池上限（正数）').fill('12');
  for(let i=0;i<2;i++){await prepareStep(lab,131);await lab.locator('[data-db-action=step]').click();}
  state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.over).toBe(0); expect(state.localWaiting).toBe(120);
  await expect(lab).toContainText('未实测');
});
if (ids.includes(132)) test('132 atomic version check rejects stale data; relabeling a stale draft loses the first edit', async ({page}) => {
  const lab=await open(page,132),step=lab.locator('[data-db-action=step]');
  await step.click();await step.click();await expect(step).toBeDisabled();
  await lab.getByLabel('预测影响行数').selectOption('0');
  await lab.getByLabel('预测理由',{exact:true}).fill('数据库版本 8 与草稿版本 7 不匹配');
  await step.click();await expect(lab).toContainText('影响 0 行');
  await lab.getByLabel('冲突重试方式').selectOption('relabel');await step.click();
  await expect(lab).toContainText('旧字段覆盖');
  await lab.locator('[data-db-action=back]').click();
  await lab.getByLabel('冲突重试方式').selectOption('merge');await step.click();
  await expect(lab).toContainText('两人的修改都保留');
});
if (ids.includes(133)) test('133 failed credit preserves the invariant only with a common transaction',async({page})=>{
  const lab=await open(page,133);await prepareStep(lab,133);
  for(let i=0;i<4;i++)await lab.locator('[data-db-action=step]').click();
  const state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  const shared=state.states.find((s:{wiring:string})=>s.wiring==='shared');
  const split=state.states.find((s:{wiring:string})=>s.wiring==='split');
  const escape=state.states.find((s:{wiring:string})=>s.wiring==='escape');
  expect(shared.committed).toEqual({a:100,b:20});expect(shared.outcome).toBe('rolledback');
  expect(split.committed).toEqual({a:70,b:20});expect(escape.committed).toEqual({a:70,b:20});
});
if(ids.includes(134))test('134 waiting on the same lock refreshes only the next RC statement, not an RR snapshot',async({page})=>{
  const lab=await open(page,134);
  for(const strategy of ['rc','rr']){
    await lab.getByLabel('保护策略').selectOption(strategy);
    for(const actor of ['甲','乙','甲','甲','甲','乙','乙','乙','乙']){
      await lab.getByRole('radio',{name:new RegExp('^'+actor+'：')}).check();
      await prepareStep(lab,134);await lab.locator('[data-db-action=step]').click();
    }
    const state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
    expect(Number(state.rows.甲)+Number(state.rows.乙)).toBe(strategy==='rc'?1:0);
    expect(state.tx.乙.readCount).toBe(strategy==='rc'?1:2);
  }
});
if(ids.includes(135))test('135 recovery redelivers a sent-but-unmarked event, and idempotent consumption keeps one effect',async({page})=>{
  const lab=await open(page,135);
  const tick=async()=>{await prepareStep(lab,135);await lab.locator('[data-db-action=step]').click();};
  await tick();await tick();
  await lab.getByRole('button',{name:'此刻注入崩溃',exact:true}).click();
  await lab.getByRole('button',{name:'重启进程',exact:true}).click();
  for(let i=0;i<4;i++)await tick();
  let state=JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!);
  expect(state.deliveries).toBe(2);expect(state.effects).toBe(1);expect(state.skipped).toBe(1);
  await lab.getByLabel('发送方式').selectOption('direct');await tick();
  await lab.getByRole('button',{name:'此刻注入崩溃',exact:true}).click();
  await lab.getByRole('button',{name:'重启进程',exact:true}).click();
  state=JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!);
  expect(state.order).toBe(true);expect(state.event).toBe('absent');expect(state.deliveries).toBe(0);
  await expect(lab.locator('[data-db-action=step]')).toBeDisabled();
});
if(ids.includes(136))test('136 persisted compensation survives restart and unknown results require reconciliation',async({page})=>{
  const lab=await open(page,136);
  const tick=async()=>{await prepareStep(lab,136);await lab.locator('[data-db-action=step]').click();};
  await tick();await tick();await tick();
  await lab.getByRole('button',{name:'注入进程重启',exact:true}).click();
  await lab.getByLabel('下一次释放接口').selectOption('timeout-applied');await tick();
  let state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.hotel).toBe('released');expect(state.phase).toBe('unknown');expect(state.todo).toBe('unknown');
  await tick();state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.phase).toBe('cancelled');expect(state.sms).toBe(1);expect(state.fee).toBe(3);expect(state.releases).toBe(1);
});
if(ids.includes(137))test('137 fixed sleep fails on the tail, while a commit-position wait falls back or explicitly fails',async({page})=>{
  const lab=await open(page,137);
  const finish=async()=>{await prepareStep(lab,137);for(let i=0;i<3;i++)await lab.locator('[data-db-action=step]').click();return JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);};
  await lab.getByLabel('详情路由策略').selectOption('sleep');
  let state=await finish();expect(state.returned).toBe(8);
  await lab.getByLabel('详情路由策略').selectOption('wait-primary');
  state=await finish();expect(state.returned).toBe(9);expect(state.route).toBe('primary');expect(state.time).toBe(1100);
  await lab.getByLabel('详情路由策略').selectOption('wait-fail');
  state=await finish();expect(state.returned).toBeNull();expect(state.outcome).toBe('failed');
  await lab.getByLabel('请求承诺').selectOption('list');
  state=await finish();expect(state.returned).toBe(8);await expect(lab).toContainText('本次满足所选请求承诺');
});
if(ids.includes(138))test('138 migration protects new writes and keeps the old schema until rollback support ends',async({page})=>{
  const lab=await open(page,138);
  const act=async(action:string)=>{await lab.getByLabel('调度下一步').selectOption(action);await prepareStep(lab,138);await lab.locator('[data-db-action=step]').click();};
  for(const action of ['expand','compat','capture','newWrite','unsafeBackfill'])await act(action);
  let state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.newValue).not.toBe(state.latest);expect(state.effect).toBe('damage');
  await lab.locator('[data-db-action=back]').click();await act('backfill');
  state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.newValue).toBe('新名字');
  for(const action of ['validate','switchRead','retire','contract'])await act(action);
  state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.oldColumn).toBe(true);expect(state.effect).toBe('blocked');
  await act('closeWindow');await act('contract');
  state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.oldColumn).toBe(false);expect(state.newValue).toBe('新名字');
});
if(ids.includes(139))test('139 checkpoint-first crashes omit rows; atomic data and checkpoint survive recovery',async({page})=>{
  const lab=await open(page,139);
  const tick=async(n:number)=>{for(let i=0;i<n;i++)await lab.locator('[data-db-action=step]').click();};
  for(const policy of ['checkpoint-first','atomic']){
    await lab.getByRole('combobox',{name:/^提交边界/}).selectOption(policy);await tick(4);
    await lab.getByRole('button',{name:'此刻崩溃',exact:true}).click();
    await lab.getByRole('button',{name:'按断点恢复',exact:true}).click();
    for(let i=0;i<25&&await lab.locator('[data-db-action=step]').isEnabled();i++)await tick(1);
    const state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
    expect(state.lanes[1].checkpoint).toBe(8);
    expect(state.lanes[1].persisted).toEqual(policy==='atomic'?[1,2,3,4,5,6,7,8]:[4,5,6,7,8]);
  }
});
if(ids.includes(140))test('140 segment evidence distinguishes SQL tuning from connection lifecycle repair and pool budget',async({page})=>{
  const lab=await open(page,140);
  const collect=async()=>{for(let i=0;i<4;i++)await lab.locator('[data-db-action=step]').click();return JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);};
  let state=await collect();expect(state.traces[0]).toMatchObject({wait:850,sql:20,read:30,total:900});
  expect(state.window).toMatchObject({count:4,duration:3400,average:850});
  await lab.getByLabel('干预方案').selectOption('index');state=await collect();expect(state.traces[0].total).toBe(895);expect(state.traces[0].wait).toBe(850);
  await lab.getByLabel('干预方案').selectOption('close-rows');state=await collect();expect(state.traces[0].wait).toBe(0);expect(state.traces[0].total).toBe(50);
  await lab.getByLabel('干预方案').selectOption('none');await lab.getByLabel('池上限').selectOption('24');state=await collect();expect(state.budgetExceeded).toBe(true);expect(state.issueHolders).toBe(4);
  await expect(lab).toContainText('不能代表生产尾延迟');
});