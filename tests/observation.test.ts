import test from 'node:test';
import assert from 'node:assert/strict';
import {frame} from '../src/content/builders';
import {introLessons} from './intro-lessons';
import {arrayCells,layoutScene,wrapText} from '../src/components/scene-layout';

test('equality operators remain in labels and state cards do not imply relationships',()=>{
 const f=frame('比较','说明',['==比较=false','err == nil=false','input=x=3','text=']);
 assert.deepEqual(f.nodes.map(n=>[n.label,n.value]),[['==比较','false'],['err == nil','false'],['input','x=3'],['text','']]);
 assert.deepEqual(f.edges,[]);
});
test('only array literals become memory cells and complete text survives wrapping',()=>{
 for(const value of ['len 2 / cap 4','仍可达 1024 bytes','A[10 20] len2 cap2'])assert.equal(arrayCells(value),null);
 assert.deepEqual(arrayCells('[100 99 300]'),['100','99','300']);
 assert.deepEqual(arrayCells('[SALE]'),['SALE']);
 for(const text of ['0.30000000000000004','pointer → 原始账户余额','🙂'.repeat(8)])assert.equal(wrapText(text,90,14).join(''),text);
});
test('every scene has complete labels and values and fits its allocated height',async()=>{
 for(const lesson of introLessons)for(const scenario of lesson.experiment.scenarios)for(const f of scenario.frames){
  for(const n of f.nodes)assert.ok(n.label.trim(),`lesson ${lesson.id} empty label`);
  for(const width of [280,450,620]){
   const layout=layoutScene(f,width,lesson.experiment.kind);
   for(const node of layout.nodes){assert.equal(node.labels.join(''),node.label);assert.equal(node.values.join(''),node.value);assert.ok(node.y+node.h<=layout.height);}
  }
 }
});
test('fixed scenarios start with the conditions they actually use',async()=>{
 const lessons=introLessons,get=(id:number)=>lessons.find(l=>l.id===id)!;
 assert.ok(get(66).experiment.scenarios[1].frames[0].nodes.some(n=>n.value==='已设置超时'));
 assert.ok(get(93).experiment.scenarios[1].frames[0].nodes.some(n=>n.value==='0 cap3'));
 assert.ok(get(82).experiment.scenarios[0].frames[1].nodes.some(n=>n.value==='FAIL'));
 assert.equal(get(5).experiment.scenarios[0].frames[1].nodes[0].value,'0.30000000000000004');
});

// Regressions for operations that can legitimately leave visible values unchanged.
import {sceneChanges} from '../src/components/scene-changes';
test('scene differences distinguish unchanged values, updates, new and omitted cards',()=>{
 const start=frame('before','',['a=2','b=9','old=kept elsewhere']);
 const next=frame('after','',['b=9','a=9','new=3']);
 assert.deepEqual(sceneChanges(next,start),[
  {label:'a',before:'2',after:'9'},
  {label:'new',before:undefined,after:'3'},
  {label:'old',before:'kept elsewhere'},
 ]);
 assert.deepEqual(sceneChanges(frame('b=a','assignment keeps 9',['a=9','b=9']),frame('a=b','',['a=9','b=9'])),[]);
 assert.deepEqual(sceneChanges(start),[]);
});
test('all introductory diagrams name actual operations and concrete branch conditions',()=>{
 for(const lesson of introLessons){
  const spec=lesson.experiment;
  assert.ok(!/改变目标长度/.test(spec.instruction),'must name the existing condition buttons, not a missing slider');
  for(const scenario of spec.scenarios){
   assert.ok(!/^(遗漏处理|完整处理|宽松或遗漏|明确边界|原验证方式|加入关键证据|原方案|有依据的改进)$/.test(scenario.label),`${lesson.id}: generic condition`);
   for(const f of scenario.frames)assert.ok(!/^(步骤|调度) \d+$/.test(f.label),`${lesson.id}: unnamed operation`);
  }
 }
});
test('copy exposes the copied values before the independent mutation',()=>{
 const frames=introLessons.find(l=>l.id===16)!.experiment.scenarios[1].frames;
 assert.equal(frames.length,3);
 assert.equal(frames[1].nodes.find(n=>n.label==='dst')!.value,'[3 6 9]');
 assert.equal(frames[2].nodes.find(n=>n.label==='dst')!.value,'[99 6 9]');
 assert.equal(frames[2].nodes.find(n=>n.label==='src')!.value,'[3 6 9]');
});
