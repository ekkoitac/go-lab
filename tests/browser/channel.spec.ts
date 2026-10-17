import {test,expect} from '@playwright/test';

test('切片容量2发生分配，容量3复用并更新原数组；占用槽位不再显示为空',async({page})=>{
  await page.goto('/#lesson/14');
  await page.getByRole('button',{name:'动手观察',exact:true}).click();
  const lab=page.locator('.learning-column .special-lab'),model=lab.getByTestId('live-model');
  await lab.getByRole('slider',{name:'切片容量'}).fill('2');
  await lab.getByRole('button',{name:'执行 b := append(a, 30)',exact:true}).click();
  await lab.getByRole('button',{name:'执行 b[0] = 99',exact:true}).click();
  await expect(model.locator('.array-row')).toHaveCount(2);
  expect(await model.locator('.array-row').nth(0).locator('.cell').first().evaluate(el=>el.lastChild?.textContent)).toBe('10');
  expect(await model.locator('.array-row').nth(1).locator('.cell').first().evaluate(el=>el.lastChild?.textContent)).toBe('99');
  await lab.getByRole('slider',{name:'切片容量'}).fill('3');
  await lab.getByRole('button',{name:'执行 b := append(a, 30)',exact:true}).click();
  await expect(model.locator('.array-row')).toHaveCount(1);
  await expect(model.locator('.cell').nth(2)).not.toHaveClass(/unused/);
  await lab.getByRole('button',{name:'执行 b[0] = 99',exact:true}).click();
  expect(await model.locator('.cell').first().evaluate(el=>el.lastChild?.textContent)).toBe('99');
});
