import {test,expect} from '@playwright/test';
// Keep the historic capacity regression; the rest of chapter 6 has dedicated suites.
test('slice capacities 2 and 3 give separate and shared backing arrays',async({page})=>{
 await page.goto('/#lesson/14');
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('collections-lab-14');
 for(const cap of [2,3]){
  await lab.getByRole('slider',{name:'切片容量'}).fill(String(cap));
  await lab.getByLabel('我的预测').selectOption(cap===2?'no':'yes');
  await lab.getByLabel('我的依据').fill('比较新长度 3 与容量 '+cap);
  await lab.getByRole('button',{name:'执行并核对预测'}).click();
  let state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.shared).toBe(cap===3);
  expect(state.arrays[state.b.array][2]).toBe(30);
  await lab.getByLabel('操作',{exact:true}).selectOption('write');
  await lab.getByLabel('整数值').fill('99');
  await lab.getByLabel('我的预测').selectOption(cap===2?'no':'yes');
  await lab.getByLabel('我的依据').fill('根据数组归属判断第一格是否被共同访问');
  await lab.getByRole('button',{name:'执行并核对预测'}).click();
  state=JSON.parse((await lab.getByTestId('live-model').getAttribute('data-state'))!);
  expect(state.arrays.A[0]).toBe(cap===2?10:99);
  expect(state.arrays[state.b.array][0]).toBe(99);
 }
});
