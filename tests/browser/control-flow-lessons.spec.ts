import {test,expect,type Page} from '@playwright/test';
// Cold development startup can prebundle the complete 200-lesson catalog.
test.setTimeout(180000);

async function openLesson(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('control-flow-lab-'+id);
 await expect(lab).toBeVisible();
 return lab;
}
for(const width of [1440,390,320])for(let id=31;id<=40;id++){
 test(`${id}: experiment and four help modes at ${width}px`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[],attempts:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
  const lab=await openLesson(page,id);
  const model=lab.getByTestId('live-model').first();
  await expect(model).toBeVisible();
  const initial=await model.getAttribute('data-state');
  expect(initial).toBeTruthy();
  const editor=await page.locator('.cm-content').first().textContent();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id} observation page overflow`).toBe(true);
  expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${id} observation overflow`).toBe(true);
  const views:string[]=[];
  for(const [name,mode] of [['举例子','example'],['画图','diagram'],['拆步骤','steps'],['让我试试','try']]){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   const help=page.locator(`[data-help-mode=${mode}]`).getByTestId('control-flow-help-'+id);
   await expect(help).toBeVisible();
   views.push(await help.innerText());
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id} ${mode} page overflow`).toBe(true);
   expect(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${id} ${mode} panel overflow`).toBe(true);
   expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
   if(mode==='diagram'){
    const clipped=await help.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
     const text=node as SVGGraphicsElement,svg=text.ownerSVGElement!;
     const b=text.getBoundingClientRect(),v=svg.getBoundingClientRect();
     return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
    }).map(n=>n.textContent));
    expect(clipped,`${id} diagram text clipped`).toEqual([]);
   }
  }
  expect(new Set(views).size).toBe(4);
  await expect(model).toHaveAttribute('data-state',initial!);
  expect(errors).toEqual([]);expect(attempts).toEqual([]);
  await page.getByRole('button',{name:'收起帮助',exact:true}).click();
  if([31,35,39,40].includes(id)&&width!==320)await lab.screenshot({path:`.runtime/control-flow-${id}-${width}.png`,animations:'disabled'});
 });
}
test('31: copy, index and reference writes are reversible and keyboard operable',async({page})=>{
 const lab=await openLesson(page,31),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 await lab.getByRole('button',{name:'单步执行',exact:true}).focus();await page.keyboard.press('Enter');
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).items[0].price).toBe(100);expect((await read()).current.price).toBe(90);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).current.price).toBe(100);
 await lab.getByLabel('循环体策略').selectOption('index');
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).items[0].price).toBe(90);expect((await read()).current.price).toBe(100);
 await lab.getByLabel('循环体策略').selectOption('reference');
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).heap.stock0).toBe(6);expect((await read()).items[0].price).toBe(100);
 await lab.getByRole('button',{name:'重置',exact:true}).click();expect((await read()).heap.stock0).toBe(5);
});

test('32: registration is not execution; changing declaration changes captured variables',async({page})=>{
 const lab=await openLesson(page,32),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 for(let i=1;i<=3;i++)await lab.getByRole('button',{name:'登记回调 '+i,exact:true}).click();
 expect((await read()).outputs).toEqual([]);
 await lab.getByRole('button',{name:'结束注册循环',exact:true}).click();
 for(let i=1;i<=3;i++)await lab.getByRole('button',{name:'执行回调 '+i,exact:true}).click();
 expect((await read()).outputs).toEqual([3,3,3]);
 await lab.getByRole('button',{name:'循环内 := · 每轮变量',exact:true}).click();expect((await read()).outputs).toEqual([1,2,3]);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).outputs).toEqual([1,2]);
 await lab.getByRole('button',{name:'重置过程',exact:true}).click();expect((await read()).outputs).toEqual([]);
 await lab.getByLabel('商品编号',{exact:true}).fill('4,9');await lab.getByRole('button',{name:'应用输入并重置',exact:true}).click();expect((await read()).values).toEqual([4,9]);
});

