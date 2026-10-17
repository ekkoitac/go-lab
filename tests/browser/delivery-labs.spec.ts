import {test,expect,type Page,type Locator} from '@playwright/test';
const ids=process.env.DELIVERY_TEST_IDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>191+i);
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('delivery-lab-'+id);
 await expect(lab).toBeVisible();return lab;
}
async function fits(page:Page,root:Locator,context:string){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),context+' page overflow').toBe(true);
 expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),context+' panel overflow').toBe(true);
 const clipped=await root.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
  const text=node as SVGGraphicsElement,svg=text.ownerSVGElement!;
  const b=text.getBoundingClientRect(),v=svg.getBoundingClientRect();
  return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
 }).map(n=>n.textContent));expect(clipped,context+' clipped diagram labels').toEqual([]);
}
for(const width of [1440,390,320])test(`191–200 observations, help isolation and layout at ${width}px`,async({page})=>{
 test.setTimeout(300000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[],attempts:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
 for(const id of ids){
  const lab=await open(page,id),model=lab.getByTestId('live-model').first();
  await expect(model).toBeVisible();await fits(page,lab,`${id} observation`);
  if(id===195){await lab.getByLabel('预计结果').selectOption({label:'小流量后暂停'});await lab.getByLabel('预测依据').fill('代表性客户的金额异常超过阈值，应暂停。');await lab.getByRole('button',{name:'记录本轮预测',exact:true}).click();}
  if(id===196){await lab.getByLabel('完成本轮恢复后').selectOption('fail');await lab.getByLabel('依据',{exact:true}).fill('应用回滚不会恢复数据格式，需要核账。');}
  if(id===197){await lab.getByRole('combobox',{name:'你的判断',exact:true}).selectOption('changed');await lab.getByLabel('理由',{exact:true}).fill('共享对象被修改，旧请求也会观察到变更。');}
  if(id===198){await lab.getByLabel('覆盖 latest 后，保存的证据能否定位生产内容？').selectOption('no');await lab.getByLabel('你的依据').fill('部署只记录可变标签，标签移动后不能确定原制品。');}
  if(id===200){await lab.getByLabel('你预计本轮该怎么做？').selectOption('rollback');await lab.getByLabel('为什么？请联系瓶颈、成本或硬约束').fill('拆分没有修复数据库热点，却增加网络和维护成本。');}
  const initial=await executionSnapshot(model);expect(initial).toBeTruthy();
  if(id===191)await lab.getByLabel('先预测：这组测试能否发现所有注入缺陷？').selectOption('no');
  const step=lab.locator('[data-delivery-action=step]').first();
  if(await step.count()){
   await expect(step).toBeEnabled();await step.focus();await page.keyboard.press('Enter');
   await expect.poll(()=>executionSnapshot(model)).not.toBe(initial);
   const after=await executionSnapshot(model),back=lab.locator('[data-delivery-action=back]').first();
   if(await back.count()){
    await back.click();await expect.poll(()=>executionSnapshot(model)).toBe(initial);
    await step.click();await expect.poll(()=>executionSnapshot(model)).toBe(after);
   }
   await lab.locator('[data-delivery-action=reset]').first().click();
   await expect.poll(()=>executionSnapshot(model)).toBe(initial);
  }
  const before=await model.getAttribute('data-state');
  const notebookField=page.getByRole('textbox',{name:'架构决策记录'});
  const notebook=await notebookField.count()?await notebookField.inputValue():null;
  const views:string[]=[];
  for(const name of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
   const help=page.getByTestId('delivery-help-'+id);await expect(help).toBeVisible();
   await fits(page,help,`${id} ${name}`);views.push(await help.innerText());
   await expect(help.getByTestId('delivery-lab-'+id)).toHaveCount(0);
   await expect(model).toHaveAttribute('data-state',before!);
   if(notebook!==null)await expect(notebookField).toHaveValue(notebook);
   if(name==='画图')await help.screenshot({path:`.runtime/delivery-labs/help-${id}-${width}.png`,animations:'disabled'});
  }
  expect(new Set(views).size,`${id} distinct help views`).toBe(4);
  await page.getByRole('button',{name:'收起帮助',exact:true}).click();
  await lab.screenshot({path:`.runtime/delivery-labs/lab-${id}-${width}.png`,animations:'disabled'});
 }
 expect(errors).toEqual([]);expect(attempts).toEqual([]);
});

async function executionSnapshot(model:Locator){const state=JSON.parse((await model.getAttribute('data-state'))!);delete state.prediction;delete state.reason;delete state.locked;delete state.predictionLocked;return JSON.stringify(state);}
async function modelOf(lab:Locator){return JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!)}
if(ids.includes(192))test('192 concurrent writes lose an increment; conflict retry repairs the reference contract',async({page})=>{
 const lab=await open(page,192);
 for(let i=0;i<5;i++)await lab.locator('[data-delivery-action=step]').click();
 let state=await modelOf(lab);
 expect(state.fake.value).toBe(110);expect(state.fake.successes).toBe(2);
 expect(state.reference.conflicts).toBe(1);expect(state.reference.value).toBe(110);
 await lab.getByLabel('修复：收到冲突后重新读取并重试').check();
 for(let i=0;i<5;i++)await lab.locator('[data-delivery-action=step]').click();
 state=await modelOf(lab);expect(state.reference.value).toBe(120);expect(state.referenceLost).toBe(0);
 await lab.getByLabel('两位写者先读再写（并发交错）').uncheck();
 for(let i=0;i<5;i++)await lab.locator('[data-delivery-action=step]').click();
 state=await modelOf(lab);expect(state.fake.value).toBe(120);expect(state.reference.conflicts).toBe(0);
 await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();
 const help=page.getByTestId('delivery-help-192');
 await expect(help.getByText('判断符合当前证据边界。',{exact:true})).toHaveCount(0);
 await help.getByLabel('选择下一步').selectOption('real');
 await help.getByLabel('你的理由').fill('立即读取未覆盖过期路径，替身无法验证驱动与真实服务。');
 await help.getByRole('button',{name:'提交判断与理由',exact:true}).click();
 await expect(help.getByRole('status')).toContainText('判断符合当前证据边界');
 await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',JSON.stringify(state));
});

