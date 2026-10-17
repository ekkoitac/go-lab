import {test,expect,type Page} from '@playwright/test';
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('io-lab-'+id);
 await expect(lab).toBeVisible();return lab;
}
for(const width of [1440,390])test(`61–70 observation and four distinct help modes at ${width}px`,async({page})=>{
 test.setTimeout(240000);await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[],attempts:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
 for(const id of (process.env.IO_TEST_IDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>61+i))){
  const lab=await open(page,id);await expect(lab.getByTestId('live-model').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`observation overflow ${id}`).toBe(true);
  const editor=await page.locator('.cm-content').first().textContent();
  for(const name of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   const help=page.locator('.help-content').getByTestId('io-help-'+id);await expect(help).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`help overflow ${id}/${name}`).toBe(true);
   if(name==='画图'){
    await expect(help.locator('svg').first()).toBeVisible();
    const clipped=await help.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
     const text=node as SVGGraphicsElement,svg=text.ownerSVGElement!;const b=text.getBoundingClientRect(),v=svg.getBoundingClientRect();
     return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
    }).map(n=>n.textContent));expect(clipped,`SVG clipped ${id}`).toEqual([]);
   }
   expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
  }
  await page.getByRole('button',{name:'收起帮助',exact:true}).click();
  if([61,65,69,70].includes(id))await lab.screenshot({path:`.runtime/io-lab-${id}-${width}.png`,animations:'disabled'});
 }
 expect(errors).toEqual([]);expect(attempts).toEqual([]);
});

