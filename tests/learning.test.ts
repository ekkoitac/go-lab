import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyProgress,grade,independent,practiced,recordAttempt} from '../src/learning';
import type {Question,QuestionStage} from '../src/content/types';
const day=86_400_000;
function question(stage:QuestionStage='transfer'):Question {
  return {id:`1:${stage}`,stage,kind:'choice',prompt:'选择能保持原值的操作',options:[
    {id:'copy',text:'复制后修改',explanation:'新对象隔离修改'},
    {id:'alias',text:'直接共享并修改',explanation:'仍然修改原对象'}
  ],answer:['copy'],explanation:'先解除共享，再修改副本。'};
}

test('首次未求助迁移题正确：同时获得练习和独立证据',()=>{
  const p=emptyProgress(1),a=recordAttempt(p,question(),['copy']);
  assert.equal(a.correct,true);assert.equal(a.assisted,false);
  assert.equal(a.version,1);assert.equal(p.attempts.length,1);
  assert.equal(practiced(p),true);assert.equal(independent(p),true);
});

test('首次预测正确只算练习，不能冒充迁移掌握',()=>{
  const p=emptyProgress(1);recordAttempt(p,question('predict'),['copy']);
  assert.equal(practiced(p),true);assert.equal(independent(p),false);
  assert.equal(p.nextReview,undefined);
});

test('对该题请求提示后答对，记录为辅助练习',()=>{
  const p=emptyProgress(1),q=question();p.helpUsed.push(q.id+'|example');
  const a=recordAttempt(p,q,['copy']);
  assert.equal(a.correct,true);assert.equal(a.assisted,true);
  assert.equal(practiced(p),true);assert.equal(independent(p),false);
});

test('看过该题答案后答对，不产生独立证据',()=>{
  const p=emptyProgress(1),q=question();p.revealed.push(q.id);
  assert.equal(recordAttempt(p,q,['copy']).assisted,true);
  assert.equal(independent(p),false);
});

test('首次答错后改对属于重复练习，不能覆盖首次失误',()=>{
  const p=emptyProgress(1),q=question();const first=recordAttempt(p,q,['alias']);
  const second=recordAttempt(p,q,['copy']);
  assert.equal(first.correct,false);assert.equal(first.assisted,false);
  assert.equal(second.correct,true);assert.equal(second.assisted,true);
  assert.equal(p.attempts.length,2);assert.equal(independent(p),false);
});

test('首次正确后重复提交不新增独立尝试，也保留原来的独立证据',()=>{
  const p=emptyProgress(1),q=question();recordAttempt(p,q,['copy']);
  assert.equal(recordAttempt(p,q,['copy']).assisted,true);
  assert.equal(p.attempts.filter(a=>a.correct&&!a.assisted).length,1);
  assert.equal(independent(p),true);
});

test('看过迁移题解释后，未揭示的复测变体仍可独立尝试',()=>{
  const p=emptyProgress(1);p.revealed.push(question('transfer').id);
  const a=recordAttempt(p,question('retest'),['copy']);
  assert.equal(a.assisted,false);assert.equal(independent(p),true);
});

test('内容版本隔离：保留旧尝试，但不把旧结果或次数算作新题证据',()=>{
  const old=emptyProgress(1,1);recordAttempt(old,question(),['copy']);
  const p=emptyProgress(1,2);p.attempts=[...old.attempts];
  assert.equal(practiced(p),false);assert.equal(independent(p),false);
  const current=recordAttempt(p,question(),['copy']);
  assert.equal(current.assisted,false);assert.equal(current.version,2);
  assert.equal(p.attempts.length,2);assert.equal(independent(p),true);
});

test('复习成功间隔完整覆盖1、3、7、14天，并在14天保持',t=>{
  let now=Date.parse('2026-10-15T00:00:00.000Z');
  t.mock.method(Date,'now',()=>now);
  const p=emptyProgress(1),intervals:number[]=[];
  for(let i=0;i<5;i++){
    recordAttempt(p,question('retest'),['copy']);
    const due=Date.parse(p.nextReview!);intervals.push((due-now)/day);now=due;
  }
  assert.deepEqual(intervals,[1,3,7,14,14]);
});

test('复习答错后回到一天，之后重新开始间隔序列',t=>{
  const now=Date.parse('2026-10-15T00:00:00.000Z');t.mock.method(Date,'now',()=>now);
  const p=emptyProgress(1);p.reviewLevel=3;
  recordAttempt(p,question('retest'),['alias']);
  assert.equal(p.reviewLevel,0);assert.equal(Date.parse(p.nextReview!)-now,day);
  recordAttempt(p,question('retest'),['copy']);
  assert.equal(Date.parse(p.nextReview!)-now,day);
});

test('多选忽略顺序；排序和匹配保留顺序；填空修剪空白',()=>{
  const q=question();
  assert.equal(grade({...q,kind:'multi',answer:['a','b']},['b','a']),true);
  assert.equal(grade({...q,kind:'multi',answer:['a','b']},['a']),false);
  assert.equal(grade({...q,kind:'order',answer:['a','b']},['b','a']),false);
  assert.equal(grade({...q,kind:'match',answer:['a','b']},['b','a']),false);
  assert.equal(grade({...q,kind:'fill',answer:['false']},[' False ']),true);
});
