import assert from 'node:assert/strict';
import {allLessons,catalog,courses,lessonsForCourse,isLessonId,modules} from '../src/content/catalog';
import {isCodeLesson} from '../src/content/types';
const primaryHosts=new Set(['go.dev','pkg.go.dev','tip.golang.org','golang.org','github.com','grpc.io','protobuf.dev','www.postgresql.org','postgresql.org','redis.io','kafka.apache.org','www.rabbitmq.com','rabbitmq.com','kubernetes.io','opentelemetry.io','prometheus.io','sre.google','cheatsheetseries.owasp.org','owasp.org','slsa.dev','docs.aws.amazon.com','aws.amazon.com','learn.microsoft.com','cloud.google.com','research.google','etcd.io','www.rfc-editor.org','rfc-editor.org','google.aip.dev','web.mit.edu']);
export async function checkContent(){
 const lessons=await allLessons();assert.equal(lessons.length,200);assert.equal(catalog.length,lessons.length);assert.equal(new Set(lessons.map(l=>l.id)).size,lessons.length);
 for(const course of courses)assert.equal(lessonsForCourse(course.id).length,100);
 const kinds=new Set<string>();let scenarios=0,code=0,decision=0,diagrams=0;
 for(const l of lessons){
  assert.ok(modules[l.module].lessonIds.includes(l.id));
  for(const field of ['title','summary','scenario','objective','analogy','analogyLimit','pitfall','safe','boundary'] as const)assert.ok(l[field]?.trim(),l.id+' missing '+field);
  assert.ok(l.mechanism.length>=2);
  if(isCodeLesson(l)){code++;for(const field of ['code','solution','expectedOutput'] as const)assert.ok(l[field]?.trim(),l.id+' missing '+field);assert.ok(l.starterOutput!==undefined||l.starterFailure);if(l.id>100)assert.ok(l.testCode?.includes('func Test')&&l.testCode.includes('func Benchmark'),l.id+' needs behavior tests and benchmark');}
  else{decision++;assert.equal(l.code,undefined);assert.ok(l.decision);}
  assert.equal(l.questions.length,6);assert.deepEqual(l.questions.map(q=>q.stage),['predict','mechanism','boundary','repair','transfer','retest']);
  assert.notEqual(l.questions[4].prompt,l.questions[5].prompt);
  for(const q of l.questions){kinds.add(q.kind);assert.ok(q.prompt&&q.explanation);assert.ok(q.options.every(o=>o.text&&o.explanation));assert.equal(new Set(q.options.map(o=>o.id)).size,q.options.length);assert.ok(q.answer.length);if(q.kind!=='fill')assert.ok(q.answer.every(a=>q.options.some(o=>o.id===a)));}
  assert.ok(l.sources.length&&l.sources.every(s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&primaryHosts.has(u.hostname)}catch{return false}}),l.id+' primary sources');
  assert.ok(l.experiment.scenarios.length>=2);scenarios+=l.experiment.scenarios.length;
  for(const scenario of l.experiment.scenarios){
   assert.ok(scenario.frames.length>=2,l.id+' insufficient frames');
   assert.ok(new Set(scenario.frames.map(f=>JSON.stringify({nodes:f.nodes,edges:f.edges}))).size>1,l.id+' no model change');
   for(const f of scenario.frames){assert.ok(f.nodes.length);assert.equal(new Set(f.nodes.map(n=>n.id)).size,f.nodes.length);assert.ok((f.edges??[]).every(e=>f.nodes.some(n=>n.id===e.from)&&f.nodes.some(n=>n.id===e.to)),l.id+' missing edge node');}
  }
  assert.ok(l.help.example&&l.help.diagram&&l.help.steps.length&&l.help.try);assert.ok(l.feynman.checklist.length>=3&&l.feynman.reference);
  assert.ok(l.prerequisites.every(id=>isLessonId(id)&&id!==l.id));
  if(l.id>100){
   assert.equal(catalog.find(c=>c.id===l.id)?.title,l.title,l.id+' catalog title');
   const d=l.decision;assert.ok(d&&d.constraints.length>=2&&d.options.length>=2&&d.revisitWhen.length&&d.mnemonic.trim(),l.id+' decision case');
   assert.ok(d.options.every(o=>o.title&&o.benefits&&o.costs&&o.when),l.id+' incomplete tradeoffs');
   assert.ok(l.diagrams?.length,l.id+' missing diagram');
   for(const diagram of l.diagrams!){assert.ok(diagram.title&&diagram.caption&&diagram.source);assert.ok(/^(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|mindmap|block-beta)/.test(diagram.source.trim()),l.id+' diagram syntax');diagrams++;}
  }
 }
 console.log(lessons.length+' 课程 / '+lessons.reduce((s,l)=>s+l.questions.length,0)+' 题 / '+kinds.size+' 种题型 / '+scenarios+' 场景 / '+code+' 代码课 / '+decision+' 决策课 / '+diagrams+' Mermaid 图：完整性通过');
}
await checkContent();
