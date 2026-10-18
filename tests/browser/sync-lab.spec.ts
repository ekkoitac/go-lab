import {test, expect, type Page} from '@playwright/test';

async function open(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId(`lesson${id}-lab`);
  await expect(lab).toBeVisible();
  return lab;
}

for (const ids of [[41,42,43], [44,45,46], [47,48], [49,50]]) {
  test(`dedicated sync lessons ${ids}: four help views, editor and assessment isolation`, async ({page}) => {
    test.setTimeout(120000);
    const errors: string[] = [], assessmentWrites: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if(r.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url())) assessmentWrites.push(r.url());});
    for (const id of ids) {
      const lab = await open(page, id);
      const model = lab.getByTestId('live-model').first();
      const before = await model.getAttribute('data-state');
      const editor = page.locator('.cm-content').first();
      await expect(editor).toBeVisible();
      const code = await editor.textContent();
      const helpPanel = page.locator('.help-panel');
      const views: string[] = [];
      for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
        await helpPanel.getByRole('button', {name, exact: true}).click();
        await expect(helpPanel.getByRole('button', {name, exact: true})).toHaveClass(/selected/);
        const help = helpPanel.getByTestId(`lesson${id}-help`);
        await expect(help).toBeVisible();
        views.push(await help.innerText());
        await expect(help.getByTestId(`lesson${id}-lab`)).toHaveCount(0);
      }
      expect(new Set(views).size).toBe(4);
      await expect(model).toHaveAttribute('data-state', before!);
      expect(await editor.textContent()).toBe(code);
      await helpPanel.getByRole('button', {name: '收起帮助', exact: true}).click();
    }
    expect(errors).toEqual([]);
    expect(assessmentWrites).toEqual([]);
  });
}

for (const width of [390, 320]) {
  test(`sync lessons and all help views fit ${width}px with reduced motion`, async ({page}) => {
    test.setTimeout(240000);
    await page.setViewportSize({width, height: 844});
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (let id = 41; id <= 50; id++) {
      const lab = await open(page, id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `lesson ${id} page`).toBe(true);
      expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `lesson ${id} lab`).toBe(true);
      if(width===390 && [41,46,50].includes(id)) await lab.screenshot({path:`.runtime/sync-rebuild-${id}-mobile.png`,animations:'disabled'});
      for (const name of ['举例子', '画图', '拆步骤', '让我试试']) {
        await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
        await expect(page.locator('.help-panel').getByRole('button', {name, exact: true})).toHaveClass(/selected/);
        const help = page.getByTestId(`lesson${id}-help`);
        await expect(help).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id}/${name} page`).toBe(true);
        expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${id}/${name} help`).toBe(true);
      }
    }
  });
}

test('42: keyboard scheduling distinguishes interleaving, parallel work and I/O waiting', async ({page}) => {
  test.setTimeout(120000);
  const lab = await open(page,42);
  const model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  await lab.getByRole('combobox',{name:'预测同时计算数量',exact:true}).selectOption('1');
  await lab.getByRole('button',{name:'提交预测并推进一格',exact:true}).focus();
  await page.keyboard.press('Enter');
  await lab.getByRole('combobox',{name:'执行单元 1 分配',exact:true}).selectOption('B');
  await lab.getByRole('combobox',{name:'预测同时计算数量',exact:true}).selectOption('1');
  await lab.getByRole('button',{name:'提交预测并推进一格',exact:true}).click();
  expect((await state()).timeline.map((s:{running:string[]})=>s.running)).toEqual([['A'],['B']]);
  await lab.getByRole('button',{name:'回退一格',exact:true}).click();
  expect((await state()).tick).toBe(1);
  await lab.getByRole('combobox',{name:'执行单元',exact:true}).selectOption('2');
  await lab.getByRole('combobox',{name:'预测同时计算数量',exact:true}).selectOption('2');
  await lab.getByRole('button',{name:'提交预测并推进一格',exact:true}).click();
  expect((await state()).timeline[0].running).toEqual(['A','B']);
  await lab.getByRole('checkbox').check();
  await lab.getByRole('combobox',{name:'预测同时计算数量',exact:true}).selectOption('2');
  await lab.getByRole('button',{name:'提交预测并推进一格',exact:true}).click();
  expect((await state()).tasks.map((t:{wait:number})=>t.wait)).toEqual([2,2]);
  await lab.getByRole('combobox',{name:'预测同时计算数量',exact:true}).selectOption('0');
  await lab.getByRole('button',{name:'提交预测并推进一格',exact:true}).click();
  expect((await state()).timeline[1].running).toEqual([]);
});


