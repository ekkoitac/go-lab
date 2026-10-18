import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.goto('/#lesson/13', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '动手观察', exact: true }).click();
  const lab = page.locator('.learning-column').getByTestId('collections-lab-13');
  await expect(lab).toBeVisible();
  return lab;
}
test('13: shared write, rewind and isolated copy produce different original values', async ({ page }) => {
  const lab = await open(page), run = lab.getByRole('button', { name: '执行写入并核对' });
  await expect(run).toBeDisabled();
  const predict = async (prediction: string) => {
    await lab.getByLabel('这次写入后 prices 的数值会变化吗？').selectOption(prediction);
    await lab.getByLabel('我的映射理由').fill('sale的数组编号和起点决定是否共享，写入值不同。');
    await run.focus(); await page.keyboard.press('Enter');
  };
  await predict('change');
  await expect(lab).toContainText('prices = [100, 99, 300, 400]');
  await lab.getByRole('button', { name: '回退一步' }).click();
  await expect(lab).toContainText('prices = [100, 200, 300, 400]');
  await lab.getByRole('button', { name: '分配新数组并 copy' }).click();
  await predict('same');
  await expect(lab).toContainText('prices = [100, 200, 300, 400]');
  await expect(lab).toContainText('sale = [99, 300, 400]');
  await expect(lab).toContainText('预测吻合：prices 数值不变');
  await lab.getByRole('button', { name: '重置实验' }).click();
  await lab.getByLabel('窗口起点 low').selectOption('4');
  await lab.getByRole('button', { name: '应用 prices[4:4]' }).click();
  await expect(lab).toContainText('空切片不能索引');
  await expect(run).toBeDisabled();
});
test('13: every help view has meaningful controls and transfer hides result before submission', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url())) writes.push(r.url()); });
  const lab = await open(page), initial = await lab.getByTestId('live-model').getAttribute('data-state');
  const help = async (name: string, mode: string) => {
    await page.locator('.help-panel').getByRole('button', { name, exact: true }).click();
    return page.locator(`[data-help-mode=${mode}]`).getByTestId('collections-help-13');
  };
  const example = await help('举例子', 'example');
  await example.getByRole('button', { name: '更换促销第一盒' }).click();
  await expect(example).toContainText('原价窗口：红 / 金 / 绿');
  const diagram = await help('画图', 'diagram');
  await diagram.getByLabel('截取起点').selectOption('2');
  await diagram.getByRole('button', { name: '追踪 sale[1]' }).click();
  await expect(diagram).toContainText('sale[1] → A[2 + 1] → A[3]');
  const steps = await help('拆步骤', 'steps');
  await steps.getByRole('button', { name: '下一步' }).click();
  await expect(steps).toContainText('prices = [100, 99, 300, 400]');
  const transfer = await help('让我试试', 'try');
  await expect(transfer).not.toContainText('raw[3] = 7');
  await transfer.getByLabel('预测 raw[3]').fill('7');
  await transfer.getByLabel('你如何换算索引？').fill('2加1等于3，访问同一底层数组。');
  await transfer.getByRole('button', { name: '验证迁移预测' }).click();
  await expect(transfer).toContainText('预测吻合：raw[3] = 7');
  await expect(lab.getByTestId('live-model')).toHaveAttribute('data-state', initial!);
  expect(writes).toEqual([]);
});
for (const width of [320, 390]) test(`13: ${width}px layout supports all help views`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const lab = await open(page);
  expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  for (const [name, mode] of [['举例子', 'example'], ['画图', 'diagram'], ['拆步骤', 'steps'], ['让我试试', 'try']]) {
    await page.locator('.help-panel').getByRole('button', { name, exact: true }).click();
    const help = page.locator(`[data-help-mode=${mode}]`).getByTestId('collections-help-13');
    await expect(help).toBeVisible();
    expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});
