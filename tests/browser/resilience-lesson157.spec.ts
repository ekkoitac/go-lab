import {test,expect} from '@playwright/test';
test('157 exposes false success, repairs from timeout, reconciles and rewinds',async({page})=>{
 await page.goto('/#lesson/157');await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('resilience-lab-157');const live=lab.getByTestId('live-model');const initial=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();const timeout=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();expect(JSON.parse((await live.getAttribute('data-state'))!).local).toBe('unknown');await expect(live).toContainText('支付成功');
 await lab.getByRole('button',{name:'修复假成功：保留未知并加入核对'}).click();await expect(live).toHaveAttribute('data-state',timeout!);
 await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('支付处理中');await expect(live).toContainText('待核对 1 笔');
 await lab.locator('[data-resilience-action="step"]').click();expect(JSON.parse((await live.getAttribute('data-state'))!).local).toBe('unpaid');
 await lab.locator('[data-resilience-action="back"]').click();expect(JSON.parse((await live.getAttribute('data-state'))!).local).toBe('unknown');
 await lab.locator('[data-resilience-action="reset"]').click();await expect(live).toHaveAttribute('data-state',initial!);
 await lab.getByLabel('后续核对能收到终态凭证').uncheck();for(let n=0;n<3;n++)await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('查询支付渠道也超时');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
 await lab.locator('[data-resilience-action="reset"]').focus();await page.keyboard.press('Enter');expect(JSON.parse((await live.getAttribute('data-state'))!).stage).toBe(0);
});
