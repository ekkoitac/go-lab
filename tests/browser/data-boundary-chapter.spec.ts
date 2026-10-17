import {test, expect} from '@playwright/test';
import {boundaryHelpOptions} from '../../src/components/data-boundary-lab/help-options';

for (const width of [1440, 390]) test(`data boundary chapter: custom help, isolation and layout at ${width}px`, async ({page}) => {
  test.setTimeout(300000);
  await page.setViewportSize({width, height: 1000});
  await page.emulateMedia({reducedMotion: 'reduce'});
  const errors: string[] = [], writes: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', req => {
    if (req.method() === 'POST' && /\/progress\/\d+\/(attempt|reveal)$/.test(req.url())) writes.push(req.url());
  });
  const ids = process.env.BOUNDARY_TEST_IDS?.split(',').map(Number) ?? Array.from({length: 10}, (_, i) => 71 + i);
  for (const id of ids) {
    await page.goto('/#lesson/' + id);
    await page.getByRole('button', {name: '动手观察', exact: true}).click();
    const lab = page.locator('.learning-column').getByTestId('data-boundary-lab-' + id);
    await expect(lab).toBeVisible();
    await expect(lab.getByTestId('live-model').first()).toBeVisible();
    const editor = await page.locator('.cm-content').first().textContent();
    const state = await lab.getByTestId('live-model').first().getAttribute('data-state');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `lesson ${id} main overflow`).toBe(true);
    await lab.screenshot({path: `.runtime/data-boundary-${id}-${width}.png`, animations: 'disabled'});
    const options = boundaryHelpOptions(id)!;
    for (const option of options) {
      const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/progress/${id}/help`));
      await page.locator('.help-panel').getByRole('button', {name: option.text, exact: true}).click();
      const saved = await response;
      expect(saved.ok()).toBe(true);
      expect((await saved.json()).helpUsed).toContain('lesson|' + option.key);
      const help = page.locator('.help-content').getByTestId('data-boundary-help-' + id);
      await expect(help).toBeVisible();
      await expect(help.getByTestId('data-boundary-lab-' + id)).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `lesson ${id} ${option.key} overflow`).toBe(true);
      const clipped = await help.locator('svg text').evaluateAll(nodes => nodes.flatMap(node => {
        const text = node as SVGGraphicsElement, svg = text.ownerSVGElement!;
        const b = text.getBoundingClientRect(), v = svg.getBoundingClientRect();
        return v.width && (b.left < v.left - 2 || b.top < v.top - 2 || b.right > v.right + 2 || b.bottom > v.bottom + 2) ? [text.textContent] : [];
      }));
      expect(clipped, `lesson ${id} ${option.key} SVG text`).toEqual([]);
      expect(await page.locator('.cm-content').first().textContent()).toBe(editor);
      expect(await lab.getByTestId('live-model').first().getAttribute('data-state')).toBe(state);
      if (option.key === 'diagram') await help.screenshot({path: `.runtime/data-boundary-help-${id}-${width}.png`, animations: 'disabled'});
    }
    await page.getByRole('button', {name: '收起帮助', exact: true}).click();
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});

test('data boundary integration preserves neighboring chapter help and resets lesson state', async ({page}) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const id of [1,56,70,81]) {
    await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'动手观察',exact:true}).click();
    await expect(page.locator('.learning-column')).toBeVisible();
    for(const name of ['举例子','画图','拆步骤','让我试试']) await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toBeVisible();
    await page.locator('.help-panel').getByRole('button',{name:'画图',exact:true}).click();
    await expect(page.locator('.help-content')).toBeVisible();
    await expect(page.locator('.help-panel').getByRole('button',{name:'字段去哪了',exact:true})).toHaveCount(0);
  }
  await page.goto('/#lesson/71',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.getByTestId('data-boundary-lab-71');
  await lab.getByRole('button',{name:'自由实验',exact:true}).click();
  await lab.getByRole('button',{name:'单步检查',exact:true}).click();
  expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!).cursor).toBe(1);
  await page.goto('/#lesson/72',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  await expect(page.getByTestId('data-boundary-lab-72')).toBeVisible();
  await page.goto('/#lesson/71',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  await expect(lab.getByTestId('live-model')).toBeVisible();
  expect(JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!).cursor).toBe(0);
  await expect(lab.getByRole('button',{name:'单步检查',exact:true})).toBeDisabled();
  expect(errors).toEqual([]);
});
