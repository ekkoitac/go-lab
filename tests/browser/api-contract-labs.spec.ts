import {test,expect,type Page,type Locator} from '@playwright/test';

const ids=process.env.API_LAB_IDS?.split(',').map(Number)??Array.from({length:10},(_,i)=>111+i);
async function progress(page:Page,id:number){
 return page.evaluate(async lessonId=>{
  const {token}=await(await fetch('/api/session')).json();
  const p=await(await fetch('/api/progress/'+lessonId,{headers:{'x-lab-token':token}})).json();
  return {draft:p.draft??null,feynman:p.feynman??null,attempts:p.attempts,revealed:p.revealed,completed:p.completed,reviewLevel:p.reviewLevel};
 },id);
}
async function fits(page:Page,root:Locator,label:string){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' page overflow').toBe(true);
 expect(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+' panel overflow').toBe(true);
 const clipped=await root.locator('svg text').evaluateAll(nodes=>nodes.filter(node=>{
  const b=node.getBoundingClientRect(),v=(node as SVGGraphicsElement).ownerSVGElement!.getBoundingClientRect();
  return v.width>0&&(b.left<v.left-2||b.top<v.top-2||b.right>v.right+2||b.bottom>v.bottom+2);
 }).map(n=>n.textContent));
 expect(clipped,label+' clipped SVG text').toEqual([]);
 const faint=await root.evaluate(el=>{
  const rgb=(value:string)=>value.match(/[\d.]+/g)?.map(Number)??[];
  const light=(color:number[])=>color.slice(0,3).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  return [el,el.querySelector('h3,h4'),el.querySelector('p'),el.querySelector('label'),el.querySelector('[class$="-note"]')].filter((node):node is Element=>!!node).flatMap(node=>{
   if(!node.getBoundingClientRect().width)return [];
   let ancestor:Element|null=node,bg=[255,255,255];
   while(ancestor){const candidate=rgb(getComputedStyle(ancestor).backgroundColor);if(candidate.length===3||candidate[3]===1){bg=candidate;break;}ancestor=ancestor.parentElement;}
   const a=light(rgb(getComputedStyle(node).color)),b=light(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   return ratio<4.5?[{text:node.textContent?.slice(0,30),ratio:Math.round(ratio*100)/100}]:[];
  });
 });
 expect(faint,label+' low contrast text').toEqual([]);
}
for(const width of [1440,390])for(const id of ids)test(`${id}: four separate help views, reversible model and isolation at ${width}px`,async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const errors:string[]=[],forbidden:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&/\/progress\/\d+\/(attempt|reveal)$/.test(r.url()))forbidden.push(r.url());});
 await page.goto('/#lesson/'+id,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'动手观察',exact:true}).click();
 const lab=page.getByTestId('architecture-lab-'+id),model=lab.getByTestId('live-model').first();
 await expect(model).toBeVisible();await fits(page,lab,`${id} lab`);
 const original=await model.getAttribute('data-state');expect(original).toBeTruthy();
 const step=lab.locator('[data-arch-action=step]').first();
 await expect(step).toBeEnabled();await step.focus();await page.keyboard.press('Enter');
 await expect(model).not.toHaveAttribute('data-state',original!);
 const advanced=await model.getAttribute('data-state');
 await lab.locator('[data-arch-action=back]').first().click();await expect(model).toHaveAttribute('data-state',original!);
 await step.click();await expect(model).toHaveAttribute('data-state',advanced!);
 await lab.locator('[data-arch-action=reset]').first().click();await expect(model).toHaveAttribute('data-state',original!);
 const before=await progress(page,id),views:string[]=[];
 for(const name of ['举例子','画图','拆步骤','让我试试']){
  await page.locator('.help-panel').getByRole('button',{name,exact:true}).click();
  await expect(page.locator('.help-panel').getByRole('button',{name,exact:true})).toHaveClass(/selected/);
  const help=page.getByTestId('architecture-help-'+id);await expect(help).toBeVisible();
  await expect(help.getByTestId('architecture-lab-'+id)).toHaveCount(0);
  views.push(await help.innerText());await fits(page,help,`${id} ${name}`);
  await expect(model).toHaveAttribute('data-state',original!);
  await help.screenshot({path:`.runtime/api-contract-labs/help-${id}-${width}-${name}.png`,animations:'disabled'});
 }
 expect(new Set(views).size).toBe(4);
 await page.getByRole('button',{name:'收起帮助',exact:true}).click();
 expect(await progress(page,id)).toEqual(before);expect(forbidden).toEqual([]);expect(errors).toEqual([]);
 await lab.screenshot({path:`.runtime/api-contract-labs/lab-${id}-${width}.png`,animations:'disabled'});
});