test('33: append changes queue length but not range boundary; prediction requires a reason',async({page})=>{
 const lab=await openLesson(page,33),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 for(let i=0;i<3;i++)await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).lanes.map((x:{tasks:unknown[]})=>x.tasks.length)).toEqual([2,2]);
 expect((await read()).lanes[0].initialLength).toBe(1);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).lanes[0].tasks).toHaveLength(1);
 for(let i=0;i<7;i++)await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).lanes.map((x:{processed:unknown[]})=>x.processed.length)).toEqual([1,2]);
 await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();
 const help=page.getByTestId('control-flow-help-33');
 await expect(help.getByRole('button',{name:'验证预测',exact:true})).toBeDisabled();
 await help.getByLabel('range 处理数量').selectOption('3');await help.getByLabel('动态队列处理数量').selectOption('6');
 await expect(help.getByRole('button',{name:'验证预测',exact:true})).toBeDisabled();
 await help.getByLabel('解释你的依据').fill('range保留初始长度3，动态队列继续处理3份复核任务，总数6小于上限8。');
 await help.getByRole('button',{name:'验证预测',exact:true}).click();await expect(help).toContainText('数量预测吻合');
});
test('34: deferred argument capture differs from closure reads',async({page})=>{
 const lab=await openLesson(page,34),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 for(const [strategy,output] of [['direct',0],['parameter',0],['closure',10]] as const){
  await lab.getByLabel('defer 写法').selectOption(strategy);
  for(let i=0;i<4;i++)await lab.getByRole('button',{name:'单步执行',exact:true}).click();
  expect((await read()).output).toBe(output);
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).output).toBeNull();
 }
 await lab.getByRole('button',{name:'重置',exact:true}).click();expect((await read()).phase).toBe('start');
});

test('35: arrange defer stack, flush before close, and retain cleanup errors',async({page})=>{
 const lab=await openLesson(page,35),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 async function finish(){
  for(let i=0;i<4;i++)await lab.getByRole('button',{name:'单步执行函数体',exact:true}).click();
  expect((await read()).executed).toHaveLength(0);
  await lab.getByRole('button',{name:'触发当前函数返回',exact:true}).click();
  for(let i=0;i<3;i++)await lab.getByRole('button',{name:'弹出下一项 defer',exact:true}).click();
 }
 await finish();expect((await read()).written).toBe(0);expect((await read()).errors).toHaveLength(1);
 await lab.getByRole('button',{name:'按依赖修复登记顺序',exact:true}).click();
 await finish();expect((await read()).written).toBe(3);expect((await read()).errors).toHaveLength(0);
 expect((await read()).executed.map((x:{op:string})=>x.op)).toEqual(['flush','close','report']);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).reports).toHaveLength(0);
 await lab.getByLabel('注入 Flush 写入错误').check();await finish();expect((await read()).written).toBe(0);expect((await read()).errors).toHaveLength(1);
});

test('36: result slot changes before caller receives named return',async({page})=>{
 const lab=await openLesson(page,36),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 for(let i=0;i<2;i++)await lab.getByRole('button',{name:/^下一步：/}).click();
 expect((await read()).local).toBe(2);expect((await read()).result).toBe(1);expect((await read()).caller).toBeNull();
 await lab.getByRole('button',{name:'具名返回 · n 就是返回槽',exact:true}).click();expect((await read()).result).toBe(2);
 await lab.getByRole('button',{name:/^下一步：/}).click();expect((await read()).caller).toBe(2);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).caller).toBeNull();
 await lab.getByRole('button',{name:'恢复基线',exact:true}).click();expect((await read()).step).toBe(0);
});
test('37: check before use preserves failure; Reader partial data survives EOF',async({page})=>{
 const lab=await openLesson(page,37),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 await lab.getByLabel('调用策略').selectOption('use-first');
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).phase).toBe('panic');expect((await read()).error).toBe('missing config');
 await lab.getByRole('button',{name:'修复：检查放前面',exact:true}).click();
 await lab.getByRole('button',{name:'单步执行',exact:true}).click();await lab.getByRole('button',{name:'单步执行',exact:true}).click();
 expect((await read()).outcome).toBe('load: missing config');expect((await read()).value).toBeNull();
 await page.locator('.help-panel').getByRole('button',{name:'画图',exact:true}).click();
 const help=page.getByTestId('control-flow-help-37'),flow=help.getByTestId('live-model');
 await help.getByLabel('消费顺序').selectOption('data-first');await help.getByRole('button',{name:'推进数据流',exact:true}).click();
 const state=JSON.parse((await flow.getAttribute('data-state'))!);expect(state.consumed).toBe(state.bytes);expect(state.consumed.length).toBeGreaterThan(0);
 await help.getByLabel('消费顺序').selectOption('error-first');await help.getByRole('button',{name:'推进数据流',exact:true}).click();
 const dropped=JSON.parse((await flow.getAttribute('data-state'))!);expect(dropped.consumed).toBe('');expect(dropped.dropped).toBe(dropped.bytes);
});
test('38: wrapping preserves identity, a text break stops search, and As extracts type',async({page})=>{
 const lab=await openLesson(page,38),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 const advance=async(n:number)=>{for(let i=0;i<n;i++)await lab.getByRole('button',{name:'检查下一层',exact:true}).click();};
 await advance(1);expect((await read()).found).toBe(false);
 await lab.getByRole('combobox',{name:'包装方式 1',exact:true}).selectOption('w');await advance(2);expect((await read()).found).toBe(true);
 await lab.getByRole('combobox',{name:'Is 的目标',exact:true}).selectOption('twin');await advance(2);expect((await read()).found).toBe(false);
 await lab.getByRole('combobox',{name:'根因类型',exact:true}).selectOption('stock');await lab.getByRole('button',{name:'As：提取 *StockError',exact:true}).click();
 await advance(2);expect((await read()).found).toBe(true);await expect(lab).toContainText('book-7');
 await lab.getByRole('combobox',{name:'包装层数',exact:true}).selectOption('3');await lab.getByRole('combobox',{name:'包装方式 2',exact:true}).selectOption('v');
 await advance(2);expect((await read()).found).toBe(false);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).found).toBeNull();
});

