import {test, expect, type Page} from '@playwright/test';

async function open(page: Page, id: number) {
  await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
  await page.getByRole('button', {name: '动手观察', exact: true}).click();
  const lab = page.locator('.learning-column').getByTestId('engineering-lab-' + id);
  await expect(lab).toBeVisible();
  return lab;
}

for (const width of [1440, 390]) test(`91–100: observation and distinct help modes at ${width}px`, async ({page}) => {
  test.setTimeout(240000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], assessments: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(request.url())) assessments.push(request.url());
  });
  for (const id of (process.env.ENGINEERING_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 91 + i))) {
    const lab = await open(page, id);
    await expect(lab.getByTestId('live-model').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `observation overflow ${id}`).toBe(true);
    const editor = await page.locator('.cm-content').first().textContent();
    const originalState = await lab.getByTestId('live-model').first().getAttribute('data-state');
    const contents = new Set<string>();
    for (const [name, mode] of [['举例子','example'], ['画图','diagram'], ['拆步骤','steps'], ['让我试试','try']]) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      const help = page.locator('.help-content').locator('[data-help-mode=' + mode + ']').getByTestId('engineering-help-' + id);
      await expect(help).toBeVisible();
      contents.add((await help.textContent())!);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `help overflow ${id}/${name}`).toBe(true);
      if (name === '画图') {
        await expect(help.locator('svg:visible, [data-testid=relationship-diagram]:visible').first()).toBeVisible();
        const clipped = await help.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
          const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
          const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
          return v.width > 0 && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2);
        }).map(node => node.textContent));
        expect(clipped, `SVG clipped ${id}`).toEqual([]);
        const tiny = await help.locator('svg:visible text').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().height < 10).map(n => n.textContent));
        expect(tiny, `SVG text too small ${id}`).toEqual([]);
        await help.screenshot({path: `.runtime/engineering-help-${id}-${width}.png`, animations: 'disabled'});
      }
      expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
      expect(await lab.getByTestId('live-model').first().getAttribute('data-state')).toBe(originalState);
    }
    expect(contents.size, `four distinct help modes ${id}`).toBe(4);
    await page.getByRole('button', {name: '收起帮助', exact: true}).click();
    await lab.screenshot({path: `.runtime/engineering-${id}-${width}.png`, animations: 'disabled'});
  }
  expect(errors).toEqual([]);
  expect(assessments).toEqual([]);
});

