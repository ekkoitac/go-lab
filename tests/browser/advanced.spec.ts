import {test,expect,type Page} from '@playwright/test';
async function open(page:Page,id:number){await page.goto('/#lesson/'+id);await page.getByRole('button',{name:'动手观察',exact:true}).click();const lab=page.getByTestId('live-model');await expect(lab).toBeVisible();return lab}
test('Read preserves final data before EOF',async({page})=>{const lab=await open(page,61);await lab.getByRole('button',{name:'执行一次Read处理'}).click();await expect(lab.getByLabel('已保存数据')).toContainText('∅');const before=await lab.getAttribute('data-state');await lab.getByLabel('先消费数据再判断错误').check();await lab.getByRole('button',{name:'执行一次Read处理'}).click();await expect(lab.getByLabel('已保存数据').locator('.cell')).toHaveCount(3);await expect(lab).not.toHaveAttribute('data-state',before!)});
test('limit probe exposes one extra byte',async({page})=>{const lab=await open(page,65);await expect(lab).toContainText('被截断');await lab.getByLabel('多读一个字节检测超限').check();await expect(lab.getByLabel('读取缓冲').locator('.cell')).toHaveCount(5);await expect(lab).toContainText('拒绝：读到 5 字节');await lab.getByLabel('请求字节数').fill('4');await expect(lab).toContainText('接受 4 字节')});
// Pagination category and validation interactions are covered by testing-interactions.spec.ts.

// Transactions and pool ownership now use data-boundary-77/78.spec.ts.
