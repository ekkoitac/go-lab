import {test, expect, type Locator, type Page} from '@playwright/test';
test.use({actionTimeout: 10000});

async function fits(page: Page, root: Locator, context: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), context + ' page overflow').toBe(true);
  const overflow = await root.evaluate(el => {
    if (el.scrollWidth <= el.clientWidth + 1) return [];
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > r.right + 1).map(n => ({tag:n.tagName, cls:n.className, text:n.textContent?.slice(0,40), width:n.getBoundingClientRect().width}));
  });
  expect(overflow, context + ' panel overflow').toEqual([]);
  const clipped = await root.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
    const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
    return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, context + ' clipped SVG labels').toEqual([]);
}

const ids = process.env.CM_TEST_IDS?.split(',').map(Number) ?? [141, 142, 143, 144, 145, 146];
async function prepare(lab: Locator, id: number) {
  if (id === 141) {
    await lab.getByLabel('先预测：t=6，B 会返回什么？').selectOption('stale');
    await lab.getByLabel('理由：哪一层会命中或过期？').fill('B 的本地副本尚未过期，也没有收到失效。');
  }
  if (id === 142) {
    await lab.getByLabel('我的预测').selectOption('old');
    await lab.getByLabel('预测理由').fill('读者在提交前拿到旧版本，提交后才回填。');
  }
  if (id === 144) {
    await lab.getByLabel('预测回源次数').fill('40');
    await lab.getByLabel('我的依据').fill('20 个实例各有独立 Group，两波各回源20次。');
  }
  if (id === 145) {
    await lab.getByLabel('先预测：故障后数据库会怎样？').selectOption('overload');
    await lab.getByLabel('写下依据：流量去了哪条路径？').fill('全部10万QPS回源，超过3000的容量。');
  }
  if (id === 146) {
    await lab.getByLabel('先预测：重投完成后共有多少分？').selectOption('20');
    await lab.getByLabel('理由：崩溃或重投后还保留什么？').fill('积分已提交但去重记录还没有，重投再次加分。');
  }
  if (id === 143) {
    await lab.getByRole('radio', {name: '至少一个时刻超过 4', exact: true}).check();
    await lab.getByLabel('我的依据').fill('12 个 key 同时过期，各自回源超过 4 个槽。');
  }
}
async function observable(model: Locator) {
  const state = JSON.parse((await model.getAttribute('data-state'))!);
  delete state.prediction; delete state.reason; delete state.submitted;
  return state;
}
for (const width of [1440, 390]) test('141–146 observations and independent help at ' + width + 'px', async ({page}) => {
  test.setTimeout(240000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], attempts: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url()); });
  for (const id of ids) {
    await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
    await page.getByRole('button', {name: '动手观察', exact: true}).click();
    const lab = page.locator('.learning-column').getByTestId('cache-message-lab-' + id);
    await expect(lab).toBeVisible();
    const model = lab.getByTestId('live-model').first();
    await expect(model).toBeVisible();
    await fits(page, lab, id + ' observation');
    const initial = await model.getAttribute('data-state');
    expect(initial).toBeTruthy();
    {
      await prepare(lab, id);
      const before = await observable(model);
      const step = lab.locator('[data-cm-action=step]').first();
      await expect(step).toBeEnabled();
      await step.focus(); await page.keyboard.press('Enter');
      const advanced = await observable(model);
      expect(advanced).not.toEqual(before);
      await lab.locator('[data-cm-action=back]').first().click();
      expect(await observable(model)).toEqual(before);
      if (id !== 143 && id !== 144) await prepare(lab, id);
      await step.click();
      expect(await observable(model)).toEqual(advanced);
      await lab.locator('[data-cm-action=reset]').first().click();
      await expect(model).toHaveAttribute('data-state', initial!);
    }
    const draft = page.locator('.decision-notebook textarea');
    const editor = page.locator('.workbench-column .cm-content').first();
    const originalDraft = await draft.count() ? await draft.inputValue() : null;
    const originalCode = await editor.count() ? await editor.innerText() : null;
    const texts: string[] = [];
    for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      await expect(page.locator('.help-panel').getByRole('button', {name, exact: true})).toHaveClass(/selected/);
      const help = page.getByTestId('cache-message-help-' + id);
      await expect(help).toBeVisible();
      await fits(page, help, id + ' ' + name);
      texts.push(await help.innerText());
      if (originalDraft !== null) await expect(draft).toHaveValue(originalDraft);
      if (originalCode !== null) expect(await editor.innerText()).toBe(originalCode);
      await expect(model).toHaveAttribute('data-state', initial!);
      if (name === '画图') await help.screenshot({path: '.runtime/cache-message-labs/help-' + id + '-' + width + '.png', animations: 'disabled', timeout: 10000});
    }
    expect(new Set(texts).size, id + ' distinct help modes').toBe(4);
    await page.getByRole('button', {name: '收起帮助', exact: true}).click();
    await lab.screenshot({path: '.runtime/cache-message-labs/lab-' + id + '-' + width + '.png', animations: 'disabled', timeout: 10000});
  }
  expect(errors).toEqual([]);
  expect(attempts).toEqual([]);
});