test('41: process exit stops unfinished work; completion protocol survives main arriving first', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,41);
  const model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function step(actor:string,prediction:string){
    await lab.getByRole('combobox',{name:'下一步运行谁',exact:true}).selectOption(actor);
    await lab.getByRole('combobox',{name:'先预测这一步的结果',exact:true}).selectOption(prediction);
    await lab.getByRole('button',{name:'执行一步并核对',exact:true}).click();
  }
  await step('main','launch');await step('main','exit');
  expect((await state()).saved).toBe(false);expect((await state()).main).toBe('exited');
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await state()).main).toBe('ready');
  await lab.getByRole('combobox',{name:'main 的退出协议',exact:true}).selectOption('receipt');
  await step('main','launch');await step('main','block');
  expect((await state()).main).toBe('waiting');
  await step('worker','progress');await step('worker','saved');
  expect((await state()).receipt).toBe(false);
  await step('worker','signal');await step('main','ack');await step('main','exit');
  expect((await state()).saved).toBe(true);expect((await state()).receipt).toBe(true);
  await lab.getByRole('button',{name:'重置实验',exact:true}).click();expect((await state()).main).toBe('new');
});

test('43: construct a lost update, rewind, and repair the entire read-modify-write boundary', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,43),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function predict(value:string){await lab.getByLabel('先预测你准备安排的最终 n',{exact:true}).fill(value);await lab.getByRole('button',{name:'记录预测，开始调度',exact:true}).click();}
  async function act(actor:string){await lab.getByRole('button',{name:`执行 ${actor} 下一步`,exact:true}).click();}
  await predict('1');for(const a of ['A','B','A','B','A','B'])await act(a);
  expect((await state()).value).toBe(1);expect((await state()).lostUpdate).toBe(true);
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await state()).done).toBe(false);
  await lab.getByRole('combobox',{name:'同步边界',exact:true}).selectOption('whole-lock');await predict('2');
  await act('A');await act('B');expect((await state()).workers.B.local).toBe(null);
  for(const a of ['A','A','B','B','B'])await act(a);
  expect((await state()).value).toBe(2);expect((await state()).raceRisk).toBe(false);
});

test('44: the shared lock hides intermediate state and old snapshots stay unchanged', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,44),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function observe(value:string){await lab.getByRole('combobox',{name:'本次读取会怎样？',exact:true}).selectOption(value);await lab.getByRole('button',{name:'验证：监控读取',exact:true}).click();}
  await lab.getByRole('button',{name:'转账：扣款',exact:true}).click();await observe('90');
  expect((await state()).observed.total).toBe(90);
  await lab.getByRole('button',{name:'转账：入账并解锁',exact:true}).click();
  expect((await state()).observed.total).toBe(90);expect((await state()).a+(await state()).b).toBe(100);
  await lab.getByRole('combobox',{name:'锁的范围',exact:true}).selectOption('whole');
  await lab.getByRole('button',{name:'转账：扣款',exact:true}).click();await observe('blocked');
  expect((await state()).observed).toBe(null);expect((await state()).blocked).toBe(1);
  await lab.getByRole('button',{name:'转账：入账并解锁',exact:true}).click();await observe('100');
  expect((await state()).observed.total).toBe(100);
});



test('45: separate locks overlap shared data; pointer identity restores exclusion', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,45),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function act(action:string,prediction:string){await lab.getByRole('combobox',{name:'下一步操作',exact:true}).selectOption(action);await lab.getByRole('combobox',{name:'先预测结果',exact:true}).selectOption(prediction);await lab.getByRole('button',{name:'执行并核对',exact:true}).click();}
  for(const [a,p] of [['connect','connected'],['lockA','acquired'],['enterA','access'],['lockB','acquired'],['enterB','overlap']])await act(a,p);
  expect((await state()).overlap).toBe(true);
  await lab.getByRole('combobox',{name:'对象传递方式',exact:true}).selectOption('pointer');
  for(const [a,p] of [['connect','connected'],['lockA','acquired'],['enterA','access'],['lockB','blocked']])await act(a,p);
  expect((await state()).phases.B).toBe('idle');
  for(const [a,p] of [['releaseA','released'],['lockB','acquired'],['enterB','access']])await act(a,p);
  expect((await state()).overlap).toBe(false);
  await lab.getByRole('combobox',{name:'对象传递方式',exact:true}).selectOption('copy-used');await act('connect','invalid');
  expect((await state()).violation).toBe(true);await expect(lab.getByRole('button',{name:'执行并核对',exact:true})).toBeDisabled();
});

