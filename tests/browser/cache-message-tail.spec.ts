import {test, expect, type Locator, type Page} from '@playwright/test';

test.use({actionTimeout: 10000});
const ids = [147, 148, 149, 150];
async function state(root: Locator) {
  return JSON.parse((await root.getByTestId('live-model').first().getAttribute('data-state'))!);
}
function physical(value: Record<string, unknown>) {
  const result = {...value};
  for (const key of ['prediction', 'reason', 'submitted', 'answer']) delete result[key];
  return result;
}
async function prepare(root: Locator) {
  for (const select of await root.locator('select:enabled').all()) {
    if (await select.inputValue()) continue;
    const value = await select.locator('option').evaluateAll(options => (options as HTMLOptionElement[]).find(o => o.value && !o.disabled)?.value);
    if (value) await select.selectOption(value);
  }
  for (const input of await root.locator('textarea:enabled').all()) await input.fill('根据消息责任、持久状态和事件顺序预测；执行后核对实际变化。');
}
async function fits(page: Page, root: Locator, context: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), context + ' page overflow').toBe(true);
  const overflow = await root.evaluate(el => {
    if (el.scrollWidth <= el.clientWidth + 1) return [];
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('*')].filter(n => n.getBoundingClientRect().right > r.right + 1).map(n => ({tag:n.tagName, cls:n.className, text:n.textContent?.slice(0,40)}));
  });
  expect(overflow, context + ' panel overflow').toEqual([]);
  const clipped = await root.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
    const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
    return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, context + ' clipped SVG labels').toEqual([]);
}
async function openLab(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId('cache-message-lab-' + id);
  await expect(lab).toBeVisible();
  return lab;
}
for (const width of [1440, 390, 320]) for (const id of ids) test(`${id} reversible observation and four isolated help modes at ${width}px`, async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], attempts: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {if (r.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(r.url())) attempts.push(r.url());});
  const lab = await openLab(page,id);
  await fits(page,lab,`${id} observation`);
  const model = lab.getByTestId('live-model').first();
  const initial = await model.getAttribute('data-state');
  const before = physical(await state(lab));
  const step = lab.locator('[data-cm-action=step]').first();
  await expect(step).toBeDisabled();
  await prepare(lab);
  await expect(step).toBeEnabled();
  await step.focus(); await page.keyboard.press('Enter');
  const advanced = physical(await state(lab));
  expect(advanced).not.toEqual(before);
  await lab.locator('[data-cm-action=back]').first().click();
  expect(physical(await state(lab))).toEqual(before);
  await prepare(lab); await step.click();
  expect(physical(await state(lab))).toEqual(advanced);
  await lab.locator('[data-cm-action=reset]').first().click();
  await expect(model).toHaveAttribute('data-state',initial!);
  await prepare(lab); await step.click();
  const held = await model.getAttribute('data-state');
  const draft = page.locator('.decision-notebook textarea');
  const editor = page.locator('.workbench-column .cm-content').first();
  const originalDraft = await draft.count() ? await draft.inputValue() : null;
  const originalCode = await editor.count() ? await editor.innerText() : null;
  const texts: string[] = [];
  for (const mode of ['举例子','画图','拆步骤','让我试试']) {
    await page.locator('.help-panel').getByRole('button',{name:mode,exact:true}).click();
    const help = page.getByTestId('cache-message-help-'+id);
    await expect(help).toBeVisible();
    texts.push(await help.innerText());
    await fits(page,help,`${id} ${mode}`);
    await prepare(help);
    const action = help.getByRole('button').filter({visible:true});
    let changed = false;
    for (const button of await action.all()) {
      if (await button.isEnabled()) {await button.click();changed=true;break;}
    }
    if (!changed) {
      for (const input of await help.locator('input[type=checkbox]:enabled').all()) {await input.setChecked(!await input.isChecked());changed=true;break;}
    }
    if (!changed) {
      for (const select of await help.locator('select:enabled').all()) {
        const current = await select.inputValue();
        const options = await select.locator('option').evaluateAll(nodes => (nodes as HTMLOptionElement[]).filter(o=>o.value&&!o.disabled).map(o=>o.value));
        const alternate = options.find(v=>v!==current);
        if (alternate) {await select.selectOption(alternate);changed=true;break;}
      }
    }
    expect(changed,`${id} ${mode} must expose a usable interaction`).toBe(true);
    await fits(page,help,`${id} ${mode} after interaction`);
    await expect(model).toHaveAttribute('data-state',held!);
    if (originalDraft !== null) await expect(draft).toHaveValue(originalDraft);
    if (originalCode !== null) expect(await editor.innerText()).toBe(originalCode);
    if (mode === '画图' && width !== 320) await help.screenshot({path:`.runtime/lessons147-150/help-${id}-${width}.png`,animations:'disabled'});
  }
  expect(new Set(texts).size).toBe(4);
  await page.getByRole('button',{name:'收起帮助',exact:true}).click();
  if (width !== 320) await lab.screenshot({path:`.runtime/lessons147-150/lab-${id}-${width}.png`,animations:'disabled'});
  expect(errors).toEqual([]); expect(attempts).toEqual([]);
});

