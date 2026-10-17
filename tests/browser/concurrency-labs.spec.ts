import {test,expect,type Page,type Locator} from '@playwright/test';

const ids=process.env.CONCURRENCY_LAB_IDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>121+i);
async function progress(page:Page,id:number){
 return page.evaluate(async lessonId=>{
  const {token}=await(await fetch('/api/session')).json();
  const p=await(await fetch('/api/progress/'+lessonId,{headers:{'x-lab-token':token}})).json();
  return {draft:p.draft??null,feynman:p.feynman??null,attempts:p.attempts,revealed:p.revealed,completed:p.completed,reviewLevel:p.reviewLevel};
 },id);
}
async function fits(page:Page,root:Locator,label:string){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' page overflow').toBe(true);
 expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+' panel overflow').toBe(true);
 const clipped=await root.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
  const b=node.getBoundingClientRect(),v=(node as SVGGraphicsElement).ownerSVGElement!.getBoundingClientRect();
  return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
 }).map(n=>n.textContent));
 expect(clipped,label+' clipped SVG text').toEqual([]);
}
for(const width of [1440,390])for(const id of ids)test(`${id}: four separate help views, reversible model and isolation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[],forbidden:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))forbidden.push(r.url());});
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('concurrency-lab-'+id),model=lab.getByTestId('live-model').first();
 await expect(model).toBeVisible();await fits(page,lab,`${id} lab`);
 const original=await model.getAttribute('data-state');expect(original).toBeTruthy();
 if(id===126)await lab.getByRole('combobox',{name:'提交前预测 B 的结果',exact:true}).selectOption('false-success');
 if(id===127)await lab.getByRole('combobox',{name:'先预测：旧读者最终读到哪个后端？',exact:true}).selectOption('green');
 if(id===129)await lab.getByRole('combobox',{name:'预测读到的配置',exact:true}).selectOption('mixed');
 if(id===130)await lab.getByRole('combobox',{name:'预测请求结束后任务状态',exact:true}).selectOption('canceling');
 if(id===128)await lab.getByRole('combobox',{name:'预测 B 是否等待',exact:true}).selectOption('free');
 if(id===124)await lab.getByLabel('预测退出结果',{exact:true}).selectOption('unsafe');
 if(id===125)await lab.getByRole('combobox',{name:'轮转下一位',exact:true}).selectOption('A');
 if(id===123)await lab.getByRole('combobox',{name:'预测',exact:true}).selectOption('degraded');
 if(id===122)await lab.getByRole('radio',{name:'能，推荐可以缺省'}).check();
 if(id===121){await lab.getByLabel('预测执行数',{exact:true}).selectOption('2');await lab.getByLabel('预测工作G数',{exact:true}).selectOption('8');}
 const step=lab.locator('[data-concurrency-action=step]').first();
 await expect(step).toBeEnabled();await step.focus();await page.keyboard.press('Enter');
 await expect(model).not.toHaveAttribute('data-state',original!);
 const advanced=await model.getAttribute('data-state');
 await lab.locator('[data-concurrency-action=back]').first().click();await expect(model).toHaveAttribute('data-state',original!);
 if(id===125)await lab.getByRole('combobox',{name:'轮转下一位',exact:true}).selectOption('A');
 if(id===126)await lab.getByRole('combobox',{name:'提交前预测 B 的结果',exact:true}).selectOption('false-success');
 await step.click();await expect(model).toHaveAttribute('data-state',advanced!);
 await lab.locator('[data-concurrency-action=reset]').first().click();await expect(model).toHaveAttribute('data-state',original!);
 const before=await progress(page,id),views:string[]=[];
 for(const name of ['举例子','画图','拆步骤','让我试试']){
  const helpButton=page.locator('.help-panel').getByRole('button',{name,exact:true});
  await helpButton.click();await expect(helpButton).toHaveClass(/selected/);
  const help=page.getByTestId('concurrency-help-'+id);await expect(help).toBeVisible();
  await expect(help.getByTestId('concurrency-lab-'+id)).toHaveCount(0);
  views.push(await help.innerText());await fits(page,help,`${id} ${name}`);
  await expect(model).toHaveAttribute('data-state',original!);
  await help.screenshot({path:`.runtime/concurrency-labs/help-${id}-${width}-${name}.png`,animations:'disabled'});
 }
 expect(new Set(views).size).toBe(4);
 await page.getByRole('button',{name:'收起帮助',exact:true}).click();
 expect(await progress(page,id)).toEqual(before);expect(forbidden).toEqual([]);expect(errors).toEqual([]);
 await lab.screenshot({path:`.runtime/concurrency-labs/lab-${id}-${width}.png`,animations:'disabled'});
});