test('46: actual blocked edges close a cycle; ordered acquisition lets both tasks finish', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,46),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function act(task:number,prediction:string){await lab.getByRole('combobox',{name:'会发生什么？',exact:true}).selectOption(prediction);await lab.getByRole('button',{name:new RegExp(`^执行任务 ${task}：`)}).click();}
  await act(1,'acquire');await act(2,'acquire');expect((await state()).edges).toHaveLength(0);
  await act(1,'wait');expect((await state()).deadlocked).toBe(false);await act(2,'cycle');expect((await state()).deadlocked).toBe(true);
  await lab.screenshot({path:'.runtime/sync-rebuild-46-deadlock.png',animations:'disabled'});
  await lab.getByRole('button',{name:'修复：统一锁序后重跑',exact:true}).click();
  for(const [task,prediction] of [[1,'acquire'],[2,'wait'],[1,'acquire'],[1,'release'],[1,'release'],[2,'acquire'],[2,'acquire'],[2,'release'],[2,'release']] as const) await act(task,prediction);
  expect((await state()).pc).toEqual([4,4]);expect((await state()).owners).toEqual([null,null]);
});

test('47: break self-upgrade deadlock and recheck after another writer fills the gap', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,47),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function act(name:string){await lab.getByRole('button',{name,exact:true}).click();}
  async function lock(value:string){await lab.getByRole('combobox',{name:'这次 Lock 的结果',exact:true}).selectOption(value);await act('A：Lock / 恢复等待');}
  await act('A：RLock');await act('A：检查缓存');await lock('blocked');expect((await state()).phase).toBe('deadlock');
  await act('回退一步');await act('A：RUnlock（修复）');await act('B：抢先 Lock');await act('B：填充缓存');
  await lock('blocked');expect((await state()).phase).toBe('waiting');await act('B：Unlock');await lock('acquired');
  await act('A：写锁内复查');await act('A：Unlock 并返回');expect((await state()).value).toBe('B 已生成的值');expect((await state()).writes).toBe(1);
});

test('48: late registration cannot reblock Wait; registered work completes before batch reuse', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,48),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function act(name:string){await lab.getByRole('button',{name,exact:true}).click();}
  async function waitFor(value:string){await lab.getByRole('combobox',{name:'本次 Wait 会怎样？',exact:true}).selectOption(value);await act('调用 Wait');}
  await lab.getByRole('combobox',{name:'任务数（改变后重新开始）',exact:true}).selectOption('1');
  await act('A · go 启动');await waitFor('returned');await act('A · Add(1)');
  expect((await state()).wait).toBe('returned');expect((await state()).count).toBe(1);
  await act('重置实验');await act('A · Add(1)');await act('A · go 启动');await waitFor('waiting');
  await act('A · 业务完成');expect((await state()).count).toBe(1);await act('A · Done()');
  expect((await state()).wait).toBe('ready');await expect(lab.getByRole('button',{name:'开始下一批',exact:true})).toBeDisabled();
  await act('调度 Wait 返回');await act('开始下一批');expect((await state()).batch).toBe(2);
});

test('50: mixed atomic fields, common locking and retained immutable snapshots', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,50),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function predict(value:string){await lab.getByRole('combobox',{name:'先预测你将构造的读者快照',exact:true}).selectOption(value);await lab.getByLabel('预测依据',{exact:true}).fill('让读者在两字段更新之间进入');await lab.getByRole('button',{name:'记录预测，开始调度',exact:true}).click();}
  async function act(actor:'写者'|'读者'){await lab.getByRole('button',{name:new RegExp(`^${actor}`)}).click();}
  await predict('mixed');await act('写者');await act('写者');for(let i=0;i<4;i++)await act('读者');
  expect((await state()).observed).toEqual({version:2,limit:10});
  await lab.getByRole('combobox',{name:'同步方案',exact:true}).selectOption('mutex');await predict('new');
  await act('写者');await act('写者');await act('读者');expect((await state()).reader).toBe(0);
  await act('写者');await act('写者');for(let i=0;i<4;i++)await act('读者');
  expect((await state()).observed).toEqual({version:2,limit:20});
  await lab.getByRole('combobox',{name:'同步方案',exact:true}).selectOption('snapshot');await predict('old');
  await act('读者');for(let i=0;i<4;i++)await act('写者');for(let i=0;i<3;i++)await act('读者');
  expect((await state()).captured).toBe('old');expect((await state()).observed).toEqual({version:1,limit:10});expect((await state()).published).toBe('new');
});


