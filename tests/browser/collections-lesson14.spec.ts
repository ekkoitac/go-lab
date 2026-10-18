import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.goto('/#lesson/14', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.locator('.learning-column').getByTestId('collections-lab-14'); await expect(lab).toBeVisible(); return lab;
}
test('14: compare sharing, rewind, cap restriction and independent copy', async ({ page }) => {
  const lab = await open(page), run = lab.getByRole('button', { name: '执行并核对预测' });
  await expect(run).toBeDisabled();
  const predict = async (answer: string) => {
    await lab.getByLabel('我的预测').selectOption(answer);
    await lab.getByLabel('我的依据').fill('比较长度容量，并追踪写入的数组编号和格子。');
    await run.focus(); await page.keyboard.press('Enter');
  };
  await predict('yes'); await expect(lab).toContainText('b = [10, 20, 30]');
  await lab.getByLabel('操作', { exact: true }).selectOption('write'); await lab.getByLabel('整数值').fill('99');
  await predict('yes'); await expect(lab).toContainText('a = [99, 20]');
  await lab.getByRole('button', { name: '回退一步' }).click(); await expect(lab).toContainText('a = [10, 20]');
  await lab.getByRole('button', { name: '重置实验' }).click();
  await lab.getByRole('button', { name: '限制 b 容量到长度' }).click();
  await lab.getByLabel('操作', { exact: true }).selectOption('write'); await lab.getByLabel('整数值').fill('99');
  await predict('yes'); await expect(lab).toContainText('a = [99, 20]');
  await lab.getByRole('button', { name: '重置实验' }).click(); await lab.getByRole('button', { name: '分配新数组并 copy' }).click();
  await lab.getByLabel('操作', { exact: true }).selectOption('write'); await lab.getByLabel('整数值').fill('99');
  await predict('no'); await expect(lab).toContainText('a = [10, 20]'); await expect(lab).toContainText('b = [99, 20]');
  await lab.getByLabel('切片容量', { exact: true }).focus(); await page.keyboard.press('Home'); await predict('no');
  const state = JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.shared).toBe(false); expect(state.a.length).toBe(2); expect(state.b.length).toBe(3);
});
test('14: four independent help modes preserve main state and keep transfer hidden', async ({ page }) => {
  const writes: string[] = []; page.on('request', r => { if (r.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url())) writes.push(r.url()); });
  const lab = await open(page), initial = await lab.getByTestId('live-model').getAttribute('data-state');
  const help = async (name: string, mode: string) => { await page.locator('.help-panel').getByRole('button', { name, exact: true }).click(); return page.locator(`[data-help-mode=${mode}]`).getByTestId('collections-help-14'); };
  const example = await help('举例子', 'example'); await example.getByLabel('原桌座位数').selectOption('2');
  await example.getByRole('button', { name: '把 b 第一份餐换为面条' }).click(); await example.getByRole('button', { name: '给 b 追加一份甜点' }).click();
  await expect(example).toContainText('a 菜单：面条、汤');
  const diagram = await help('画图', 'diagram'); await diagram.getByRole('checkbox').check(); await diagram.getByRole('button', { name: '追踪追加之后' }).click();
  expect(JSON.parse((await diagram.getByTestId('live-model').getAttribute('data-state'))!).shared).toBe(false);
  const steps = await help('拆步骤', 'steps'); await steps.getByRole('button', { name: '下一步' }).click(); await steps.getByRole('button', { name: '下一步' }).click(); await expect(steps).toContainText('a = [99, 20]');
  const transfer = await help('让我试试', 'try'); await expect(transfer).not.toContainText('raw[1] = 60');
  expect(JSON.parse((await transfer.getByTestId('live-model').getAttribute('data-state'))!).result).toBeNull();
  await transfer.getByLabel('最后 raw[1] 是多少？').fill('60'); await transfer.getByLabel('两次写入分别访问哪里？').fill('追加前仍共享，第一次写入留下60。'); await transfer.getByRole('button', { name: '验证迁移预测' }).click(); await expect(transfer).toContainText('预测吻合：raw[1] = 60');
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', initial!); expect(writes).toEqual([]);
});
for (const width of [320, 390]) test(`14: ${width}px supports every help view`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); const lab = await open(page);
  expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const [name, mode] of [['举例子', 'example'], ['画图', 'diagram'], ['拆步骤', 'steps'], ['让我试试', 'try']]) {
    await page.locator('.help-panel').getByRole('button', { name, exact: true }).click(); const help = page.locator(`[data-help-mode=${mode}]`).getByTestId('collections-help-14');
    await expect(help).toBeVisible(); expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

