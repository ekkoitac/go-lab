import { test, expect, type Page } from '@playwright/test';
async function open(page:Page){ await page.goto('/#lesson/12'); await page.getByRole('button',{name:'动手观察',exact:true}).click(); return page.locator('.learning-column').getByTestId('collections-lab-12'); }
test('12: predict out of bounds, reslice, read zero, rewind and reset',async({page})=>{
 const lab=await open(page); const model=lab.getByTestId('live-model');
 await lab.getByLabel('预测结果').selectOption('panic'); await lab.getByLabel('预测理由').fill('i 等于 len，容量不能用于索引');
 await lab.getByRole('button',{name:'执行并核对',exact:true}).click(); await expect(lab).toContainText('预测吻合');
 expect(JSON.parse((await model.getAttribute('data-state'))!).result.ok).toBe(false);
 await lab.getByLabel('操作',{exact:true}).selectOption('reslice'); await lab.getByLabel('预测结果').selectOption('ok'); await lab.getByLabel('预测理由').fill('high=3 小于 cap=4'); await lab.getByRole('button',{name:'执行并核对',exact:true}).click();
 expect(JSON.parse((await model.getAttribute('data-state'))!).descriptor.length).toBe(3);
 await lab.getByLabel('操作',{exact:true}).selectOption('index'); await lab.getByLabel('预测结果').selectOption('ok'); await lab.getByLabel('预测理由').fill('i=2 小于新 len=3'); await lab.getByRole('button',{name:'执行并核对',exact:true}).click(); await expect(lab).toContainText('读取结果 = 0');
 await lab.getByRole('button',{name:'回退一步'}).click(); await lab.getByRole('button',{name:'回退一步'}).click(); expect(JSON.parse((await model.getAttribute('data-state'))!).descriptor.length).toBe(2);
 await lab.getByLabel('底层起点').fill('5'); await expect(lab.getByRole('button',{name:'应用窗口'})).toBeDisabled();
 await lab.getByRole('button',{name:'重置实验'}).click(); await expect(lab.getByLabel('底层起点')).toHaveValue('0');
});
for(const width of [320,390])test(`12: help interactions remain isolated at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const writes:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&/\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url()))writes.push(r.url());});
 const lab=await open(page); const initial=await lab.getByTestId('live-model').getAttribute('data-state');
 for(const [button,mode] of [['举例子','example'],['画图','diagram'],['拆步骤','steps'],['让我试试','try']]){
  await page.locator('.help-panel').getByRole('button',{name:button,exact:true}).click();const help=page.locator('[data-help-mode='+mode+']').getByTestId('collections-help-12');await expect(help).toBeVisible();
  if(mode==='example'){await help.getByLabel('开口格数').fill('3');expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!).length).toBe(3);}
  if(mode==='diagram'){await help.getByRole('button',{name:'追踪 s[1]'}).focus();await page.keyboard.press('Enter');await expect(help.locator('.c12-route')).toContainText('A[2]');}
  if(mode==='steps'){await help.getByRole('button',{name:'下一步'}).click();await help.getByRole('button',{name:'下一步'}).click();expect(JSON.parse((await help.getByTestId('live-model').getAttribute('data-state'))!).descriptor.start).toBe(1);}
  if(mode==='try'){await expect(help.getByRole('button',{name:'核对新情境'})).toBeDisabled();await help.getByLabel('你的判断').selectOption('panic');await help.getByLabel('你的推导').fill('索引等于长度');await help.getByRole('button',{name:'核对新情境'}).click();await expect(help).toContainText('判断吻合');}
  expect(await help.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state',initial!);expect(writes).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
