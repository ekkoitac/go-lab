import {test,expect,type Page,type Locator} from '@playwright/test';
async function lab(page:Page,id:number){await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'动手观察',exact:true}).click();const root=page.locator('.learning-column').getByTestId('foundations-lab-'+id);await expect(root).toBeVisible();return root;}
async function repeat(root:Locator,name:string,count:number){for(let i=0;i<count;i++)await root.getByRole('button',{name,exact:true}).click();}

test('scope: prediction gate, keyboard stepping, rewind and assignment repair',async({page})=>{
 const root=await lab(page,1);const start=root.getByRole('button',{name:'记录预测并开始追踪'});
 await expect(start).toBeDisabled();await root.getByLabel('最终 return price 是多少？').fill('80');await root.getByLabel('为什么会读到这个变量？').fill('先假设内层会更新外层，再检查绑定');
 await start.focus();await page.keyboard.press('Enter');await repeat(root,'单步执行',4);await expect(root).toContainText('实际为 100');
 await root.getByRole('button',{name:'回退一步',exact:true}).click();await expect(root).not.toContainText('已记录理由');
 await root.getByLabel('分支中的运算符').selectOption('=');await expect(start).toBeDisabled();await root.getByLabel('最终 return price 是多少？').fill('80');await root.getByLabel('为什么会读到这个变量？').fill('等号写入可见的 A');await start.click();await repeat(root,'单步执行',4);await expect(root).toContainText('数值预测吻合');await expect(root).toContainText('最终返回 80');
});
test('zero: explicit pause survives presence-aware defaults',async({page})=>{
 const root=await lab(page,2);await root.getByLabel('初始化方式').selectOption('replace-zero');await root.getByLabel('用户明确提供限额').check();
 await root.getByLabel('你的预测').selectOption('3');await root.getByLabel('为什么？',{exact:true}).fill('错误兜底覆盖了零');await repeat(root,'单步执行',3);await expect(root).toContainText('本次启动：3');
 await root.getByLabel('初始化方式').selectOption('presence');await root.getByLabel('你的预测').selectOption('0');await root.getByLabel('为什么？',{exact:true}).fill('明确填写零表示暂停');await repeat(root,'单步执行',3);await expect(root).toContainText('本次启动：0');await expect(root).toContainText('零限额在本业务表示暂停');
});
test('narrowing: 300 truncates to 44 but a pre-conversion guard rejects it',async({page})=>{
 const root=await lab(page,3);const predict=root.getByLabel('最终发送的数字，或“拒绝”/“编译错误”');await predict.fill('44');await root.getByLabel('理由',{exact:true}).fill('保留低八位');await root.getByRole('button',{name:'锁定预测，执行检查'}).click();await repeat(root,'执行下一步',2);await expect(root).toContainText('发送 44');
 await root.getByLabel('转换方案').selectOption('before');await predict.fill('拒绝');await root.getByLabel('理由',{exact:true}).fill('原值在转换前超过255');await root.getByRole('button',{name:'锁定预测，执行检查'}).click();await repeat(root,'执行下一步',2);await expect(root).toContainText('协议中没有发送字节');
});
test('constants: removing type fixes 12 but cannot make 300 fit byte',async({page})=>{
 const root=await lab(page,4);await root.getByLabel('这次调用能成立吗？').selectOption('no');await root.getByLabel('依据是什么？').fill('int不能隐式传给byte');await repeat(root,'单步检查',4);await expect(root).toContainText('类型门拒绝');
 await root.getByRole('button',{name:'修复候选：去掉声明类型'}).click();await root.getByLabel('这次调用能成立吗？').selectOption('yes');await root.getByLabel('依据是什么？').fill('无类型12可以表示');await repeat(root,'单步检查',4);await expect(root.locator('output')).toHaveText('len=12');
 await root.getByLabel('常量值',{exact:true}).fill('300');await root.getByLabel('这次调用能成立吗？').selectOption('no');await root.getByLabel('依据是什么？').fill('常量300超过255');await repeat(root,'单步检查',4);await expect(root).toContainText('可表示性门拒绝');
 await root.getByLabel('常量值',{exact:true}).fill('08');await expect(root.getByRole('alert')).toContainText('不使用前导零');
});
test('float: strict and tolerance comparisons expose the actual nonzero difference',async({page})=>{
 const root=await lab(page,5);await root.getByRole('combobox',{name:/^预测/}).selectOption('false');await root.getByLabel('判断理由').fill('变量先舍入再加法');await repeat(root,'单步执行',3);await expect(root).toContainText('0.30000000000000004');await expect(root).toContainText('5.5511e-17');
 await root.getByLabel('比较策略').selectOption('absolute');await root.getByRole('combobox',{name:/^预测/}).selectOption('true');await root.getByLabel('判断理由').fill('差值小于给定误差预算');await repeat(root,'单步执行',3);await expect(root).toContainText('当前规则：true');
});
test('pointer: local rebinding changes B while the caller still sees A',async({page})=>{
 const root=await lab(page,7);await root.getByLabel('传参策略').selectOption('rebind');await root.getByLabel('最终原账户 A 的余额').fill('50');await root.getByLabel('理由：这次写入会落在哪个对象？').fill('局部地址改指向B');await repeat(root,'单步执行',5);
 const state=JSON.parse((await root.getByTestId('live-model').getAttribute('data-state'))!);expect(state).toMatchObject({a:50,b:520,localPointer:'B'});await expect(root).toContainText('预测与原账户结果一致');
 await root.getByRole('button',{name:'回退一步',exact:true}).click();await expect(root).not.toContainText('预测与原账户结果一致');
});

