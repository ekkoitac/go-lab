import {test,expect} from '@playwright/test';
test('151 budget workbench advances, rewinds and restarts on parameter changes',async({page})=>{
 await page.goto('/#lesson/151');await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('resilience-lab-151');await expect(lab).toBeVisible();
 const live=lab.getByTestId('live-model');const initial=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('65ms');
 await lab.locator('[data-resilience-action="back"]').click();await expect(live).toHaveAttribute('data-state',initial!);
 await lab.locator('[data-resilience-action="step"]').click();await lab.getByRole('slider',{name:'库存耗时',exact:true}).fill('240');
 await expect(live).toHaveAttribute('data-state',initial!);await expect(lab).toContainText('参数已改变');
 await lab.locator('[data-resilience-action="step"]').click();await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('已取消');
 await lab.locator('[data-resilience-action="reset"]').click();await expect(live).toHaveAttribute('data-state',initial!);
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
});
