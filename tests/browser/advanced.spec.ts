import {test,expect,type Page} from '@playwright/test';
async function open(page:Page,id:number){await page.goto('/#lesson/'+id);await page.getByRole('button',{name:'动手观察',exact:true}).click();const lab=page.getByTestId('live-model');await expect(lab).toBeVisible();return lab}
test('Read preserves final data before EOF',async({page})=>{const lab=await open(page,61);await lab.getByRole('button',{name:'执行一次Read处理'}).click();await expect(lab.getByLabel('已保存数据')).toContainText('∅');const before=await lab.getAttribute('data-state');await lab.getByLabel('先消费数据再判断错误').check();await lab.getByRole('button',{name:'执行一次Read处理'}).click();await expect(lab.getByLabel('已保存数据').locator('.cell')).toHaveCount(3);await expect(lab).not.toHaveAttribute('data-state',before!)});
test('limit probe exposes one extra byte',async({page})=>{const lab=await open(page,65);await expect(lab).toContainText('被截断');await lab.getByLabel('多读一个字节检测超限').check();await expect(lab.getByLabel('读取缓冲').locator('.cell')).toHaveCount(5);await expect(lab).toContainText('拒绝：读到 5 字节');await lab.getByLabel('请求字节数').fill('4');await expect(lab).toContainText('接受 4 字节')});
test('transaction distinguishes staging rollback and commit',async({page})=>{const lab=await open(page,77);await lab.getByRole('button',{name:'开始事务并扣款'}).click();await expect(lab.getByLabel('事务区：暂存余额 7').locator('.cell')).toHaveCount(7);await lab.getByRole('button',{name:'回滚事务'}).click();await expect(lab.getByLabel('已提交余额 10').locator('.cell')).toHaveCount(10);await lab.getByRole('button',{name:'开始事务并扣款'}).click();await lab.getByRole('button',{name:'提交事务'}).click();await expect(lab.getByLabel('已提交余额 7').locator('.cell')).toHaveCount(7)});
test('pool release promotes queued query',async({page})=>{const lab=await open(page,78);await lab.getByLabel('连接池上限').fill('1');await lab.getByRole('button',{name:'提交一次查询'}).click();await lab.getByRole('button',{name:'提交一次查询'}).click();await expect(lab.getByLabel('等待获取连接的查询').locator('.cell')).toHaveCount(1);await lab.getByRole('button',{name:'关闭最早结果集'}).click();await expect(lab.locator('.buffer')).toContainText('Query 2');await expect(lab.getByLabel('等待获取连接的查询').locator('.cell')).toHaveCount(0)});
test('pagination cases match the actual lesson and reject invalid input',async({page})=>{
 const lab=await open(page,82);
 await expect(lab.getByTestId('test-case')).toHaveCount(1);
 await expect(lab).toContainText('1 个失败');
 await lab.getByLabel('加入第一页用例').check();
 await lab.getByLabel('加入非法输入用例').check();
 await expect(lab.getByTestId('test-case')).toHaveCount(4);
 await expect(lab).toContainText('4 个失败');
 await lab.getByLabel('修复分页公式和校验').check();
 await expect(lab).toContainText('0 个失败');
 await lab.getByLabel('每页条数').fill('20');
 await expect(lab.getByTestId('test-case').first()).toContainText('实际 20 / 预期 20');
 await expect(lab.getByTestId('test-case').nth(1)).toContainText('实际 0 / 预期 0');
});
