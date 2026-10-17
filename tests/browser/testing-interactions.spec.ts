import {test,expect,type Page} from '@playwright/test';
test.setTimeout(120000);
async function open(page:Page,id:number){
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.locator('.learning-column').getByTestId(`testing-lab-${id}`);
 await expect(lab).toBeVisible();return lab;
}
test('81: independent oracle finds the boundary defect and repair changes its verdict',async({page})=>{
 const lab=await open(page,81),run=lab.getByRole('button',{name:'运行并核对预测'});
 await expect(run).toBeDisabled();
 await lab.getByLabel('预测结果').selectOption('spec-fails');await lab.getByLabel('你的理由').fill('满100包含100，复制条件会把错误带到预期。');
 await run.focus();await page.keyboard.press('Enter');
 await expect(lab).toContainText('预期 0 / 实际 10 → FAIL');await expect(lab).toContainText('预期 10 / 实际 10 → PASS');
 await lab.getByLabel('被测实现').selectOption('fixed');await expect(run).toBeDisabled();
 await lab.getByLabel('预测结果').selectOption('both-pass');await lab.getByLabel('你的理由').fill('修复包含相等');await run.click();
 await expect(lab).toContainText('预期 0 / 实际 0 → PASS');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state','100:buggy:false:false');
});
test('83: same schedule shows contamination, independent fixture and stable read snapshot',async({page})=>{
 const lab=await open(page,83),step=lab.locator('[data-testing-action="step"]');
 await expect(step).toBeDisabled();
 await lab.getByLabel('先预测：共享 map 中 B 会读到什么？').selectOption('written');await lab.getByLabel('你的理由').fill('A先写共享对象，B读同一对象');await lab.getByRole('button',{name:'记录预测与理由'}).click();
 await step.click();await step.click();
 await expect(lab).toContainText('共享方案 B 读到 1 / true；独立方案 B 读到 0 / true');
 await step.click();await expect(lab).toContainText('B 已读取：value=1，ok=true');
 await lab.getByRole('button',{name:'回退一步'}).click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state','write-read-clear:2:written');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state','write-read-clear:0:unread');
});
test('82: adding a new category exposes incomplete validation',async({page})=>{
 const lab=await open(page,82),run=lab.getByRole('button',{name:'运行同一张表并对照'});
 await lab.getByLabel('③ 预测会失败几行？').fill('1');await lab.getByLabel('写下理由').fill('原公式没有减去第一页');await run.click();
 await expect(lab.locator('article').filter({has:page.getByRole('heading',{name:'原公式',exact:true})})).toContainText('实际 20 / 预期 10');
 await lab.getByLabel(/再加普通页/).check();await expect(lab).toContainText('2 行 / 1 类');
 await lab.getByLabel(/页大小为零/).check();await lab.getByLabel('② 选择要预测的实现').selectOption('formula');
 await expect(run).toBeDisabled();await lab.getByLabel('③ 预测会失败几行？').fill('1');await lab.getByLabel('写下理由').fill('新增非法页大小，只有公式没有校验');await run.click();
 await expect(lab).toContainText('只修复公式 实际失败 1 行');
 await expect(lab.locator('article').filter({has:page.getByRole('heading',{name:'公式 + 输入校验',exact:true})})).toContainText('实际 -1 / 预期 -1');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(lab).toContainText('1 行 / 1 类');
});
test('84: exact expiry fails the inclusive rule; fixed input resists execution delay',async({page})=>{
 const lab=await open(page,84),step=lab.locator('[data-testing-action="step"]');
 await lab.getByLabel('该规则会返回有效吗？').selectOption('true');await lab.getByLabel('判断理由').fill('非After包含相等');await step.click();await step.click();await step.click();await expect(lab).toContainText('当前断言 FAIL');
 await lab.getByLabel('被测规则').selectOption('before');await lab.getByRole('button',{name:'到期前 1 ns',exact:true}).click();await lab.getByLabel(/检查前调度延迟/).fill('2');
 await lab.getByLabel('该规则会返回有效吗？').selectOption('true');await lab.getByLabel('判断理由').fill('注入值仍然是截止前1ns');await step.click();await step.click();await expect(lab).toContainText('你的预测：true；实际：true');
 await lab.getByLabel('时钟来源').selectOption('live');await lab.getByLabel('该规则会返回有效吗？').selectOption('false');await lab.getByLabel('判断理由').fill('延迟使实际输入越过截止');await step.click();await step.click();await expect(lab).toContainText('你的预测：false；实际：false');
 await lab.getByRole('button',{name:'重置到期边界'}).click();await expect(step).toBeDisabled();
});
test('85: value, synchronization and coverage are separate evidence',async({page})=>{
 const lab=await open(page,85),step=lab.locator('[data-testing-action="step"]');
 await lab.getByLabel('最终计数').selectOption('2');await lab.getByLabel('这条路径会产生数据竞争证据吗？').selectOption('yes');await lab.getByLabel('调度与理由').fill('按A读写B读写安排，没有同步关系');
 for(const actor of ['A','A','B','B'])await lab.getByRole('button',{name:`执行 ${actor} 下一步`}).click();
 await expect(lab).toContainText('最终计数 2');await expect(lab).toContainText('模型将报告 data race');
 await lab.getByLabel('同步方案').selectOption('split');await lab.getByLabel('最终计数').selectOption('1');await lab.getByLabel('这条路径会产生数据竞争证据吗？').selectOption('no');await lab.getByLabel('调度与理由').fill('访问加锁但读改写整体未锁');for(let i=0;i<4;i++)await step.click();
 await expect(lab).toContainText('最终计数 1');await expect(lab).toContainText('每次访问都使用同一把锁');
 await lab.getByRole('button',{name:'修复：把锁扩大到完整更新，再预测重验'}).click();await lab.getByLabel('最终计数').selectOption('2');await lab.getByLabel('这条路径会产生数据竞争证据吗？').selectOption('no');await lab.getByLabel('调度与理由').fill('整个读改写受同一锁保护');for(let i=0;i<4;i++)await step.click();await expect(lab).toContainText('最终计数 2');
 await lab.getByLabel('执行路径').selectOption('skip');await lab.getByLabel('最终计数').selectOption('0');await lab.getByLabel('这条路径会产生数据竞争证据吗？').selectOption('no');await lab.getByLabel('调度与理由').fill('未执行不能证明安全');await step.click();await expect(lab).toContainText('没有访问可供检测，不能断言分支安全');
});
test('86: shrink a UTF-8 counterexample, repair the unit and keep invalid input distinct',async({page})=>{
 const lab=await open(page,86),run=lab.getByRole('button',{name:'验证这个种子'});
 await lab.getByLabel('我的预测').selectOption('fail');await lab.getByLabel('我的理由').fill('首码点猫需要三个字节');await run.click();await expect(lab).toContainText('输出 UTF-8：非法');
 const shrink=lab.getByRole('button',{name:'缩减：删除末尾一个码点'});for(let i=0;i<3;i++)await shrink.click();await expect(lab.getByLabel('种子输入')).toHaveValue('猫');await expect(shrink).toBeDisabled();
 await lab.getByLabel('截取实现').selectOption('rune');await lab.getByLabel('我的预测').selectOption('pass');await lab.getByLabel('我的理由').fill('完整码点保留编码');await run.click();await expect(lab).toContainText('输出 UTF-8：合法');
 await lab.getByRole('button',{name:'非法字节',exact:true}).click();await lab.getByLabel('我的预测').selectOption('skip');await lab.getByLabel('我的理由').fill('合法输入前提不成立');await run.click();await expect(lab).toContainText('跳过不是通过');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(run).toBeDisabled();
});
test('87: timer boundaries change measured work, not the algorithm',async({page})=>{
 const lab=await open(page,87),step=lab.locator('[data-testing-action="step"]');
 await lab.getByLabel('B 的计时成本与 A 相比').selectOption('less');await lab.getByLabel('依据哪些工作被计入？').fill('B将准备移出并重置计时');for(let i=0;i<4;i++)await step.click();
 await expect(lab).toContainText('模型观察：B 更少');await expect(lab).toContainText('不代表求和算法变快');
 await lab.getByLabel('B 消费结果：sink = sum(xs)').uncheck();await lab.getByLabel('B 的计时成本与 A 相比').selectOption('less');await lab.getByLabel('依据哪些工作被计入？').fill('即使模型成本低，结果未消费仍有优化风险');for(let i=0;i<4;i++)await step.click();await expect(lab).toContainText('实际编译器可能优化');
 await lab.getByRole('button',{name:'恢复基线'}).click();await expect(step).toBeDisabled();
});
test('88: full statement coverage without assertions misses a negative charge',async({page})=>{
 const lab=await open(page,88),step=lab.locator('[data-testing-action="step"]');
 await lab.getByLabel('负数 -5').check();
 const run=async(prediction:string)=>{await lab.getByLabel('测试报告预测').selectOption(prediction);await lab.getByLabel('判断理由').fill('执行语句与断言结果是两种证据');for(let i=0;i<4;i++)await step.click()};
 await run('PASS');await expect(lab).toContainText('100%');await expect(lab).toContainText('所有返回值都未被检查');
 await lab.getByLabel('开启规格断言 got == want').check();await run('FAIL');await expect(lab).toContainText('规格要求 0；实际 -5 → FAIL');
 await lab.getByLabel('修复函数：先拒绝负数').check();await run('PASS');await expect(lab).toContainText('语句执行 3/3');await expect(lab).toContainText('规格要求 0；实际 0 → PASS');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(step).toBeDisabled();
});
test('89: formatting, static checks and assertions reveal different defects',async({page})=>{
 const lab=await open(page,89),step=lab.locator('[data-testing-action="step"]');
 const run=async(p:string)=>{await lab.getByLabel('你的预测').selectOption(p);await lab.getByLabel('为什么？').fill('三道检查分别收集排版、类型和行为证据');for(let i=0;i<3;i++)await step.click()};
 await run('format');await expect(lab).toContainText('列表输出 main.go');await expect(lab).toContainText('Printf 风格静态检查发现');
 await lab.getByLabel('应用 gofmt -w 格式化修改').check();await lab.getByLabel('修复格式动词：%d → %s').check();await run('test');await expect(lab).toContainText('满额断言：输入 100，got false，want true');
 await lab.getByLabel('修复满额判断：> → >=').check();await run('none');await expect(lab.locator('.l89-pipeline li[data-status="pass"]')).toHaveCount(3);
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(step).toBeDisabled();
});
test('90: local refuses an insufficient compiler while auto can switch offline from PATH',async({page})=>{
 const lab=await open(page,90),step=lab.locator('[data-testing-action="step"]');
 const run=async(p:string)=>{await lab.getByLabel('你预测会发生什么？').selectOption(p);await lab.getByLabel('哪条配置决定结果？').fill('最低版本、策略和工具链可用性共同决定');for(let i=0;i<4;i++)await step.click()};
 await run('blocked');await expect(lab).toContainText('离线无法获取');
 await lab.getByLabel('PATH 有所需目标版本').check();await run('path');await expect(lab).toContainText('离线也可切换');
 await lab.getByLabel('go 最低要求').selectOption('1.22.0');await lab.getByLabel('GOTOOLCHAIN',{exact:true}).selectOption('local');await run('blocked');await expect(lab).toContainText('即使 PATH 有新版也不自动切换');
 await lab.getByLabel('随 go 命令附带').selectOption('1.22.6');await run('bundled');await lab.getByLabel('实际 go version').check();await expect(lab).toContainText('实际工具链：go1.22.6');
 await lab.getByRole('button',{name:'重置实验'}).click();await expect(step).toBeDisabled();
});