if(ids.includes(193))test('193 time cannot prove completion; missing done times out and repair restores proof',async({page})=>{
 const lab=await open(page,193),step=lab.locator('[data-delivery-action=step]');
 for(let i=0;i<7;i++)await step.click();
 let state=await modelOf(lab);expect(state.sleepVerdict).toBe('early');expect(state.handshakeVerdict).toBe('passed');
 await lab.getByLabel('注入故障：worker 漏关 done').check();
 for(let i=0;i<11;i++)await step.click();
 state=await modelOf(lab);expect(state.written).toBe(true);expect(state.done).toBe(false);expect(state.handshakeVerdict).toBe('timeout');
 await lab.getByRole('button',{name:'补上 close(done)，从起点验证',exact:true}).click();
 for(let i=0;i<7;i++)await step.click();
 state=await modelOf(lab);expect(state.handshakeVerdict).toBe('passed');
});

async function steps(lab:Locator,n:number){for(let i=0;i<n;i++)await lab.locator('[data-delivery-action=step]').click()}
if(ids.includes(191))test('191 real transaction evidence exposes escaped messages then repair preserves test conditions',async({page})=>{
 const lab=await open(page,191);
 await lab.getByLabel('先预测：这组测试能否发现所有注入缺陷？').selectOption('no');await steps(lab,3);
 expect((await modelOf(lab)).detected).toEqual([]);
 await lab.getByLabel('集成：重复请求与真实约束',{exact:true}).check();
 await lab.getByLabel('先预测：这组测试能否发现所有注入缺陷？').selectOption('yes');await steps(lab,3);
 expect((await modelOf(lab)).detected).toEqual(['transaction']);
 await lab.getByRole('button',{name:'修复缺陷，保留测试作对照',exact:true}).click();
 await lab.getByLabel('先预测：这组测试能否发现所有注入缺陷？').selectOption('none');await steps(lab,3);
 const state=await modelOf(lab);expect(state.detected).toEqual([]);expect(state.evidence[1].status).toBe('pass');
});
if(ids.includes(194))test('194 stale backfill is detected; version-safe repair restores compatibility',async({page})=>{
 const lab=await open(page,194);await steps(lab,4);
 await lab.getByRole('button',{name:'插入并发改名',exact:true}).click();
 await lab.getByRole('button',{name:'无版本保护回填',exact:true}).click();
 await lab.getByRole('button',{name:'核验当前数据',exact:true}).click();
 let state=await modelOf(lab);expect(state.verified).toBe(false);expect(state.rows[0].version).toBe(2);expect(state.rows[0].migratedVersion).toBe(1);
 await lab.getByRole('button',{name:'尝试删除旧列',exact:true}).click();expect((await modelOf(lab)).oldColumn).toBe(true);
 await lab.getByRole('button',{name:'读取回填批次',exact:true}).click();
 await lab.getByRole('button',{name:'按版本安全回填',exact:true}).click();
 await lab.getByRole('button',{name:'核验当前数据',exact:true}).click();
 state=await modelOf(lab);expect(state.verified).toBe(true);expect(state.rows[0].given).toBe('小敏');
});
if(ids.includes(195))test('195 pricing gate pauses canary and rollback retains written side effects',async({page})=>{
 const lab=await open(page,195);
 await lab.getByLabel('预计结果').selectOption({label:'小流量后暂停'});await lab.getByLabel('预测依据').fill('金额异常应阻止放量，CPU不是业务证据。');
 await lab.getByRole('button',{name:'记录本轮预测',exact:true}).click();await steps(lab,3);
 let state=await modelOf(lab);expect(state.phase).toBe('paused');expect(state.traffic).toBe(5);expect(state.badOrders).toBe(4);
 await lab.getByRole('button',{name:'回切旧版本',exact:true}).click();
 state=await modelOf(lab);expect(state.traffic).toBe(0);expect(state.badOrders).toBe(4);
});
if(ids.includes(196))test('196 code rollback cannot read migrated money; forward repair reconciles every order',async({page})=>{
 const lab=await open(page,196);
 await lab.getByLabel('完成本轮恢复后').selectOption('fail');await lab.getByLabel('依据',{exact:true}).fill('数据格式变化需要单独恢复和逐笔核账。');await steps(lab,6);
 expect((await modelOf(lab)).unreadableIds.length).toBeGreaterThan(0);
 await lab.locator('[data-delivery-action=reset]').click();await lab.getByLabel('恢复路径').selectOption('forward');await steps(lab,6);
 const state=await modelOf(lab);expect(state.passed).toBe(true);expect(state.rows).toHaveLength(4);expect(state.mismatchIds).toEqual([]);
});
if(ids.includes(197))test('197 rejected shared update poisons readers; immutable snapshot preserves old request',async({page})=>{
 const lab=await open(page,197);
 await lab.getByRole('combobox',{name:'你的判断',exact:true}).selectOption('changed');await lab.getByLabel('理由',{exact:true}).fill('共享对象的字段在校验前已被写入。');await steps(lab,5);
 let state=await modelOf(lab);expect(state.validation).toBe('rejected');expect(state.requestA.limit).toBe(-1);
 await lab.locator('[data-delivery-action=reset]').click();await lab.getByRole('button',{name:'修复为完整快照发布',exact:true}).click();await steps(lab,5);
 state=await modelOf(lab);expect(state.requestA.limit).toBe(2);expect(state.requestB.limit).toBe(7);expect(state.resource).toBe('db-a');expect(state.resourceMatches).toBe(false);
});
if(ids.includes(198))test('198 moving latest loses identity; pinned digest and build record restore trace but not reproduction',async({page})=>{
 const lab=await open(page,198);
 async function predict(){await lab.getByLabel('覆盖 latest 后，保存的证据能否定位生产内容？').selectOption('no');await lab.getByLabel('你的依据').fill('可变标签不会保留部署时的内容身份。')}
 await predict();await steps(lab,5);expect((await modelOf(lab)).assessment.identity).toBe(false);
 await lab.locator('[data-delivery-action=reset]').click();
 await lab.getByLabel('部署记录绑定内容摘要').check();await lab.getByLabel('保存源提交、dirty、工具链、依赖与构建参数').check();await predict();await steps(lab,5);
 const state=await modelOf(lab);expect(state.assessment.identity).toBe(true);expect(state.assessment.source).toBe(true);expect(state.assessment.reproducible).toBe(false);
});
if(ids.includes(199))test('199 changed constraints yield a linked replacement without erasing historic rationale',async({page})=>{
 const lab=await open(page,199);const before=(await modelOf(lab)).records[0];
 await lab.getByLabel('组织要求',{exact:true}).selectOption('merged');await lab.getByLabel('绑定当前组织约束').check();await lab.getByLabel('绑定本次实测成本').check();
 await lab.getByLabel('本次方案',{exact:true}).selectOption('modular');await lab.getByLabel(/^明确接受/).check();
 await lab.getByLabel('我的权衡理由',{exact:true}).fill('  团队合并后接受共同发布，保留模块边界。  ');await steps(lab,2);
 const state=await modelOf(lab);expect(state.records).toHaveLength(2);expect(state.records[0].status).toBe('superseded');expect(state.records[0].rationale).toBe(before.rationale);expect(state.records[1].supersedes).toBe('ADR-001');expect(state.records[1].rationale).toBe('  团队合并后接受共同发布，保留模块边界。  ');
});
if(ids.includes(200))test('200 evidence changes the migration decision and hard constraints cannot be offset by performance',async({page})=>{
 const lab=await open(page,200);
 async function predict(){await lab.getByLabel('你预计本轮该怎么做？').selectOption('rollback');await lab.getByLabel('为什么？请联系瓶颈、成本或硬约束').fill('先验证改善，再检查成本与隔离边界。')}
 await predict();await steps(lab,4);expect((await modelOf(lab)).outcome.decision).toBe('rollback');
 await lab.locator('[data-delivery-action=reset]').click();await lab.getByLabel('本轮执行路线').selectOption('repair');await predict();await steps(lab,4);
 expect((await modelOf(lab)).outcome.decision).toBe('expand');
 await lab.locator('[data-delivery-action=reset]').click();await lab.getByLabel('必须独立身份与数据边界').check();await predict();await steps(lab,4);
 const state=await modelOf(lab);expect(state.outcome.isolationMet).toBe(false);expect(state.outcome.decision).not.toBe('expand');
});