test('91: cost changes apply only to the selected part; new load clears the prediction', async ({page}) => {
  const lab = await open(page, 91), model = lab.getByTestId('live-model');
  await lab.locator('[data-eg-action=step]').click();
  await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
  await lab.getByLabel('预测总耗时', {exact: true}).fill('95');
  await lab.getByLabel('预测理由', {exact: true}).fill('网络90保持不变，只把计算10除以2');
  await lab.locator('[data-eg-action=step]').focus();
  await page.keyboard.press('Enter');
  expect(JSON.parse((await model.getAttribute('data-state'))!).total).toBe(95);
  const saved = await model.getAttribute('data-state');
  await lab.locator('[data-eg-action=back]').click();
  await lab.locator('[data-eg-action=step]').click();
  expect(await model.getAttribute('data-state')).toBe(saved);
  await lab.getByLabel('优化对象', {exact: true}).selectOption('network');
  await expect(lab.getByLabel('预测总耗时', {exact: true})).toHaveValue('');
  await lab.getByLabel('预测总耗时', {exact: true}).fill('55');
  await lab.getByLabel('预测理由', {exact: true}).fill('计算10不变，网络90减为45');
  for (let i=0;i<3;i++) await lab.locator('[data-eg-action=step]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).total).toBe(55);
  await lab.locator('[data-eg-action=reset]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).step).toBe(0);
  await expect(lab.getByLabel('预测理由', {exact: true})).toHaveValue('');
});

test('92: limiting cap preserves the original array; copying releases it only after the last owner leaves', async ({page}) => {
  const lab = await open(page, 92), model = lab.getByTestId('live-model');
  const advance = async (reachable: boolean) => {
    await lab.getByLabel('执行后，原大数组会怎样？').selectOption(String(reachable));
    await lab.getByLabel('哪条引用会保留或断开？').fill('沿着所有存活持有者检查是否仍有引用路径');
    await lab.locator('[data-eg-action=step]').click();
  };
  await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
  await advance(true); await advance(true);
  let state = JSON.parse((await model.getAttribute('data-state'))!);
  expect(state.cap).toBe(4); expect(state.retainedBytes).toBe(1024); expect(state.largeReachable).toBe(true);
  await lab.getByLabel('缓存方式').selectOption('copy');
  await lab.getByLabel('另一个存活对象也引用原数组').check();
  await advance(true); await advance(true);
  state = JSON.parse((await model.getAttribute('data-state'))!);
  expect(state.retainedBytes).toBe(1028); expect(state.copyBytes).toBe(4);
  await advance(false);
  const final = await model.getAttribute('data-state');
  expect(JSON.parse(final!).retainedBytes).toBe(4);
  await lab.locator('[data-eg-action=back]').click(); await advance(false);
  expect(await model.getAttribute('data-state')).toBe(final);
  await advance(false);
  expect(JSON.parse((await model.getAttribute('data-state'))!).retainedBytes).toBe(0);
  await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
  await lab.locator('[data-eg-action=reset]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).step).toBe(0);
});

test('93: capacity is not length, and append does not overwrite existing zero values', async ({page}) => {
  const lab = await open(page, 93), model = lab.getByTestId('live-model').nth(1);
  const predict = async (outcome: string, length: string) => {
    await lab.getByLabel('预测结果', {exact: true}).selectOption(outcome);
    await lab.getByLabel('预测最终长度', {exact: true}).selectOption(length);
    await lab.getByLabel('预测理由', {exact: true}).fill('append从len位置追加，索引只允许位于len以内');
  };
  await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
  await predict('zeros', '6');
  for(let i=0;i<3;i++) await lab.locator('[data-eg-action=step]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).values).toEqual([0,0,0,1,2,3]);
  const saved = await model.getAttribute('data-state');
  await lab.locator('[data-eg-action=back]').click(); await lab.locator('[data-eg-action=step]').click();
  expect(await model.getAttribute('data-state')).toBe(saved);
  await lab.getByLabel('初始化方案').selectOption('reserve');
  await predict('correct', '3');
  for(let i=0;i<3;i++) await lab.locator('[data-eg-action=step]').click();
  let state = JSON.parse((await model.getAttribute('data-state'))!);
  expect(state.values).toEqual([1,2,3]); expect(state.growths).toBe(0);
  await lab.getByLabel('填入方式').selectOption('index');
  await predict('panic', '0'); await lab.locator('[data-eg-action=step]').click();
  state = JSON.parse((await model.getAttribute('data-state'))!);
  expect(state.panic).toBe(true); expect(state.values).toEqual([]); expect(state.capacity).toBe(3);
});

test('94: UTF-8 prefix copying differs from buffered writes, and Grow controls modeled relocation', async ({page}) => {
 const lab=await open(page,94),model=lab.getByTestId('live-model');
 const advance=async(n:number)=>{await lab.getByLabel('+= 下一轮搬运多少字节？').fill(String(n));await lab.getByLabel('你的理由',{exact:true}).fill('按UTF-8计算旧前缀加新片段，预留缓冲只写新片段');await lab.locator('[data-eg-action=step]').click();};
 await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
 for(const n of [2,5,9,10])await advance(n);
 let s=JSON.parse((await model.getAttribute('data-state'))!);
 expect(s.output).toBe('Go你🙂!');expect(s.bytes).toBe(10);expect(s.concatTotal).toBe(26);expect(s.builderTotal).toBe(10);
 const final=await model.getAttribute('data-state');await lab.locator('[data-eg-action=back]').click();await advance(10);expect(await model.getAttribute('data-state')).toBe(final);
 await lab.getByLabel('Builder 预先 Grow(总字节数)').uncheck();
 for(const n of [2,5,9,10])await advance(n);
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.output).toBe('Go你🙂!');expect(s.builderTotal).toBeGreaterThan(10);
 await lab.locator('[data-eg-action=reset]').click();expect(JSON.parse((await model.getAttribute('data-state'))!).output).toBe('');
});

test('95: Pool loss requires reconstruction; reuse requires reset and relinquishing ownership', async ({page}) => {
 const lab=await open(page,95),model=lab.getByTestId('live-model');
 const run=async(source:string)=>{await lab.getByLabel('B.Get 预测').selectOption(source);await lab.getByLabel('Pool 预测理由').fill('Get无可用项时只能调用New或返回nil，Put不自动清空内容');for(let i=0;i<5;i++)await lab.locator('[data-eg-action=step]').click();return JSON.parse((await model.getAttribute('data-state'))!);};
 expect((await run('nil')).source).toBe('nil');
 await lab.getByLabel('设置 New 构造空缓冲').check();
 let s=await run('new');expect(s.source).toBe('new');expect(s.content).toBe('B:响应;');expect(s.allocations).toBe(2);
 await lab.getByLabel('运行时分支').selectOption('reuse');
 s=await run('reused');expect(s.content).toBe('A:订单;B:响应;');
 await lab.getByLabel('归还前 Reset 逻辑内容').check();
 s=await run('reused');expect(s.content).toBe('B:响应;');
 await lab.getByLabel('注入错误：A 在 Put 后仍写入').check();
 s=await run('reused');expect(s.violation).toBe(true);expect(s.content).toContain('A:越权;');
 const final=await model.getAttribute('data-state');await lab.locator('[data-eg-action=back]').click();await lab.locator('[data-eg-action=step]').click();expect(await model.getAttribute('data-state')).toBe(final);
 await lab.locator('[data-eg-action=reset]').click();await expect(lab.getByLabel('B.Get 预测')).toHaveValue('');
});

test('96: checking before send cannot cancel a later blocked send; select and done have separate steps', async ({page}) => {
 const lab=await open(page,96),model=lab.getByTestId('live-model');
 const predict=async(outcome:string)=>{await lab.getByLabel('预测发送处会怎样').selectOption(outcome);await lab.getByLabel('预测理由',{exact:true}).fill('取消必须在可能阻塞的发送处被观察，返回后done才关闭');};
 await predict('blocked');for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();
 let s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.phase).toBe('blocked');expect(s.cancelled).toBe(true);expect(s.done).toBe(false);
 await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
 await lab.getByRole('button',{name:'清理实验：补一个接收者',exact:true}).click();
 await lab.locator('[data-eg-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!).done).toBe(true);
 await lab.locator('[data-eg-action=reset]').click();await lab.getByLabel('取消放置位置').selectOption('select');
 await predict('cancel');for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.phase).toBe('returning');expect(s.done).toBe(false);expect(s.delivered).toBe(false);
 await lab.locator('[data-eg-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!).done).toBe(true);
 await lab.locator('[data-eg-action=reset]').click();await lab.getByLabel('检查后的消费者').selectOption('stays');await predict('either');
 for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();
 const selected=await model.getAttribute('data-state');
 for(let i=0;i<4;i++){await lab.locator('[data-eg-action=back]').click();await lab.locator('[data-eg-action=step]').click();expect(await model.getAttribute('data-state')).toBe(selected);}
});

test('97: dependency wiring determines the actual method call and interface requirements', async ({page}) => {
 const lab=await open(page,97),model=lab.getByTestId('live-model');
 const run=async(outcome:string)=>{await lab.getByLabel('预测结果',{exact:true}).selectOption(outcome);await lab.getByLabel('预测理由',{exact:true}).fill('业务实际调用注入的Count，所选实现必须满足消费方的方法集');await lab.locator('[data-eg-action=commit]').click();for(let i=0;i<3&&await lab.locator('[data-eg-action=step]').isEnabled();i++)await lab.locator('[data-eg-action=step]').click();return JSON.parse((await model.getAttribute('data-state'))!);};
 let s=await run('accepted');expect(s.actual).toBe('warehouse');expect(s.count).toBe(99);
 await lab.getByLabel('业务连接方式').selectOption('injected');
 s=await run('rejected');expect(s.actual).toBe('fake');expect(s.count).toBe(3);expect(s.result).toBe('rejected');
 const final=await model.getAttribute('data-state');await lab.locator('[data-eg-action=back]').click();await lab.locator('[data-eg-action=step]').click();expect(await model.getAttribute('data-state')).toBe(final);
 await lab.getByLabel('消费方要求的能力').selectOption('wide');
 s=await run('blocked');expect(s.actual).toBeNull();expect(s.result).toBe('blocked');
 await lab.getByLabel('调用者选择的实现').selectOption('warehouse');
 s=await run('accepted');expect(s.result).toBe('accepted');
 await lab.locator('[data-eg-action=reset]').click();await expect(lab.getByLabel('预测结果',{exact:true})).toHaveValue('');
});

test('98: copying array elements isolates replacements but not writes into shared maps', async ({page}) => {
 const lab=await open(page,98),model=lab.getByTestId('live-model');
 const run=async(outcome:string)=>{await lab.getByLabel('B 的读取预测').selectOption(outcome);await lab.getByLabel('98题预测理由').fill('沿数组与map引用找到写入对象，B从全局取得配置');await lab.locator('[data-eg-action=commit]').click();for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();return JSON.parse((await model.getAttribute('data-state'))!);};
 expect((await run('debug')).bValue).toBe('debug');
 await lab.getByLabel('获取配置的方式').selectOption('elements');expect((await run('stable')).bValue).toBe('stable');
 await lab.getByLabel('配置类型').selectOption('maps');await lab.getByLabel('A 的写入位置').selectOption('nested');
 let s=await run('debug');expect(s.globalValue).toBe('debug');expect(s.arrays.A[0]).toBe(s.arrays.G[0]);
 await lab.getByLabel('获取配置的方式').selectOption('deep');
 s=await run('stable');expect(s.aValue).toBe('debug');expect(s.bValue).toBe('stable');expect(s.arrays.A[0]).not.toBe(s.arrays.G[0]);
 const final=await model.getAttribute('data-state');await lab.locator('[data-eg-action=back]').click();await lab.locator('[data-eg-action=step]').click();expect(await model.getAttribute('data-state')).toBe(final);
 await lab.getByLabel('获取配置的方式').selectOption('readonly');s=await run('stable');expect(s.blocked).toBe(true);expect(s.globalValue).toBe('stable');
 await lab.locator('[data-eg-action=reset]').click();await expect(lab.getByLabel('B 的读取预测')).toHaveValue('');
});

test('99: identical error text does not preserve identity; labels change series and trace isolates slow stage', async ({page}) => {
 const lab=await open(page,99),model=lab.getByTestId('live-model');
 const run=async(outcome:string)=>{await lab.getByLabel('先预测 errors.Is 的结果').selectOption(outcome);await lab.getByLabel('你的理由',{exact:true}).fill('错误文本和Unwrap引用是不同证据，指标按标签组合聚合');await lab.locator('[data-eg-action=commit]').click();for(let i=0;i<4;i++)await lab.locator('[data-eg-action=step]').click();return JSON.parse((await model.getAttribute('data-state'))!);};
 let s=await run('false');expect(s.isTimeout).toBe(false);expect(s.series).toHaveLength(1);expect(s.series[0].count).toBe(4);const text=s.text;
 await lab.locator('[data-eg-action=reset]').click();await lab.getByLabel('错误包装').selectOption('w');await lab.getByLabel('指标标签').selectOption('order');await lab.getByLabel('请求数量').fill('6');await lab.getByLabel('慢阶段').selectOption('payment');
 s=await run('true');expect(s.isTimeout).toBe(true);expect(s.text).toBe(text);expect(s.errorChain).toHaveLength(2);expect(s.series).toHaveLength(6);expect(s.spans.find((v:{name:string})=>v.name==='payment').duration).toBe(90);
 const final=await model.getAttribute('data-state');await lab.locator('[data-eg-action=back]').click();await lab.locator('[data-eg-action=step]').click();expect(await model.getAttribute('data-state')).toBe(final);
});

test('100: cancel is notification; completion, timeout and simultaneous readiness remain distinguishable', async ({page}) => {
 const lab=await open(page,100),model=lab.getByTestId('live-model');
 const predict=async(outcome:string)=>{await lab.getByLabel('先预测退出结果').selectOption(outcome);await lab.getByLabel('预测理由',{exact:true}).fill('先关闭入口，再观察取消和清理，done与计时器可能同时就绪');await lab.locator('[data-eg-action=commit]').click();};
 await predict('complete');await lab.locator('[data-eg-action=step]').click();await lab.locator('[data-eg-action=step]').click();
 let s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.gateOpen).toBe(false);expect(s.cancelled).toBe(true);expect(s.done).toBe(false);
 for(let i=0;i<4;i++)await lab.locator('[data-eg-action=step]').click();
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.phase).toBe('ended');expect(s.outcome).toBe('complete');expect(s.externalCommitted).toBe(true);
 await lab.getByLabel('退出预算',{exact:true}).fill('1');await predict('timeout');for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.outcome).toBe('timeout');expect(s.done).toBe(false);expect(s.worker).toBe('terminated');
 await lab.getByLabel('退出预算',{exact:true}).fill('3');await predict('both');for(let i=0;i<5;i++)await lab.locator('[data-eg-action=step]').click();
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.phase).toBe('boundary');expect(s.done).toBe(true);await expect(lab.locator('[data-eg-action=step]')).toBeDisabled();
 await lab.getByRole('button',{name:'观察合法路径：选中 done',exact:true}).click();expect(JSON.parse((await model.getAttribute('data-state'))!).outcome).toBe('complete');
 await lab.locator('[data-eg-action=back]').click();await lab.getByRole('button',{name:'观察合法路径：选中 timer',exact:true}).click();expect(JSON.parse((await model.getAttribute('data-state'))!).outcome).toBe('timeout');
 await lab.getByLabel('main 的等待方式').selectOption('false');await predict('abrupt');for(let i=0;i<3;i++)await lab.locator('[data-eg-action=step]').click();
 s=JSON.parse((await model.getAttribute('data-state'))!);expect(s.outcome).toBe('abrupt');expect(s.done).toBe(false);expect(s.externalCommitted).toBe(true);
});