test('strings: byte offsets follow decoding and change with combining input',async({page})=>{
 const root=await lab(page,6);
 async function reveal(bytes:string){await root.getByLabel('你预测 len(s) 是多少字节？').fill(bytes);await root.getByLabel('预测理由',{exact:true}).fill('按各码点UTF8字节数相加');await root.getByRole('button',{name:'提交预测并揭晓'}).click();}
 await reveal('8');await repeat(root,'range 下一步',3);await expect(root).toContainText('已访问字节起点：0 → 1 → 4');
 await root.getByLabel('UTF-8 文本（最多 40 个输入单位）').fill('e\u0301🙂');await reveal('7');await repeat(root,'range 下一步',3);await expect(root).toContainText('已访问字节起点：0 → 1 → 3');
 await root.getByRole('button',{name:'回退一步',exact:true}).click();await expect(root).toContainText('第 2 次：i=1');
 await root.getByRole('button',{name:'空串',exact:true}).click();await reveal('0');await expect(root.getByRole('button',{name:'range 下一步'})).toBeDisabled();await expect(root).toContainText('已到字符串末尾');
});
test('nil: initialization repairs map writes but an empty channel can still block',async({page})=>{
 const root=await lab(page,8);
 async function run(outcome:string){await root.getByLabel('这次操作的结果').selectOption(outcome);await root.getByLabel('依据哪个类型规则？').fill('按类型与操作的前提判断');await repeat(root,'单步执行',2);}
 await run('panic');await expect(root).toContainText('panic');await root.getByRole('button',{name:'加入初始化，重新预测并运行'}).click();await run('success');await expect(root.getByTestId('live-model')).toHaveAttribute('data-state',/"cells":\["a: 7"\]/);
 await root.getByLabel('具体类型').selectOption('channel');await root.getByLabel('尝试操作').selectOption('receive');await root.getByLabel('准备条件').selectOption('ready');await run('blocked');await expect(root).toContainText('make 并不保证接收可以完成');
 await root.getByLabel('准备条件').selectOption('closed');await run('success');await expect(root).toContainText('v=0 · ok=false');
});

test('assignment: saved values survive sequential writes and indices stay anchored',async({page})=>{
 const root=await lab(page,9);await root.getByLabel('实现方式').selectOption('multiple');await root.getByLabel('预测结果',{exact:true}).fill('x=9,y=2');await root.getByLabel('推理理由').fill('先计算右侧旧值，再依次写入');await repeat(root,'单步执行',2);
 let state=JSON.parse((await root.getByTestId('live-model').getAttribute('data-state'))!).state;expect(state).toMatchObject({a:9,b:9,saved:[9,2]});await expect(root).toContainText('从左到右写入的中间状态');await repeat(root,'单步执行',1);await expect(root).toContainText('实际结果：x=9, y=2');
 await root.getByLabel('实验场景').selectOption('index');await root.getByLabel('预测结果',{exact:true}).fill('i=1,a=[7,9]');await root.getByLabel('推理理由').fill('写入前用旧i定位a[0]');await repeat(root,'单步执行',3);await expect(root).toContainText('实际结果：i=1, a=[7, 9]');
});

test('short circuit: fixing the guard skips the dangerous read for both operators',async({page})=>{
 const root=await lab(page,10);
 async function run(prediction:string){await root.getByLabel('最终结果').selectOption(prediction);await root.getByLabel('哪个条件会让右侧执行或跳过？').fill('左侧结果决定是否需要右侧');await repeat(root,'单步执行',3);}
 await run('panic');let state=JSON.parse((await root.getByTestId('live-model').getAttribute('data-state'))!);expect(state).toMatchObject({result:'panic',calls:1});
 await root.getByRole('button',{name:'应用安全条件，再验证'}).click();await run('false');state=JSON.parse((await root.getByTestId('live-model').getAttribute('data-state'))!);expect(state).toMatchObject({result:false,right:'skipped',calls:0});
 await root.getByRole('combobox',{name:/^运算符/}).selectOption('||');await run('true');state=JSON.parse((await root.getByTestId('live-model').getAttribute('data-state'))!);expect(state).toMatchObject({guard:'empty',result:true,right:'skipped',calls:0});
});