test('39: directly deferred catch recovers; wrapper and other goroutine cannot',async({page})=>{
 const lab=await openLesson(page,39),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 for(const [mode,outcome,value] of [['indirect','unhandled','nil'],['named','returned-failure','boom'],['other','unhandled','未调用']]){
  await lab.getByRole('combobox',{name:'恢复策略',exact:true}).selectOption(mode);
  for(let i=0;i<12;i++){if((await read()).phase==='done')break;await lab.getByRole('button',{name:'单步执行',exact:true}).click();}
  expect((await read()).outcome).toBe(outcome);expect((await read()).recoverValue).toBe(value);
  expect((await read()).afterPanicRan).toBe(false);expect((await read()).dirty).toBe(true);
  await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).phase).not.toBe('done');
 }
 await lab.getByRole('button',{name:'重置实验',exact:true}).click();expect((await read()).dirty).toBe(false);
});
test('40: layer responsibilities change duplicate logs and nested attempts without losing context',async({page})=>{
 const lab=await openLesson(page,40),model=lab.getByTestId('live-model');
 const read=async()=>JSON.parse((await model.getAttribute('data-state'))!);
 await lab.getByRole('button',{name:'执行到结束',exact:true}).click();expect((await read()).diagnosticLogs).toHaveLength(3);expect((await read()).physicalAttempts).toBe(1);
 for(const name of ['HTTP 边界','服务层','存储层'])await lab.getByRole('group',{name,exact:true}).getByLabel('本层总尝试次数（含初次）').selectOption('2');
 await lab.getByRole('button',{name:'执行到结束',exact:true}).click();expect((await read()).physicalAttempts).toBe(8);expect((await read()).diagnosticLogs).toHaveLength(7);
 await lab.getByRole('button',{name:'修复：边界记录和统一预算',exact:true}).click();await lab.getByRole('button',{name:'执行到结束',exact:true}).click();
 expect((await read()).physicalAttempts).toBe(3);expect((await read()).diagnosticLogs).toHaveLength(1);expect((await read()).error).toContain('order: db read: offline');
 await lab.getByLabel('独立失败请求数').selectOption('2');await lab.getByLabel('每请求独立访问审计 1 条').check();await lab.getByRole('button',{name:'执行到结束',exact:true}).click();
 expect((await read()).diagnosticLogs).toHaveLength(2);expect((await read()).auditEvents).toHaveLength(2);expect((await read()).physicalAttempts).toBe(6);
 await lab.getByRole('button',{name:'回退一步',exact:true}).click();expect((await read()).phase).toBe('respond');
 await lab.getByRole('button',{name:'重置',exact:true}).click();expect((await read()).diagnosticLogs).toEqual([]);
});