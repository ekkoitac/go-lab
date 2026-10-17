import {test, expect, type Locator, type Page} from '@playwright/test';

async function fits(page: Page, root: Locator, label: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' page width').toBe(true);
  expect(await root.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ' panel width').toBe(true);
  const clipped = await root.locator('svg text').evaluateAll(nodes => nodes.filter(node => {
    const text = node as SVGGraphicsElement;
    const svg = text.ownerSVGElement!;
    const box = text.getBoundingClientRect(), bounds = svg.getBoundingClientRect();
    return bounds.width > 0 && (box.left < bounds.left - 2 || box.top < bounds.top - 2 || box.right > bounds.right + 2 || box.bottom > bounds.bottom + 2);
  }).map(n => n.textContent));
  expect(clipped, label + ' SVG labels').toEqual([]);
}

const ids = process.env.OBS_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 171 + i);
for (const width of [1440, 320]) {
  for (const id of ids) {
    test(`${id} observation and four help modes preserve state at ${width}px`, async ({page}) => {
      await page.setViewportSize({width, height: 1000});
      await page.emulateMedia({reducedMotion: 'reduce'});
      const errors: string[] = [], attempts: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (request.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(request.url())) attempts.push(request.url());
      });
      await page.goto('/#lesson/' + id, {waitUntil: 'domcontentloaded'});
      await page.getByRole('button', {name: '动手观察', exact: true}).click();
      const lab = page.locator('.learning-column').getByTestId('observability-lab-' + id);
      await expect(lab).toBeVisible();
      const model = lab.getByTestId('live-model').first();
      await expect(model).toBeVisible();
      await fits(page, lab, `${id} observation`);
      const before = await model.getAttribute('data-state');
      expect(before).toBeTruthy();
      const editor = page.locator('.cm-content').first();
      const notebook = page.getByRole('textbox', {name: '架构决策记录'});
      const code = await editor.count() ? await editor.innerText() : null;
      const note = await notebook.count() ? await notebook.inputValue() : null;
      const views: string[] = [];
      for (const [name, mode] of [['举例子','example'], ['画图','diagram'], ['拆步骤','steps'], ['让我试试','try']]) {
        await page.locator('.help-panel').getByRole('button', {name, exact: true}).click();
        await expect(page.locator('.help-panel [data-help-mode=' + mode + ']')).toBeVisible();
        const help = page.getByTestId('observability-help-' + id);
        await expect(help).toBeVisible();
        await fits(page, help, `${id} ${name}`);
        views.push(await help.innerText());
        await expect(help.getByTestId('observability-lab-' + id)).toHaveCount(0);
        await expect(model).toHaveAttribute('data-state', before!);
        if (code !== null) expect(await editor.innerText()).toBe(code);
        if (note !== null) await expect(notebook).toHaveValue(note);
        if (name === '画图') await help.screenshot({path: `.runtime/observability-171-180/help-${id}-${width}.png`, animations: 'disabled'});
      }
      expect(new Set(views).size, 'four distinct teaching views').toBe(4);
      await page.getByRole('button', {name: '收起帮助', exact: true}).click();
      await lab.screenshot({path: `.runtime/observability-171-180/lab-${id}-${width}.png`, animations: 'disabled'});
      expect(attempts, 'exploration must not submit mastery evidence').toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}