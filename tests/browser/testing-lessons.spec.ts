import {test,expect,type Page} from '@playwright/test';

test.setTimeout(90000);
async function openLesson(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId(`testing-lab-${id}`);
 await expect(lab).toBeVisible();
 return lab;
}
for(let id=81;id<=90;id++){
 test(`lesson ${id}: distinct help views, isolated model and no assessment writes`,async({page})=>{
  const errors:string[]=[],writes:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))writes.push(r.url())});
  const lab=await openLesson(page,id);
  const model=lab.getByTestId('live-model').first();
  const initial=await model.getAttribute('data-state');
  expect(initial).toBeTruthy();
  const views:string[]=[];
  for(const name of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
   const mode=({'举例子':'example','画图':'diagram','拆步骤':'steps','让我试试':'try'} as Record<string,string>)[name];
   const help=page.locator('[data-help-mode='+mode+']').getByTestId(`testing-help-${id}`);
   await expect(help).toBeVisible();
   views.push(await help.innerText());
   await expect(help.getByTestId(`testing-lab-${id}`)).toHaveCount(0);
  }
  expect(new Set(views).size).toBe(4);
  if(id===81)await page.screenshot({path:'.runtime/testing-81-desktop.png',fullPage:true});
  await expect(model).toHaveAttribute('data-state',initial!);
  expect(errors).toEqual([]);expect(writes).toEqual([]);
 });
 test(`lesson ${id}: mobile and reduced motion layout`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  const lab=await openLesson(page,id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  if(id===83)await lab.screenshot({path:'.runtime/testing-83-mobile.png'});
  for(const name of ['举例子','画图','拆步骤','让我试试']){
   await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
   await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
   const mode=({'举例子':'example','画图':'diagram','拆步骤':'steps','让我试试':'try'} as Record<string,string>)[name];
   const help=page.locator('[data-help-mode='+mode+']').getByTestId(`testing-help-${id}`);await expect(help).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id} ${name} page overflow`).toBe(true);
   expect(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${id} ${name} help overflow`).toBe(true);
  }
 });
}