async function tick(lab:Locator,count:number) {for(let i=0;i<count;i++)await lab.locator('[data-cm-action=step]').first().click();}
async function physicalState(lab:Locator){return (await state(lab)).physical;}

test('147 commit and broker receipt have different failure windows',async({page})=>{
 const lab=await openLab(page,147);
 for(const [order,incident,idempotent,want] of [['early','dbfail',true,0],['after','dbfail',true,1],['after','acklost',false,2],['after','acklost',true,1],['after','crash',true,1]] as const){
  await lab.locator('[data-cm-action=reset]').click();
  await lab.getByRole('combobox',{name:'确认时机',exact:true}).selectOption(order);
  await lab.getByRole('combobox',{name:'故障条件',exact:true}).selectOption(incident);
  await lab.getByLabel('稳定事件 ID 幂等，与发券同事务提交',{exact:true}).setChecked(idempotent);
  await prepare(lab);await tick(lab,4);
  const before=await physicalState(lab);
  if(incident==='acklost')expect(before).toMatchObject({ackSent:1,ackReceived:0,unacked:true,coupons:1});
  await tick(lab,3);expect((await physicalState(lab)).coupons).toBe(want);
 }
});
test('148 classified retry frees capacity; repair changes replay outcome',async({page})=>{
 const lab=await openLab(page,148);await prepare(lab);await tick(lab,3);
 expect(await physicalState(lab)).toMatchObject({work:3,failures:3,completed:[]});
 await lab.locator('[data-cm-action=reset]').click();await lab.getByRole('combobox',{name:'失败处理策略',exact:true}).selectOption('classified');await prepare(lab);await tick(lab,3);
 let s=await physicalState(lab);expect(s.completed).toEqual(['order-A','order-B']);expect(s.dead).toHaveLength(1);
 await lab.getByRole('button',{name:'限速重放一条死信',exact:true}).click();await tick(lab,1);
 expect((await physicalState(lab)).dead).toHaveLength(1);
 await lab.getByRole('button',{name:'修复死信 schema',exact:true}).click();
 await tick(lab,2);await lab.getByRole('button',{name:'限速重放一条死信',exact:true}).click();await tick(lab,1);
 s=await physicalState(lab);expect(s.completed).toEqual(['order-A','order-B','problem-1']);expect(s.dead).toEqual([]);
 await lab.locator('[data-cm-action=reset]').click();await lab.getByRole('combobox',{name:'问题消息错误类型',exact:true}).selectOption('transient');await prepare(lab);await tick(lab,1);
 expect((await physicalState(lab)).delayed).toHaveLength(1);await tick(lab,2);expect((await physicalState(lab)).completed).toEqual(['order-A','order-B']);
});
test('149 stable routing needs serial completion, guard keeps rejected work visible',async({page})=>{
 const lab=await openLab(page,149);
 for(const [route,workers,guard,ticks,versions,rejected] of [['order','parallel',false,3,{A:1,B:1},0],['order','serial',false,4,{A:2,B:2},0],['global','serial',false,8,{A:2,B:2},0],['round-robin','serial',true,6,{A:1,B:1},2]] as const){
  await lab.locator('[data-cm-action=reset]').click();await lab.getByRole('combobox',{name:'消息如何进入队列',exact:true}).selectOption(route);await lab.getByRole('combobox',{name:'每个分区怎样执行',exact:true}).selectOption(workers);await lab.getByLabel('提交时检查当前版本 = 事件版本 − 1',{exact:true}).setChecked(guard);await prepare(lab);await tick(lab,ticks);
  const s=await physicalState(lab);expect(s.done).toBe(true);expect(s.versions).toEqual(versions);expect(s.rejected).toHaveLength(rejected);
 }
});

test('150 snapshot rejection and delta gap recovery follow different contracts',async({page})=>{
 const lab=await openLab(page,150);
 for(const [kind,rule,delivery,version,amount] of [['snapshot','arrival','late',2,-100],['snapshot','version','late',3,0],['delta','version','late',3,100],['delta','contiguous','late',3,0],['delta','contiguous','missing',3,0],['delta','version','missing',3,100]] as const){
  await lab.locator('[data-cm-action=reset]').click();await lab.getByRole('combobox',{name:'事件语义',exact:true}).selectOption(kind);await lab.getByRole('combobox',{name:'接收规则',exact:true}).selectOption(rule);await lab.getByRole('combobox',{name:'v2 的链路',exact:true}).selectOption(delivery);await prepare(lab);await tick(lab,1);
  if(rule==='contiguous')expect(await physicalState(lab)).toMatchObject({version:1,amount:0,buffer:[3],applied:[]});
  await tick(lab,3);
  if(delivery==='missing'&&rule==='contiguous')expect(await physicalState(lab)).toMatchObject({version:1,amount:0,buffer:[3],applied:[]});
  await tick(lab,1);const s=await physicalState(lab);expect(s).toMatchObject({version,amount});
  if(rule==='contiguous')expect(s).toMatchObject({buffer:[],applied:[2,3]});
 }
});
