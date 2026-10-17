import {test,expect} from '@playwright/test';
import {drawing} from '../../src/components/sync-lab/diagrams';
import {guides,replay,routeFor} from '../../src/components/sync-lab/guides';
test.setTimeout(180000);
for(const width of [1440,390])test('independent diagrams: all ten lessons, all frames, geometry and keyboard at '+width,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(let id=41;id<=50;id++){
  await page.goto('/#lesson/'+id);
  const help=page.locator('.help-panel');await help.getByRole('button',{name:'画图',exact:true}).click();
  const panel=help.getByTestId('sync-diagram');await expect(panel).toBeVisible();
  await expect(help.getByTestId('sync-lab')).toHaveCount(0);
  await expect(panel.locator('textarea,.sync-metrics,.sync-actions,.sync-compare')).toHaveCount(0);
  for(const fixed of [false,true]){
   await panel.getByRole('button',{name:guides[id].conditions[fixed?1:0],exact:true}).click();
   const frames=replay(id,fixed,2,routeFor(id,fixed,2)),slider=panel.getByLabel('图解步骤');
   for(let step=0;step<frames.length;step++){
    await slider.fill(String(step));await expect(panel).toHaveAttribute('data-state',JSON.stringify(frames[step]));
    const graph=drawing(frames[step]);await expect(panel.locator('.sync-drawing-node')).toHaveCount(graph.nodes.length);await expect(panel.locator('.sync-drawing-edge')).toHaveCount(graph.edges.length);
    const issues=await panel.locator('svg').evaluate(svg=>{
     const problems:string[]=[];
     for(const text of svg.querySelectorAll('text')){const box=text.getBBox();if(box.x<0||box.y<0||box.x+box.width>400||box.y+box.height>350)problems.push('canvas overflow: '+text.textContent);}
     for(const node of svg.querySelectorAll('.sync-drawing-node')){const box=node.querySelector('rect')!.getBBox(),text=node.querySelector('text')!.getBBox();if(text.x<box.x||text.y<box.y||text.x+text.width>box.x+box.width||text.y+text.height>box.y+box.height)problems.push('node overflow: '+node.textContent);}
     for(const label of svg.querySelectorAll<SVGTextElement>('.sync-drawing-edge>text')){const a=label.getBBox();for(const rect of svg.querySelectorAll<SVGRectElement>('.sync-drawing-node>rect')){const b=rect.getBBox();if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>2)problems.push('edge label overlaps node: '+label.textContent);}}
     return problems;
    });
    expect(issues,'lesson '+id+' fixed '+fixed+' step '+step).toEqual([]);
   }
   if(width===1440)await panel.screenshot({path:'.runtime/sync-diagram-'+id+'-'+Number(fixed)+'.png'});
  }
  const node=panel.locator('.sync-drawing-node').first();await node.focus();await page.keyboard.press('Enter');await expect(node).toHaveAttribute('aria-pressed','true');await expect(panel.locator('.sync-diagram-inspect')).toBeVisible();
  await panel.getByRole('button',{name:'从头看',exact:true}).click();await expect(panel.getByLabel('图解步骤')).toHaveValue('0');await expect(panel.getByRole('button',{name:'上一帧',exact:true})).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+id).toBe(true);
  if(width===390&&id===46)await panel.screenshot({path:'.runtime/sync-diagram-mobile.png'});
 }
 expect(errors).toEqual([]);
});
test('deadlock ring uses actual wait edges and selection follows connected objects',async({page})=>{
 await page.goto('/#lesson/46');await page.locator('.help-panel').getByRole('button',{name:'画图',exact:true}).click();
 const panel=page.getByTestId('sync-diagram');await expect(panel.locator('.sync-drawing-edge.waiting')).toHaveCount(2);
 await panel.locator('[data-node=t0]').click();await expect(panel.locator('.sync-drawing-edge.highlight')).toHaveCount(2);
 await panel.getByLabel('图解步骤').fill('2');await expect(panel.locator('.sync-drawing-edge.waiting')).toHaveCount(0);
 await panel.getByRole('button',{name:guides[46].conditions[1],exact:true}).click();await expect(panel.locator('.sync-drawing-edge.waiting')).toHaveCount(0);
});

