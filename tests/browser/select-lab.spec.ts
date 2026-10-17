import {test,expect,type Page} from '@playwright/test';
import type {SelectState} from '../../src/components/select-lab/model';
test.setTimeout(90000);
async function open(page:Page){
 await page.goto('/#lesson/56',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId('lesson56-lab');await expect(lab).toBeVisible();
 const click=(name:string)=>lab.getByRole('button',{name,exact:true}).click();
 const state=async()=>JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!) as SelectState;
 const finish=async()=>{await click('揭示本轮选择');await click('演示接收并离开')};
 return {lab,click,state,finish};
}
test('56: predictions, one stable draw, unselected message, order swap and alternate path',async({page})=>{
 const {lab,click,state,finish}=await open(page);
 await click('放入 A 消息');await click('放入 B 消息');await click('交换 case 位置');
 await lab.getByLabel('只执行 A',{exact:true}).check();await lab.getByLabel('只执行 B',{exact:true}).check();
 await click('提交预测并进入 select');const sampled=(await state()).choice;
 await expect(lab.getByRole('button',{name:'放入 B 消息',exact:true})).toBeDisabled();
 await finish();expect((await state()).choice).toBe(sampled);const other=sampled==='a'?'b':'a';expect((await state()).board[other]).toBe(true);
 expect((await state()).snapshot!.order).toEqual(['b','a']);
 await click('回退一步');expect((await state()).board[sampled as 'a'|'b']).toBe(true);await click('重放已记录一步');expect((await state()).choice).toBe(sampled);
 await click('演示另一合法路径');await finish();expect((await state()).choice).toBe(other);expect((await state()).runs.map(r=>r.source)).toEqual(['random','demo']);
 await expect(lab).toContainText('非随机');await click('恢复相同条件再试');expect((await state()).board.a).toBe(true);expect((await state()).board.b).toBe(true);
 await lab.screenshot({path:'.runtime/channel-lessons-56-desktop.png'});
});
test('56: no readiness waits; arrival wakes once; default only when none ready',async({page})=>{
 const {lab,click,state,finish}=await open(page);
 await lab.getByLabel('继续等待',{exact:true}).check();await click('提交预测并进入 select');expect((await state()).phase).toBe('waiting');
 await click('放入 B 消息');const choice=(await state()).choice;expect(choice).toBe('b');await finish();expect((await state()).board.b).toBe(false);
 await click('重置实验');await lab.getByLabel('加入 default',{exact:true}).check();await lab.getByLabel('执行 default',{exact:true}).check();await click('提交预测并进入 select');await finish();expect((await state()).choice).toBe('default');
 await click('重置实验');await click('放入 A 消息');await lab.getByLabel('加入 default',{exact:true}).check();await lab.getByLabel('执行 default',{exact:true}).check();await click('提交预测并进入 select');await finish();expect((await state()).choice).toBe('a');await expect(lab.locator('.cl-feedback')).toContainText('default 只在所有通信都不能进行时执行');
});
test('56: cancellation competes without priority and remains ready after handling',async({page})=>{
 const {lab,click,state,finish}=await open(page);await lab.getByLabel('56情境').selectOption('5');
 await click('放入 A 消息');await click('发出取消');await lab.getByLabel('只处理请求结果',{exact:true}).check();await lab.getByLabel('只响应取消',{exact:true}).check();
 await click('提交预测并进入 select');await finish();const first=(await state()).choice;
 await click('演示另一合法路径');await finish();expect((await state()).choice).not.toBe(first);expect((await state()).board.cancelled).toBe(true);
});
