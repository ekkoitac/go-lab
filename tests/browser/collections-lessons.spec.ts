import {test, expect} from '@playwright/test';

for (let id = 11; id <= 20; id++) {
  test('collections ' + id + ': distinct help preserves experiment and assessment', async ({page}, info) => {
    const errors: string[] = [], writes: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if (r.method() === 'POST' && /\/api\/progress\/\d+\/(attempt|reveal)/.test(r.url())) writes.push(r.url());});
    await page.goto('/#lesson/' + id);
    await page.getByRole('button', {name: '动手观察', exact: true}).click();
    const lab = page.locator('.learning-column').getByTestId('collections-lab-' + id);
    await expect(lab).toBeVisible();
    await lab.screenshot({path: info.outputPath('collections-' + id + '-desktop.png')});
    const model = lab.getByTestId('live-model').first();
    const initial = await model.getAttribute('data-state');
    expect(initial).toBeTruthy();
    const views: string[] = [];
    for (const [name, mode] of [['举例子','example'],['画图','diagram'],['拆步骤','steps'],['让我试试','try']]) {
      await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
      const help = page.locator('[data-help-mode="' + mode + '"]').getByTestId('collections-help-' + id);
      await expect(help).toBeVisible();
      await expect(help.getByTestId('collections-lab-' + id)).toHaveCount(0);
      views.push(await help.innerText());
    }
    expect(new Set(views).size).toBe(4);
    await expect(model).toHaveAttribute('data-state', initial!);
    await page.getByRole('button', {name: '收起帮助', exact: true}).click();
    await expect(lab).toBeVisible();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });

  test('collections ' + id + ': narrow screens and reduced motion', async ({page}, info) => {
    await page.emulateMedia({reducedMotion: 'reduce'});
    for (const width of [390, 320]) {
      await page.setViewportSize({width, height: 844});
      await page.goto('/#lesson/' + id);
      await page.getByRole('button', {name: '动手观察', exact: true}).click();
      const lab = page.locator('.learning-column').getByTestId('collections-lab-' + id);
      await expect(lab).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ' page at ' + width).toBe(true);
      expect(await lab.evaluate(el => el.scrollWidth <= el.clientWidth + 1), id + ' lab at ' + width).toBe(true);
      if (width === 390) await lab.screenshot({path: info.outputPath('collections-' + id + '-mobile.png')});
      for (const name of ['举例子','画图','拆步骤','让我试试']) {
        await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
        const help = page.getByTestId('collections-help-' + id);
        await expect(help).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id + ' ' + name + ' page at ' + width).toBe(true);
        expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1), id + ' ' + name + ' help at ' + width).toBe(true);
      }
    }
  });
}
