import {test,expect} from '@playwright/test';
test('155 circuit breaker accepts events, rewinds, repairs classification and fits mobile',async({page})=>{
 await page.goto('/#lesson/155');await page.getByRole('button',{name:'动手观察',exact:true}).click();const lab=page.getByTestId('resilience-lab-155');await expect(lab).toBeVisible();const live=lab.getByTestId('live-model');const first=await live.getAttribute('data-state');
 await lab.locator('[data-resilience-action="step"]').click();await expect(live).toContainText('#1');await lab.locator('[data-resilience-action="back"]').click();await expect(live).toHaveAttribute('data-state',first!);
 for(let i=0;i<2;i++){await lab.getByLabel('选择熔断事件').selectOption('send');await lab.locator('[data-resilience-action="step"]').click();await lab.getByLabel('选择熔断事件').selectOption('fault');await lab.locator('[data-resilience-action="step"]').click();}
 await expect(live).toHaveAttribute('data-state',/"mode":"Open"/);await lab.getByLabel('错误配置：把业务拒绝计为故障').check();await expect(live).toHaveAttribute('data-state',first!);
 await lab.locator('[data-resilience-action="reset"]').click();await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});expect(await lab.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await lab.getByLabel('选择熔断事件').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');await expect(lab.locator('[data-resilience-action="step"]')).toBeFocused();
});