test('61 Read: partial data survives errors, zero EOF differs from no progress; replay resets prediction',async({page})=>{
 const lab=await open(page,61),model=lab.getByTestId('live-model');
 for(const [kind,policy,prediction,saved,status] of [
  ['final','error-first','0','','eof'],['final','data-first','3','XYZ','eof'],
  ['partial','data-first','2','AB','error'],['eof','data-first','0','','eof'],['empty','data-first','0','','no-progress'],
 ]){
  await lab.getByLabel('Reader 本次返回').selectOption(kind);await lab.getByLabel(/^处理顺序/).selectOption(policy);
  await expect(lab.locator('[data-io-action=step]')).toBeDisabled();
  await lab.getByLabel('预测消费字节数').selectOption(prediction);await lab.getByLabel('判断依据').fill('有效数据由 n 指定，先消费再解释 err');
  await lab.locator('[data-io-action=step]').focus();await page.keyboard.press('Enter');
  for(let i=0;i<2;i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.saved).toBe(saved);expect(final.status).toBe(status);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
 await lab.locator('[data-io-action=reset]').click();await expect(lab.getByLabel('预测消费字节数')).toHaveValue('');
 expect(JSON.parse((await model.getAttribute('data-state'))!).phase).toBe(0);
});

test('62 initialization failure preserves original error only with proper check; success closes owned resource',async({page})=>{
 const lab=await open(page,62),model=lab.getByTestId('live-model');
 for(const [result,policy,prediction,readCalls,closeCalls] of [
  ['missing','ignore','secondary',1,1],['denied','early','early-close',0,1],['missing','checked','original',0,0],['success','checked','success',1,1],
 ] as const){
  await lab.getByLabel('打开条件').selectOption(result);await lab.getByLabel('代码策略').selectOption(policy);
  await lab.getByLabel('我的判断').selectOption(prediction);await lab.getByLabel('依据是什么？').fill('只在资源取得成功后注册清理和读取');
  await lab.getByRole('button',{name:'记录预测并执行 Open',exact:true}).click();
  for(let i=0;i<12&&await lab.locator('[data-io-action=step]').isEnabled();i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.done).toBe(true);expect(final.readCalls).toBe(readCalls);expect(final.closeCalls).toBe(closeCalls);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('63 defer function boundary controls peak resources and LIFO cleanup',async({page})=>{
 const lab=await open(page,63),model=lab.getByTestId('live-model');
 for(const scope of ['outer','iteration']){
  await lab.getByLabel('defer 所在函数').selectOption(scope);await lab.getByLabel('文件数量').selectOption('4');await lab.getByLabel('同时打开上限').selectOption('2');
  await lab.getByLabel('整个批次会怎样？').selectOption(scope==='outer'?'limit':'complete');await lab.getByLabel('同时打开的峰值').fill(scope==='outer'?'2':'1');await lab.getByLabel('理由：哪个函数返回时才会关闭？').fill('函数返回而不是循环结束才执行defer');
  await lab.getByRole('button',{name:'记录预测，解锁执行',exact:true}).click();await lab.locator('[data-io-action=step]').click();
  expect(JSON.parse((await model.getAttribute('data-state'))!).open).toEqual([1]);
  await lab.getByRole('button',{name:'运行到底并核对',exact:true}).click();const final=JSON.parse((await model.getAttribute('data-state'))!);
  expect(final.processed).toBe(scope==='outer'?2:4);expect(final.peak).toBe(scope==='outer'?2:1);expect(final.open).toEqual([]);expect(final.closed).toEqual(scope==='outer'?[2,1]:[1,2,3,4]);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('64 Write and Flush expose errors at different layers; failed Flush retains unsent bytes',async({page})=>{
 const lab=await open(page,64),model=lab.getByTestId('live-model');
 for(const [input,budget,prediction,target,remaining] of [['ABC','0','flush-error','', 'ABC'],['ABC','2','flush-error','AB','C'],['ABCDEF','2','write-error','AB',''],['ABC','20','success','ABC','']]){
  await lab.getByLabel('输入字节',{exact:true}).selectOption(input);await lab.getByLabel('底层可接收字节',{exact:true}).selectOption(budget);
  await lab.getByLabel('我的预测',{exact:true}).selectOption(prediction);await lab.getByLabel('预测理由',{exact:true}).fill('先判断数据是否仍在缓冲，再检查底层写入的返回值');
  for(let i=0;i<4;i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.target).toBe(target);expect(final.buffer).toBe(remaining);expect(final.calls).toBe(1);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('65 N+1 distinguishes exact limit from truncation and prioritizes non-EOF read errors',async({page})=>{
 const lab=await open(page,65),model=lab.getByTestId('live-model');
 for(const [length,fault,verdict] of [[4,false,'accept'],[5,false,'oversize'],[0,false,'accept'],[8,true,'error']] as const){
  await lab.getByLabel(/^输入长度/).fill(String(length));await lab.getByLabel(/^业务上限 N/).fill('4');await lab.getByLabel('第 2 字节同批返回读取错误').setChecked(fault);
  await lab.getByLabel('你的判断').selectOption(verdict);await lab.getByLabel('预测理由').fill('第N+1字节证明超限，读取错误优先于接受部分数据');
  for(let i=0;i<16&&await lab.locator('[data-io-action=step]').isEnabled();i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.probe.done).toBe(true);expect(final.probe.verdict).toBe(verdict);
  if(length===5)expect(final.limited.verdict).toBe('accept');
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('66 overall budget includes body; earliest deadline wins and cancellation does not roll back remote work',async({page})=>{
 const lab=await open(page,66),model=lab.getByTestId('live-model');
 for(const [client,context,body,prediction] of [['5','0','8','client'],['10','4','8','context'],['0','0','stalled','waiting'],['5','0','5','race']]){
  await lab.getByLabel(/^Client.Timeout/).selectOption(client);await lab.getByLabel(/^context 截止/).selectOption(context);await lab.getByLabel(/^响应体完成时间/).selectOption(body);
  await lab.getByLabel('预测等待结果').selectOption(prediction);await lab.getByLabel('预测依据').fill('总体预算覆盖Body，最早截止结束本地等待');
  for(let i=0;i<12;i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.outcome).toBe(prediction);expect(final.remote).toBe('已提交副作用');
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
 await lab.getByLabel(/^Client.Timeout/).selectOption('0');await lab.getByLabel(/^响应体完成时间/).selectOption('stalled');
 await lab.getByLabel('预测等待结果').selectOption('waiting');await lab.getByLabel('预测依据').fill('取消后远端可继续工作');
 await lab.locator('[data-io-action=step]').click();await lab.getByRole('button',{name:'现在取消请求',exact:true}).click();await lab.locator('[data-io-action=step]').click();
 expect(JSON.parse((await model.getAttribute('data-state'))!).outcome).toBe('cancel');expect(JSON.parse((await model.getAttribute('data-state'))!).remote).toBe('已提交副作用');
});

test('67 EOF and Close are independent; bounded reads can deliberately forgo reuse',async({page})=>{
 const lab=await open(page,67),model=lab.getByTestId('live-model');
 for(const [budget,policy,prediction,eof,closed] of [['2','read-close','released',false,true],['4','read-close','candidate',true,true],['4','read','open',true,false],['4','close','released',false,true]] as const){
  await lab.getByLabel('Body 大小',{exact:true}).selectOption('4');await lab.getByLabel('读取预算',{exact:true}).selectOption(budget);await lab.getByLabel('处理策略',{exact:true}).selectOption(policy);
  await lab.getByLabel('我的预测',{exact:true}).selectOption(prediction);await lab.getByLabel('预测理由',{exact:true}).fill('EOF与Close分别满足不同责任，复用只是候选');
  for(let i=0;i<10&&await lab.locator('[data-io-action=step]').isEnabled();i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.done).toBe(true);expect(final.eof).toBe(eof);expect(final.closed).toBe(closed);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('68 Transport identity owns pools; reuse also requires valid connection conditions',async({page})=>{
 const lab=await open(page,68),model=lab.getByTestId('live-model');
 for(const [strategy,drain,keepAlive,opened,pools] of [['isolated',true,true,3,3],['shared',true,true,1,1],['default',true,true,1,1],['shared',false,true,3,1],['default',true,false,3,1]] as const){
  await lab.getByLabel('连接池配置',{exact:true}).selectOption(strategy);await lab.getByLabel('关闭前读到 EOF').setChecked(drain);await lab.getByLabel('服务器保持连接').setChecked(keepAlive);
  await lab.getByLabel('预测新建连接数').selectOption(String(opened));await lab.getByLabel('预测理由',{exact:true}).fill('同一Transport才共享池，EOF和连接存活决定能否复用');
  for(let i=0;i<9;i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.opened).toBe(opened);expect(final.pools).toHaveLength(pools);expect(final.reused).toBe(3-opened);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('69 Equal compares instants while == also includes location identity',async({page})=>{
 const lab=await open(page,69),model=lab.getByTestId('live-model');
 for(const [a,b,delta,prediction] of [['utc','east','0','true/false'],['east','twin','0','true/false'],['east','east','0','true/true'],['utc','east','-480','false/false']]){
  await lab.getByLabel(/^A 的位置对象/).selectOption(a);await lab.getByLabel(/^B 的位置对象/).selectOption(b);await lab.getByLabel('B 相对 A 的瞬间差').fill(delta);
  await lab.getByLabel('预测两个比较结果').selectOption(prediction);await lab.getByLabel('时间比较预测理由').fill('Equal先比较瞬间，结构相等还要求位置对象一致');
  for(let i=0;i<3;i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(`${final.equal}/${final.structEqual}`).toBe(prediction);
  if(delta==='-480')expect(final.aDisplay.clock).toBe(final.bDisplay.clock);
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
});

test('70 Stop leaves C open, cancellation exits select, and ready cancellation has no priority',async({page})=>{
 const lab=await open(page,70),model=lab.getByTestId('live-model');
 for(const [policy,prediction] of [['stop','both-waiting'],['both','select-exited'],['cancel','source-running']]){
  await lab.getByLabel('结束策略',{exact:true}).selectOption(policy);await lab.getByLabel('我的预测',{exact:true}).selectOption(prediction);await lab.getByLabel('预测理由',{exact:true}).fill('Stop只停止事件源，Done必须由消费者观察');
  for(let i=0;i<8&&await lab.locator('[data-io-action=step]').isEnabled();i++)await lab.locator('[data-io-action=step]').click();
  const final=JSON.parse((await model.getAttribute('data-state'))!);expect(final.channel).toBe('open');expect(final.range).toBe('waiting');expect(final.select).toBe(policy==='stop'?'waiting':'exited');expect(final.active).toBe(policy==='cancel');
  await lab.locator('[data-io-action=back]').click();await lab.locator('[data-io-action=step]').click();expect(JSON.parse((await model.getAttribute('data-state'))!)).toEqual(final);
 }
 await page.locator('.help-panel').getByRole('button',{name:'画图',exact:true}).click();const help=page.getByTestId('io-help-70');
 for(const choice of ['tick','done']){
  await help.getByRole('button',{name:'重置关系图',exact:true}).click();await help.getByLabel('同时就绪时本次分支').selectOption(choice);
  await help.getByRole('button',{name:'推进一个周期',exact:true}).click();await help.getByRole('button',{name:'图中 cancel',exact:true}).focus();await page.keyboard.press('Enter');await help.getByRole('button',{name:'运行 worker 一步',exact:true}).click();
  const state=JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!);expect(state.select).toBe(choice==='tick'?'processing':'exited');expect(state.range).toBe('processing');
 }
});

test('all ten diagram help modes change their model through a meaningful action',async({page})=>{
 const names:Record<number,string>={61:'追踪下一节点',62:'沿箭头执行',63:'单步执行',64:'推进流程',65:'切换 N 与 N+1 预算闸门',66:'推进图中时钟',67:'读取一个字节',68:'推进图中请求',69:'单步比较',70:'推进一个周期'};
 for(let id=61;id<=70;id++){
  await open(page,id);await page.locator('.help-panel').getByRole('button',{name:'画图',exact:true}).click();const help=page.getByTestId('io-help-'+id),model=help.getByTestId('live-model').first();
  const before=await model.getAttribute('data-state');const action=help.getByRole('button',{name:names[id],exact:true});await action.focus();await page.keyboard.press('Enter');
  await expect(model).not.toHaveAttribute('data-state',before!);
 }
});

test('all ten try modes require a prediction, run to feedback and never write formal answers',async({page})=>{
 test.setTimeout(120000);const attempts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))attempts.push(r.url());});
 const guesses:Record<number,string>={61:'0',62:'early-close',63:'limit',64:'write-error',65:'accept',66:'context',67:'released',68:'4',69:'true/false',70:'source-running'};
 for(let id=61;id<=70;id++){
  await open(page,id);await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();const help=page.getByTestId('io-help-'+id);
  const submit=id===62?help.getByRole('button',{name:'提交判断并揭晓',exact:true}):id===63?help.getByRole('button',{name:'记录预测，解锁执行',exact:true}):id===65?help.getByRole('button',{name:'提交预测并揭晓',exact:true}):help.locator('[data-io-action=step]').first();await expect(submit).toBeDisabled();
  const field=help.locator('fieldset').first();await field.locator('select').first().selectOption(guesses[id]);
  const text=field.locator('textarea,input:not([type=number]):not([type=range])').first();await text.fill('根据新的输入和资源边界先判断，再用模型验证');
  if(id===63){await field.locator('input[type=number]').fill('2');await help.getByRole('button',{name:'记录预测，解锁执行',exact:true}).click();await help.getByRole('button',{name:'运行到底并核对',exact:true}).click();}
  else if(id===62)await help.getByRole('button',{name:'提交判断并揭晓',exact:true}).click();
  else if(id===65)await help.getByRole('button',{name:'提交预测并揭晓',exact:true}).click();
  else {
   const step=help.locator('[data-io-action=step]').first();for(let n=0;n<20&&await step.isEnabled();n++)await step.click();await expect(step).toBeDisabled();
  }
  await expect(help.getByTestId('live-model').first()).toBeVisible();
  await expect(help).toContainText(/预测|判断/);
 }
 expect(attempts).toEqual([]);
});