test('all ten help challenges validate locally without changing the experiment, editor or formal assessment', async ({page}) => {
 test.setTimeout(150000);
 const assessments:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))assessments.push(r.url());});
 for(let id=91;id<=100;id++){
  const lab=await open(page,id),before=await lab.getByTestId('live-model').first().getAttribute('data-state'),editor=await page.locator('.cm-content').first().textContent();
  await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();
  const help=page.locator('[data-help-mode=try]').getByTestId('engineering-help-'+id);await expect(help).toBeVisible();
  if(id===91){await help.getByLabel('帮助预测总耗时').fill('85');await help.getByLabel('帮助预测理由').fill('70+30/2');await help.getByRole('button',{name:'验证这次预测',exact:true}).click();await expect(help).toContainText('预测吻合');}
  if(id===92){await help.getByLabel('我的预测').selectOption('1048592');await help.getByLabel('依据',{exact:true}).fill('原数组仍被后台引用，再加16B副本');await help.getByRole('button',{name:'验证引用路径',exact:true}).click();await expect(help.getByRole('status')).toContainText('预测吻合');}
  if(id===93){await help.getByLabel('预测结果',{exact:true}).selectOption('correct');await help.getByLabel('预测最终长度').selectOption('4');await help.getByLabel('预测理由',{exact:true}).fill('从len0追加四条，容量不够会增长');for(let i=0;i<4;i++)await help.locator('[data-eg-action=step]').click();await expect(help).toContainText('观察支持你的预测');}
  if(id===94){await help.getByLabel('累计搬运字节').fill('15');await help.getByLabel('推导理由').fill('前缀3+4+8');await help.getByRole('button',{name:'验证这组输入',exact:true}).click();await expect(help.getByRole('status')).toContainText('预测吻合');}
  if(id===95){await help.getByLabel('预测结果').selectOption('nil');await help.getByLabel('解释依据').fill('没有可用项，也没有New');await help.getByRole('button',{name:'验证这个预测',exact:true}).click();await expect(help.getByRole('status')).toContainText('预测一致');}
  if(id===96){await help.getByLabel('预测发送处会怎样').selectOption('either');await help.getByLabel('预测理由',{exact:true}).fill('两个分支均就绪，没有取消优先');await help.getByRole('button',{name:'验证我的推理',exact:true}).click();await expect(help).toContainText('判断一致');}
  if(id===97){await help.getByLabel('我的预测').selectOption('rejected');await help.getByLabel('为什么',{exact:true}).fill('remote库存0，小于需要2');await help.getByRole('button',{name:'验证预订',exact:true}).click();await expect(help).toContainText('推导一致');}
  if(id===98){await help.getByLabel('挑战预测').selectOption('stable');await help.getByLabel('挑战理由').fill('只替换A私有数组中的元素');await help.getByRole('button',{name:'验证这次写入',exact:true}).click();await expect(help.getByRole('status')).toContainText('实际 stable');}
  if(id===99){await help.getByLabel('预测序列数').selectOption('6');await help.getByLabel('理由',{exact:true}).fill('每个订单号形成新的标签组合');await help.getByRole('button',{name:'验证这次预测',exact:true}).click();await expect(help).toContainText('实际 6 条');}
  if(id===100){await help.getByLabel('我的预测').selectOption('timeout');await help.getByLabel('为什么',{exact:true}).fill('收尾4格超过预算3格');await help.getByRole('button',{name:'验证消息收尾',exact:true}).click();await expect(help).toContainText('推导一致');}
  expect(await lab.getByTestId('live-model').first().getAttribute('data-state')).toBe(before);expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
 }
 expect(assessments).toEqual([]);
});
