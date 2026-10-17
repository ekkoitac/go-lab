import {test,expect} from '@playwright/test';
test('189 compare noisy tenant, failed reservation, release and rewind',async({page})=>{
 await page.goto('/#lesson/189',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('security-lab-189');await expect(lab).toBeVisible();
 const execute=async(g:number,d:number)=>{await lab.getByLabel('只有全局上限',{exact:true}).selectOption(String(g));await lab.getByLabel('双层配额',{exact:true}).selectOption(String(d));await lab.getByLabel('预测理由').fill('同时检查总量和单租户约束，失败不保留名额');await lab.getByRole('button',{name:'执行并核对'}).click();};
 await expect(lab.getByRole('button',{name:'执行并核对'})).toBeDisabled();
 await execute(1,1);await execute(2,2);await execute(3,2);await execute(4,2);
 await lab.getByLabel('下一步操作').selectOption('B');await execute(4,3);
 const read=async()=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
 expect((await read()).dual.jobs[4].status).toBe('running');expect((await read()).global.jobs[4].status).toBe('rejected');
 await lab.getByLabel('下一步操作').selectOption('cancel');await lab.getByLabel('任务编号').fill('1');await execute(3,2);await execute(3,2);
 await expect(lab).toContainText('重复或无效释放不改变计数');
 await lab.locator('[data-security-action="back"]').click();expect((await read()).dual.tick).toBe(6);
 await lab.locator('[data-security-action="reset"]').click();expect((await read()).dual.jobs).toHaveLength(0);
 await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