async function openLab(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name:'动手观察', exact:true}).click();
  const lab=page.getByTestId('cache-message-lab-'+id); await expect(lab).toBeVisible(); return lab;
}
async function state(lab: Locator) { return JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!); }
async function tick(lab: Locator, count: number) { for(let i=0;i<count;i++) await lab.locator('[data-cm-action=step]').first().click(); }
async function helpMode(page: Page,id: number,name: string) {
  const button=page.locator('.help-panel').getByRole('button',{name,exact:true});await button.click();await expect(button).toHaveClass(/selected/);
  const help=page.getByTestId('cache-message-help-'+id);await expect(help).toBeVisible();return help;
}
if(ids.includes(141)) test('141 local stale reads, shared invalidation failure and short-L1 counterexample',async({page})=>{
 const lab=await openLab(page,141);await prepare(lab,141);await tick(lab,5);expect(await state(lab)).toMatchObject({database:120,result:'stale',lastRead:{price:100}});await tick(lab,1);expect((await state(lab)).checkout).toBe(120);
 await lab.locator('[data-cm-action=reset]').click();await lab.getByLabel('缓存架构').selectOption('shared');await lab.getByLabel('共享失效成功').uncheck();await prepare(lab,141);await tick(lab,5);expect((await state(lab)).result).toBe('stale');
 const h=await helpMode(page,141,'让我试试');await h.getByLabel('共享失效成功').uncheck();await h.getByLabel('t=6，B 返回').selectOption('stale');await h.getByLabel('解释原因').fill('短L1仍从旧L2回填。');await h.getByRole('button',{name:'验证反例',exact:true}).click();await expect(h.getByRole('status')).toContainText('实际 100 元');
});
if(ids.includes(142)) test('142 stale fill crosses double delete; version floor survives an empty cache',async({page})=>{
 const lab=await openLab(page,142);await lab.getByLabel('并发场景').selectOption('double-delete');await prepare(lab,142);await tick(lab,5);expect(await state(lab)).toMatchObject({db:2,cache:1});
 await lab.getByLabel('并发场景').selectOption('late-fill');await lab.getByLabel('回填校验').selectOption('present');await prepare(lab,142);await tick(lab,4);expect((await state(lab)).cache).toBe(1);
 await lab.getByLabel('回填校验').selectOption('floor');await prepare(lab,142);await tick(lab,4);expect(await state(lab)).toMatchObject({db:2,cache:null,floor:2,rejected:1});
 const h=await helpMode(page,142,'让我试试');await h.getByLabel('回填校验').selectOption('floor');await h.getByLabel('预测缓存最终状态').selectOption('empty');await h.getByLabel('为什么该校验有足够的信息？').fill('失效门槛保留v8，空缓存也能拒绝v7。');await h.getByRole('button',{name:'验证方案与预测',exact:true}).click();await expect(h.getByRole('status')).toContainText('目标达成');
});
if(ids.includes(143)) test('143 jitter does not split one hot key, merging changes actual source work',async({page})=>{
 const lab=await openLab(page,143);await lab.getByLabel('流量形状').selectOption('hot');await lab.getByLabel('按 key 抖动 TTL').check();await prepare(lab,143);let peak=0;for(let i=0;i<7;i++){await tick(lab,1);peak=Math.max(peak,(await state(lab)).current.admitted);}expect(peak).toBe(12);
 await lab.getByLabel('同 key 请求合并').check();await prepare(lab,143);peak=0;for(let i=0;i<7;i++){await tick(lab,1);peak=Math.max(peak,(await state(lab)).current.admitted);}expect(peak).toBe(1);
 const h=await helpMode(page,143,'让我试试');await h.getByLabel('同 key 请求合并').check();await h.getByLabel('我的修复依据').fill('同一热key共用一次查询，11个调用等待。');await h.getByRole('button',{name:'验证修复',exact:true}).click();await expect(h).toContainText('本组输入满足两个目标');
});
if(ids.includes(144)) test('144 singleflight is per group and active wave; fencing rejects stale writers',async({page})=>{
 const lab=await openLab(page,144);await prepare(lab,144);await tick(lab,1);expect(await state(lab)).toMatchObject({origin:20,waiting:40});await tick(lab,3);expect(await state(lab)).toMatchObject({origin:40,returned:120});
 const h=await helpMode(page,144,'拆步骤');await tick(h,3);await expect(h).toContainText('A 的旧值');await h.getByLabel('写入端校验 fencing 令牌').check();await expect(h).toContainText('B 的新值');const v=await state(h);expect(v.lease.queries).toBe(2);expect(v.lease.rejected).toBe(true);
});
if(ids.includes(145)) test('145 outage admission conserves requests and authority reads cannot use stale fallback',async({page})=>{
 const lab=await openLab(page,145);await prepare(lab,145);await tick(lab,1);expect(await state(lab)).toMatchObject({online:100000,overloaded:true});await lab.locator('[data-cm-action=reset]').click();await lab.getByLabel('回源策略').selectOption('bounded');await prepare(lab,145);await tick(lab,1);expect(await state(lab)).toMatchObject({online:2500,stale:78000,rejected:19500,overloaded:false});await tick(lab,3);expect((await state(lab)).filled).toBeGreaterThan(0);expect((await state(lab)).dbTotal).toBeLessThanOrEqual(2500);
 const h=await helpMode(page,145,'让我试试');await h.getByLabel('权限业务的回源预算').selectOption('2500');await h.getByLabel('预测入口快速拒绝 QPS').fill('97500');await h.getByLabel('解释为什么不返回旧权限').fill('已撤销权限不能因为缓存故障重新获得授权。');await h.getByRole('button',{name:'检验容量与业务约束',exact:true}).click();await expect(h.getByRole('status')).toContainText('目标达成');
});
if(ids.includes(146)) test('146 atomic inbox prevents crash duplicates but retention and identity still matter',async({page})=>{
 const lab=await openLab(page,146);await prepare(lab,146);await tick(lab,7);expect((await state(lab)).points).toBe(20);
 for(const [scheme,incident,key,want] of [['mark-first','crash','event',0],['transaction','crash','event',10],['memory','restart','event',20],['transaction','expiry','event',20],['transaction','none','delivery',20]] as const){
  await lab.locator('[data-cm-action=reset]').click();await lab.getByLabel('去重方案').selectOption(scheme);await lab.getByLabel('重投前发生什么').selectOption(incident);await lab.getByLabel('用什么作为去重键').selectOption(key);await prepare(lab,146);await tick(lab,7);expect((await state(lab)).points).toBe(want);
 }
});
