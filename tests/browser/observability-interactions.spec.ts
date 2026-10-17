import {test, expect, type Page} from '@playwright/test';
async function open(page:Page,id:number){
  await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.getByTestId('observability-lab-'+id);await expect(lab).toBeVisible();return lab;
}
test('171 maturity and late completion are distinct from HTTP acceptance',async({page})=>{
  const lab=await open(page,171),step=lab.locator('[data-obs-action=step]');
  await expect(step).toBeDisabled();
  await lab.getByRole('combobox',{name:/^预测/}).selectOption('2/5');
  await lab.getByLabel('推理依据').fill('A 和预期拒绝 C 及时；五个合格受理事件成熟。');
  await lab.getByRole('button',{name:'记录预测，开始观察'}).click();
  for(let i=0;i<4;i++)await step.click();
  let state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.denominator).toBe(0);
  await step.click();state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.denominator).toBe(2);
  await step.click();state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);expect(state.denominator).toBe(5);expect(state.good).toBe(2);
  await lab.locator('[data-obs-action=back]').click();expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!).denominator).toBe(2);
  await lab.locator('[data-obs-action=reset]').click();await expect(step).toBeDisabled();
});
test('172 recovered and sparse evidence do not page the operator',async({page})=>{
  const lab=await open(page,172);
  for(const [preset,answer,outcome] of [['旧故障已恢复','observe','继续观察'],['凌晨 2 次请求错 1 次','insufficient','证据不足'],['持续快速消耗','page','唤醒值班（分页）']]){
    await lab.getByRole('button',{name:preset,exact:true}).click();
    await lab.getByLabel('最终行动').selectOption(answer);
    await lab.getByPlaceholder('说明长短窗口如何共同影响行动').fill('分别核对两个窗口的请求量和燃烧率。');
    for(let i=0;i<3;i++)await lab.locator('[data-obs-action=step]').click();
    await expect(lab.getByTestId('live-model').getByRole('heading',{name:outcome,exact:true})).toBeVisible();
  }
});
test('173 changing sampled request keeps population metrics and shows missing evidence',async({page})=>{
  const lab=await open(page,173);
  await lab.getByLabel('增加重试预算到两次后，慢订单最可能怎样？').selectOption('tail');
  await lab.getByPlaceholder('重试执行与退避等待分别会增加什么？').fill('重试与等待只增加冲突请求的尾延迟。');
  await lab.getByRole('button',{name:'锁定预测与理由'}).click();
  for(let i=0;i<3;i++)await lab.locator('[data-obs-action=step]').click();
  const model=lab.getByTestId('live-model');await expect(model).toContainText('520 ms');
  await lab.getByRole('button',{name:/重试退避 1：/}).click();await expect(model).toContainText('retry.scheduled');
  const before=JSON.parse((await model.getAttribute('data-state'))!).metrics;
  await lab.getByLabel('待查请求').selectOption('missing');await expect(model).toContainText('缺少 Trace 不能证明请求未发生');
  expect(JSON.parse((await model.getAttribute('data-state'))!).metrics).toEqual(before);
});async function state(lab:import('@playwright/test').Locator){return JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!);}
test('174 query stripping and route templates have different cardinality',async({page})=>{
  const lab=await open(page,174);
  for(const value of ['yes','no']){
    await lab.getByLabel('预测：模板指标会新增时序吗？').selectOption(value);
    await lab.getByPlaceholder('比较路由、状态以及租户维度').fill('同一模板和状态，query变化不创建模板新组合');
    await lab.locator('[data-obs-action=step]').click();
  }
  const s=await state(lab);expect(s.cursor).toBe(2);
  const results=Object.values(s.results) as {observed:number}[];expect(results.map(r=>r.observed)).toEqual([2,1,1]);
  await lab.locator('[data-obs-action=back]').click();expect((await state(lab)).cursor).toBe(1);
});
test('175 derived context repairs global cross-talk but queue metadata is still required',async({page})=>{
  const lab=await open(page,175);
  async function run(){await lab.getByPlaceholder('先写下因果解释，再锁定预测').fill('请求值、消息元数据和消费者取消拥有者分开');await lab.getByRole('button',{name:'锁定预测',exact:true}).click();for(let i=0;i<7;i++)await lab.locator('[data-obs-action=step]').click();return state(lab);}
  expect((await run()).workerID).toBe('req-B');
  await lab.getByLabel('子调用如何取 ID').selectOption('derived');let s=await run();expect(s.workerID).toBe('req-A');expect(s.workerStatus).toBe('running');expect(s.authorized).toBe(false);
  await lab.getByLabel('队列载荷').selectOption('no');s=await run();expect(s.workerID).toBe('');expect(s.workerStatus).toBe('running');
});
test('176 adding a head prefilter loses errors that tail sampling cannot recover',async({page})=>{
  const lab=await open(page,176);
  async function run(){await lab.getByLabel('采样结果预测').selectOption('tail');await lab.getByLabel('采样预测理由').fill('入口丢弃之后没有终态可供尾部恢复');for(let i=0;i<9;i++)await lab.locator('[data-obs-action=step]').click();return state(lab);}
  expect((await run()).tailErrors).toBeGreaterThan(0);
  await lab.locator('[data-obs-action=reset]').click();await lab.getByLabel('尾采之前也经过头采').check();const s=await run();expect(s.tailErrors).toBe(0);
});
test('177 cancellation selection and completion are separate transitions',async({page})=>{
  const lab=await open(page,177);await lab.getByLabel('生产者数量').selectOption('1');await lab.getByLabel('发送策略').selectOption('select');await lab.getByLabel('初始接收者').selectOption('false');
  await lab.getByRole('button',{name:'发出 cancel',exact:true}).click();expect((await state(lab)).done).toBe(0);
  for(const prediction of ['取消分支，等待清理','清理完成，done 增加']){await lab.getByLabel('预测变化').selectOption(prediction);await lab.getByPlaceholder('接收者、缓冲余量、取消或清理阶段').fill('收到取消先走清理，再关闭完成信号');await lab.locator('[data-obs-action=step]').click();if(prediction.startsWith('取消'))expect((await state(lab)).done).toBe(0);}
  expect((await state(lab)).done).toBe(1);
  await lab.locator('[data-obs-action=back]').click();expect((await state(lab)).done).toBe(0);
});
test('178 management network alone does not authorize diagnostic collection',async({page})=>{
  const lab=await open(page,178);await lab.getByLabel('入口方案').selectOption('guarded');await lab.getByLabel('请求来源').selectOption('internal');
  async function run(){await lab.getByLabel('预测最终请求结果').selectOption('deny');await lab.getByPlaceholder('哪个节点会放行或拦截？采集是否适合症状？').fill('必须通过管理入口和诊断权限检查');for(let i=0;i<4&&await lab.locator('[data-obs-action=step]').isEnabled();i++)await lab.locator('[data-obs-action=step]').click();return state(lab);}
  expect((await run()).outcome).toBe('deny');await lab.getByLabel('诊断身份').selectOption('true');expect((await run()).outcome).toBe('collect');
});
test('179 wall-clock correction does not create causal evidence',async({page})=>{
  const lab=await open(page,179);const before=await state(lab);await lab.getByRole('button',{name:'试用 −3000 ms 校正'}).click();expect((await state(lab)).edges).toEqual(before.edges);
  for(const choice of ['unknown','before','once']){await lab.locator('.obs179-predict select').selectOption(choice);await lab.getByPlaceholder('指出需要哪条证据；不要只说时间更早。').fill('消息和父事件形成因果链，凭证区分重投与副作用');await lab.locator('[data-obs-action=step]').click();}
  const s=await state(lab);expect(s.orderToPayment).toBe('before');expect(s.auditToPayment).toBe('unknown');expect(s.charges).toBe(1);
});
test('180 revoking injection retains in-flight work and requires recovery acceptance',async({page})=>{
  const lab=await open(page,180);await lab.getByLabel('预测：达到停止阈值后').selectOption('residual');await lab.getByPlaceholder('说明延迟请求占用的槽会如何释放').fill('撤销仅影响后续输入，在途请求仍需完成');
  await lab.locator('[data-obs-action=step]').click();await lab.getByRole('button',{name:'立即撤销注入',exact:true}).click();let s=await state(lab);expect(s.phase).toBe('recovering');expect(s.slow).toBeGreaterThan(0);await expect(lab.getByRole('button',{name:'负责人验收恢复',exact:true})).toBeDisabled();
  for(let i=0;i<15&&(await state(lab)).healthyTicks<2;i++)await lab.locator('[data-obs-action=step]').click();
  await lab.getByRole('button',{name:'负责人验收恢复',exact:true}).click();expect((await state(lab)).phase).toBe('complete');
});