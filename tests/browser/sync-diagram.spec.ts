import {test, expect} from '@playwright/test';

// Diagram contracts are lesson-specific. Check meaningful graphical structure,
// readable SVG text, and separation from the full experiment across all ten.
for (const ids of [[41,42,43,44,45], [46,47,48,49,50]]) {
  test(`sync relationship diagrams ${ids}: visible representations and isolated help state`, async ({page}) => {
    test.setTimeout(120000);
    for (const id of ids) {
      await page.goto('/#lesson/' + id);
      await page.getByRole('button', {name: '动手观察', exact: true}).click();
      const lab = page.getByTestId(`lesson${id}-lab`);
      await expect(lab).toBeVisible();
      const snapshot = await lab.getByTestId('live-model').first().getAttribute('data-state');
      await page.locator('.help-panel').getByRole('button', {name: '画图', exact: true}).click();
      const help = page.getByTestId(`lesson${id}-help`);
      await expect(help).toBeVisible();
      await expect(help.getByTestId(`lesson${id}-lab`)).toHaveCount(0);
      const text = await help.innerText();
      expect(text.length).toBeGreaterThan(60);
      const problems = await help.locator('svg[viewBox]').evaluateAll(svgs => svgs.flatMap(element => {
        const svg = element as SVGSVGElement, view = svg.viewBox.baseVal;
        return [...svg.querySelectorAll('text')].flatMap(text => {
          const b = text.getBBox();
          return b.x < view.x - 1 || b.y < view.y - 1 || b.x + b.width > view.x + view.width + 1 || b.y + b.height > view.y + view.height + 1 ? [text.textContent] : [];
        });
      }));
      expect(problems, `SVG text outside lesson ${id} diagram`).toEqual([]);
      await expect(lab.getByTestId('live-model').first()).toHaveAttribute('data-state', snapshot!);
    }
  });
}
