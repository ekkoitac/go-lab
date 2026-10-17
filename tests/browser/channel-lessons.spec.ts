import {test,expect,type Page} from '@playwright/test';

test.setTimeout(120000);
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId(`lesson${id}-lab`);
 await expect(lab).toBeVisible();
 return lab;
}
for(const ids of [[51,52,53],[54,55,56],[57,58],[59,60]]){
 test(`dedicated lessons ${ids.join(',')}: four distinct help views keep assessment separate`,async({page})=>{
  const errors:string[]=[],assessments:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))assessments.push(r.url())});
  for(const id of ids){
   const lab=await open(page,id);
   const initial=await lab.getByTestId('live-model').first().getAttribute('data-state');
   const helpPanel=page.locator('.help-panel');
   const views:string[]=[];
   for(const name of ['举例子','画图','拆步骤','让我试试']){
    await helpPanel.getByRole('button',{name,exact:true}).click();
    await expect(helpPanel.getByRole('button',{name,exact:true})).toHaveClass(/selected/);
    const help=helpPanel.getByTestId(`lesson${id}-help`);
    await expect(help).toBeVisible();
    expect(await help.innerText()).not.toBe('');
    views.push(await help.innerText()); if(id===53 && name==='画图')await help.screenshot({path:' .runtime/channel-lessons-help53.png'.trim()});
    await expect(help.getByTestId(`lesson${id}-lab`)).toHaveCount(0);
   }
   expect(new Set(views).size,`lesson ${id} help modes should differ`).toBe(4);
   await expect(lab.getByTestId('live-model').first()).toHaveAttribute('data-state',initial!);
   await helpPanel.getByRole('button',{name:'收起帮助',exact:true}).click();
  }
  expect(errors).toEqual([]);expect(assessments).toEqual([]);
 });
}
test('all ten lessons and help views fit a 390px reduced-motion viewport',async({page})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 for(let id=51;id<=60;id++){
  const lab=await open(page,id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`lesson ${id} page overflow`).toBe(true);
  expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`lesson ${id} lab overflow`).toBe(true); if(id===52)await lab.screenshot({path:' .runtime/channel-lessons-52-mobile.png'.trim()});
  for(const name of ['画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
   const help=page.getByTestId(`lesson${id}-help`);await expect(help).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`lesson ${id} ${name} overflow`).toBe(true);
   expect(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`lesson ${id} ${name} help overflow`).toBe(true);
  }
 }
});
test('keyboard operation and help challenges change the visible model without assessment writes',async({page})=>{
 const assessmentWrites:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))assessmentWrites.push(r.url())});
 const lab=await open(page,51);
 await lab.getByLabel('第51题预测',{exact:true}).selectOption('waiting');await lab.getByRole('button',{name:'执行所选操作',exact:true}).focus();await page.keyboard.press('Enter');
 expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!).sender).toBe('waiting');
 await lab.getByRole('button',{name:'重置',exact:true}).focus();await page.keyboard.press('Enter');expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!).sender).toBe('ready');
 await open(page,52);await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();const help52=page.getByTestId('lesson52-help');
 await help52.getByLabel('你的判断').selectOption('fifo');await help52.getByRole('button',{name:'执行一次接收并核对',exact:true}).click();await expect(help52).toContainText('[12, 13, 14]');await expect(help52).toContainText('正在处理 11');
 await open(page,54);await page.locator('.help-panel').getByRole('button',{name:'让我试试',exact:true}).click();const help54=page.getByTestId('lesson54-help');
 await help54.getByLabel('退出条件').selectOption('ok');await help54.getByRole('button',{name:'运行这个条件',exact:true}).click();expect(JSON.parse((await help54.getByTestId('live-model').getAttribute('data-state'))!).processed).toEqual([0,5]);
 expect(assessmentWrites).toEqual([]);
});