test('49: concurrent Do waits for initialization; only outside business runs for every request', async ({page}) => {
  test.setTimeout(120000);
  const lab=await open(page,49),model=lab.getByTestId('live-model');
  const state=async()=>JSON.parse((await model.getAttribute('data-state'))!);
  async function act(name:string){await lab.getByRole('button',{name,exact:true}).click();}
  await lab.getByRole('combobox',{name:'预测左右业务次数',exact:true}).selectOption('1/3');await act('记录预测并开始');
  await act('调度请求 1');await act('调度请求 2');
  expect((await state()).states.map((s:{requests:string[]})=>s.requests[1])).toEqual(['waiting','waiting']);
  await act('推进初始化一步');await act('调度请求 2');expect((await state()).states[1].operations).toBe(0);
  await act('推进初始化一步');
  await act('调度请求 1');await act('调度请求 2');await act('调度请求 2');await act('调度请求 3');await act('调度请求 3');
  expect((await state()).finished).toBe(true);expect((await state()).states.map((s:{operations:number})=>s.operations)).toEqual([1,3]);
  await act('回退一步');expect((await state()).finished).toBe(false);
});


test('48 help: require both predictions, reveal computed evidence, reset on new input without mastery writes', async ({page}) => {
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))writes.push(r.url());});
  await open(page,48);await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();
  const help=page.getByTestId('lesson48-help'),submit=help.getByRole('button',{name:'提交预测并核对',exact:true});
  await expect(submit).toBeDisabled();await expect(help.getByRole('status')).toHaveCount(0);
  await help.getByRole('spinbutton',{name:'计数是多少？',exact:true}).fill('2');
  await help.getByRole('combobox',{name:'Wait 状态',exact:true}).selectOption('waiting');await submit.click();
  await expect(help.getByRole('status')).toContainText('本次判断成立');
  await help.getByRole('button',{name:'换一组输入',exact:true}).click();await expect(help.getByRole('status')).toHaveCount(0);
  await help.getByRole('spinbutton',{name:'计数是多少？',exact:true}).fill('1');
  await help.getByRole('combobox',{name:'Wait 状态',exact:true}).selectOption('returned');await submit.click();
  await expect(help.getByRole('status')).toContainText('原 Wait 在 Add 前已经合法返回');expect(writes).toEqual([]);
});

test('50 help: immutable publication feedback changes only after a new prediction is submitted', async ({page}) => {
  const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))writes.push(r.url());});
  await open(page,50);await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();
  const help=page.getByTestId('lesson50-help'),submit=help.getByRole('button',{name:'提交判断并查看证据',exact:true});
  await expect(submit).toBeDisabled();await expect(help.getByRole('status')).toHaveCount(0);
  await help.getByRole('combobox',{name:'预测读者得到的值',exact:true}).selectOption('mixed');
  await help.getByRole('textbox',{name:'解释：原子发布保护了哪一步？',exact:true}).fill('指针原子发布没有冻结对象字段');await submit.click();
  await expect(help.getByRole('status')).toContainText('实际为 2 / 40');
  await help.getByRole('combobox',{name:'写者后续动作',exact:true}).selectOption('keep');await expect(help.getByRole('status')).toHaveCount(0);await expect(submit).toBeDisabled();
  await help.getByRole('combobox',{name:'预测读者得到的值',exact:true}).selectOption('new');await help.getByRole('textbox',{name:'解释：原子发布保护了哪一步？',exact:true}).fill('同一个不可变对象中的两个字段保持一致');await submit.click();
  await expect(help.getByRole('status')).toContainText('实际为 2 / 30');expect(writes).toEqual([]);
});
