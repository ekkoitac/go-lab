import {test,expect,type Page,type Locator} from '@playwright/test';
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('architecture-lab-'+id);
 await expect(lab).toBeVisible();return lab;
}
async function fits(page:Page,root:Locator,context:string){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),context+' page overflow').toBe(true);
 expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),context+' panel overflow').toBe(true);
 const clipped=await root.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
  const text=node as SVGGraphicsElement,svg=text.ownerSVGElement!;
  const b=text.getBoundingClientRect(),v=svg.getBoundingClientRect();
  return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
 }).map(n=>n.textContent));expect(clipped,context+' clipped SVG labels').toEqual([]);
}
const ids=process.env.ARCH_TEST_IDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>101+i);
for(const width of [1440,390])test(`101–110 dedicated observations and independent help at ${width}px`,async({page})=>{
 test.setTimeout(240000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[],attempts:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
 for(const id of ids){
  const lab=await open(page,id),model=lab.getByTestId('live-model').first();
  await expect(model).toBeVisible();await fits(page,lab,`${id} observation`);
  const initial=await model.getAttribute('data-state');expect(initial).toBeTruthy();
  const step=lab.locator('[data-arch-action=step]').first();
  if(await step.count()){
   await expect(step).toBeEnabled();await step.focus();await page.keyboard.press('Enter');
   await expect(model).not.toHaveAttribute('data-state',initial!);
   const after=await model.getAttribute('data-state'),back=lab.locator('[data-arch-action=back]').first();
   if(await back.count()){
    await back.click();await expect(model).toHaveAttribute('data-state',initial!);
    await step.click();await expect(model).toHaveAttribute('data-state',after!);
   }
   await lab.locator('[data-arch-action=reset]').first().click();
   await expect(model).toHaveAttribute('data-state',initial!);
  }
  const before=await model.getAttribute('data-state');
  const notebook=await page.getByRole('textbox',{name:'架构决策记录'}).inputValue();
  const views:string[]=[];
  for(const name of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
   const help=page.getByTestId('architecture-help-'+id);await expect(help).toBeVisible();
   await fits(page,help,`${id} ${name}`);views.push(await help.innerText());
   await expect(help.getByTestId('architecture-lab-'+id)).toHaveCount(0);
   await expect(model).toHaveAttribute('data-state',before!);
   await expect(page.getByRole('textbox',{name:'架构决策记录'})).toHaveValue(notebook);
   if(name==='画图')await help.screenshot({path:`.runtime/architecture-labs/help-${id}-${width}.png`,animations:'disabled'});
  }
  expect(new Set(views).size,`${id} distinct help views`).toBe(4);
  await page.getByRole('button',{name:'收起帮助',exact:true}).click();
  await lab.screenshot({path:`.runtime/architecture-labs/lab-${id}-${width}.png`,animations:'disabled'});
 }
 expect(errors).toEqual([]);expect(attempts).toEqual([]);
});

async function readModel(lab:Locator){return JSON.parse((await lab.getByTestId('live-model').first().getAttribute('data-state'))!)}
async function run(lab:Locator,count:number){for(let i=0;i<count;i++)await lab.locator('[data-arch-action=step]').first().click()}
if(ids.includes(101))test('101 rollout exposes mixed contracts; bridge repairs it and scaling changes resource geometry',async({page})=>{
 const lab=await open(page,101);await run(lab,1);await expect(lab.locator('.arch101-request')).toContainText('契约拒绝');
 await lab.getByLabel('为新旧契约增加兼容桥接').check();await run(lab,1);await expect(lab.locator('.arch101-request')).toContainText('可完成');
 await lab.getByLabel('部署方式').selectOption('monolith');await run(lab,1);await expect(lab.locator('.arch101-node.updated')).toHaveCount(3);
 await lab.getByLabel('结算需 4 个副本，其余只需 1 个').check();await expect(lab.locator('.arch101-metrics')).toContainText('12');
 await lab.getByLabel('部署方式').selectOption('services');await expect(lab.locator('.arch101-node').last()).toContainText('4 个副本');await expect(lab.locator('.arch101-node').first()).toContainText('1 个副本');
});
if(ids.includes(102))test('102 ownership regrouping reduces coordination but shared writes still cross boundaries',async({page})=>{
 const lab=await open(page,102);await run(lab,3);expect((await readModel(lab)).owners).toHaveLength(3);
 await lab.getByRole('button',{name:'收拢订单能力',exact:true}).click();await run(lab,3);expect((await readModel(lab)).owners).toEqual(['订单团队']);
 await lab.getByLabel('支付也直接写订单价格（所有权泄漏）').check();await run(lab,4);expect((await readModel(lab)).owners).toEqual(['订单团队','支付团队']);
 await lab.getByLabel('这次要交付的变化').selectOption('search');await run(lab,2);expect((await readModel(lab)).owners).toEqual(['搜索平台']);
});
if(ids.includes(103))test('103 source cycle and runtime call are distinct; leaking implementation types restores the cycle',async({page})=>{
 const lab=await open(page,103);await run(lab,2);expect((await readModel(lab)).build).toBe(false);expect((await readModel(lab)).runtime).toEqual([]);
 await lab.getByLabel('修复方案').selectOption('port');await run(lab,2);expect((await readModel(lab)).build).toBe(true);expect((await readModel(lab)).runtime).toContain('notification.Send');
 await lab.getByLabel('传递的数据').selectOption('full');await run(lab,1);expect((await readModel(lab)).build).toBe(false);
});
if(ids.includes(104))test('104 smaller contract needs matching signatures and all actual consumer requirements',async({page})=>{
 const lab=await open(page,104);await run(lab,3);await expect(lab.locator('.a104-result')).toContainText('方法集合不满足');
 await lab.getByLabel('契约定义').selectOption('consumer');await run(lab,3);await expect(lab.locator('.a104-result')).toContainText('实际需求被覆盖');
 await lab.getByLabel('消费场景').selectOption('audit');await run(lab,3);await expect(lab.locator('.a104-result')).toContainText('契约缺少业务真正需要的 History');
 await lab.getByLabel('需求接口与替身 / 适配器增加 History').check();await run(lab,3);await expect(lab.locator('.a104-result')).toContainText('实际需求被覆盖');
 await lab.getByLabel('接入对象').selectOption('raw');await run(lab,3);await expect(lab.locator('.a104-result')).toContainText('返回 SDKMoney');
});
if(ids.includes(105))test('105 same rounding code can encode different promises; narrow sharing preserves both',async({page})=>{
 const lab=await open(page,105);await run(lab,3);expect((await readModel(lab)).marketing).toBe(100);expect((await readModel(lab)).marketingMatches).toBe(false);
 await lab.getByLabel('共享边界').selectOption('representation');await run(lab,3);expect((await readModel(lab)).marketing).toBe(101);expect((await readModel(lab)).settlement).toBe(100);
 await lab.getByLabel('变更请求').selectOption('currency');await lab.getByLabel('输入币种').selectOption('XYZ');await run(lab,3);expect((await readModel(lab)).marketing).toBeNull();expect((await readModel(lab)).settlement).toBeNull();
 await lab.getByLabel('已指定共同维护者与兼容测试责任').uncheck();await run(lab,1);expect((await readModel(lab)).blocked).toBe(true);
});
if(ids.includes(106))test('106 go.work success is not proof of a build from published modules',async({page})=>{
 const lab=await open(page,106);await run(lab,4);expect((await readModel(lab)).local).toBe(true);expect((await readModel(lab)).clean).toBe(false);
 await lab.getByRole('button',{name:'修复：发布新版本并更新 require，重新验证',exact:true}).click();await run(lab,4);expect((await readModel(lab)).clean).toBe(true);
 await lab.getByLabel('源码组织').selectOption('single');await run(lab,4);expect((await readModel(lab)).modules).toBe(1);expect((await readModel(lab)).commands).toBe(3);expect((await readModel(lab)).clean).toBe(true);
});
if(ids.includes(107))test('107 saved refunds survive Ack failure; failed storage must not Ack',async({page})=>{
 const lab=await open(page,107);await lab.getByLabel('注入消息 Ack 失败').check();await run(lab,4);expect((await readModel(lab)).outcome).toBe('ack');expect((await readModel(lab)).committed).toBe(true);
 await lab.getByLabel('注入保存失败').check();await run(lab,4);expect((await readModel(lab)).committed).toBe(false);expect((await readModel(lab)).ackCalls).toBe(0);
 await lab.getByLabel('注入保存失败').uncheck();await lab.getByLabel('调用入口').selectOption('fake');await lab.getByLabel('核心结构').selectOption('coupled');await run(lab,4);expect((await readModel(lab)).outcome).toBe('blocked');
 await lab.getByLabel('核心结构').selectOption('ports');await run(lab,4);expect((await readModel(lab)).outcome).toBe('success');expect((await readModel(lab)).ackCalls).toBe(0);
});
async function finish(lab:Locator){const step=lab.locator('[data-arch-action=step]').first();for(let i=0;i<20&&await step.isEnabled();i++)await step.click();await expect(step).toBeDisabled()}
if(ids.includes(108))test('108 constructor failures clean up acquired resources in reverse order',async({page})=>{
 const lab=await open(page,108);await finish(lab);expect((await readModel(lab)).closed).toEqual(['DB']);expect((await readModel(lab)).active).toEqual([]);
 await lab.getByLabel('构造时故障').selectOption('Service');await finish(lab);expect((await readModel(lab)).closed).toEqual(['Client','DB']);
 await lab.getByLabel('装配点登记逆序清理').uncheck();await finish(lab);expect((await readModel(lab)).active).toEqual(['DB','Client']);
 await lab.getByLabel('移除 Client 提供者').check();await lab.getByLabel('装配方式').selectOption('runtime');await run(lab,1);expect((await readModel(lab)).stage).toBe('启动期图解析');expect((await readModel(lab)).built).toEqual([]);
});
if(ids.includes(109))test('109 panic crosses in-process boundary but RPC host survives the failed call',async({page})=>{
 const lab=await open(page,109);await run(lab,4);const s=(await readModel(lab)).snapshots;expect(s[0].host).toBe('已退出');expect(s[1].host).toBe('已退出');expect(s[2].host).toBe('运行中');expect(s[2].call).toBe('失败');
 await lab.getByLabel('扩展事件').selectOption('timeout');await finish(lab);const rpc=(await readModel(lab)).snapshots[2];expect(rpc.call).toBe('超时失败');expect(rpc.extension).toBe('已回收');
});
if(ids.includes(109))test('109 platform gates and real OS restrictions are distinct from process isolation',async({page})=>{
 const lab=await open(page,109);await lab.getByLabel('目标系统').selectOption('windows');await run(lab,1);expect((await readModel(lab)).snapshots[1].extension).toBe('装载被阻止');
 await lab.getByLabel('目标系统').selectOption('linux');await lab.getByLabel('扩展事件').selectOption('file');await run(lab,4);expect((await readModel(lab)).snapshots[2].file).toBe('读取成功');
 await lab.getByLabel('对子进程另行施加已验证的 OS 文件拒绝策略').check();await run(lab,4);expect((await readModel(lab)).snapshots[2].file).toBe('操作系统拒绝');expect((await readModel(lab)).snapshots[0].file).toBe('读取成功');
 await lab.getByLabel('RPC 双方都支持 v1（取消则扩展仅 v2）').uncheck();await finish(lab);expect((await readModel(lab)).snapshots[2].call).toContain('握手拒绝');expect((await readModel(lab)).snapshots[2].file).toBe('未访问');
});
if(ids.includes(110))test('110 shadow is read-only; route-only rollback does not restore data or shared deduplication',async({page})=>{
 const lab=await open(page,110);await run(lab,1);expect((await readModel(lab)).charges).toHaveLength(0);
 await finish(lab);expect((await readModel(lab)).charges).toHaveLength(4);expect((await readModel(lab)).duplicates).toBe(0);
 await lab.getByLabel('新旧共用有原子去重保证的扣款权威').uncheck();await lab.getByLabel('故障时的策略').selectOption('route');await finish(lab);expect((await readModel(lab)).charges).toHaveLength(5);expect((await readModel(lab)).duplicates).toBe(1);
 await lab.getByLabel('故障时的策略').selectOption('verified');await finish(lab);expect((await readModel(lab)).rollback).toContain('阻止回退');expect((await readModel(lab)).charges).toHaveLength(4);
 await lab.getByLabel('新旧共用有原子去重保证的扣款权威').check();await lab.getByLabel('新版写入保留旧读者可读的 v1 格式').uncheck();await lab.getByLabel('故障时的策略').selectOption('route');await finish(lab);expect((await readModel(lab)).oldCanRead).toBe(false);expect((await readModel(lab)).rollback).toContain('旧读者报错');expect((await readModel(lab)).charges).toHaveLength(4);
 await lab.getByLabel('新版错误地多算 B01 ¥20').check();await finish(lab);expect((await readModel(lab)).gate).toBe('blocked');expect((await readModel(lab)).charges.every((c:{writer:string})=>c.writer==='old')).toBe(true);
});
if(ids.includes(110))test('110 assisted transfer requires an answer before feedback and cannot mutate the experiment or formal attempts',async({page})=>{
 const attempts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url())});
 const lab=await open(page,110);await run(lab,3);const before=await lab.getByTestId('live-model').getAttribute('data-state');
 await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();await expect(page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true})).toHaveClass(/selected/);
 const help=page.getByTestId('architecture-help-110');await expect(help.locator('.a110-result')).toHaveCount(0);await expect(help.getByRole('button',{name:'提交判断',exact:true})).toBeDisabled();
 await help.getByRole('radio',{name:'停止放量并对账，验证数据兼容与跨版本去重后决策',exact:true}).check();await help.getByLabel('解释为什么').fill('切路由不能撤销已发生的扣款，要保留账本并验证旧读者和去重记录');await help.getByRole('button',{name:'提交判断',exact:true}).click();await expect(help.locator('.a110-result')).toContainText('判断符合约束');
 await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',before!);expect(attempts).toEqual([]);
});
