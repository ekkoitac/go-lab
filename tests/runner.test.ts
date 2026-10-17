import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {Runner,capabilities,type RunRecord,type RunMode} from '../server/runner';
import module04 from '../src/content/module04';

const code=(body:string)=>`package main\nimport "fmt"\nfunc solve() string { ${body} }\nfunc main(){ fmt.Println(solve()) }\n`;
if(module04[0].practice==='decision')throw Error('Runner fixture must be code');
const fixture={...module04[0],expectedOutput:'7',testCode:undefined};
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(predicate:()=>boolean,timeout=80000){const end=Date.now()+timeout;while(!predicate()){if(Date.now()>end)throw Error('等待执行器状态超时');await sleep(25);}}
async function completed(runner:Runner,record:RunRecord){await until(()=>runner.active===null);assert.equal(runner.records.get(record.id),record);return record;}

test('真实 Go 执行器：编译、运行、终止与目录回收', {timeout:600000,concurrency:false},async t=>{
 const caps=await capabilities();
 assert.equal(caps.available,true,'验收需要已安装的本机 Go；请设置 GO100_GO_PATH。');
 const previous=process.cwd(),dir=await mkdtemp(join(tmpdir(),'go100-runner-test-'));
 const events:RunRecord[]=[];
 const runner=new Runner(r=>events.push(structuredClone(r)),{compileMs:60000,runMs:350,testMs:15000,outputBytes:4096});
 process.chdir(dir);
 const run=async(source:string,mode:RunMode='run')=>completed(runner,runner.start(fixture,source,mode));
 try {
  await t.test('普通运行来自实际 Go 标准输出并保存状态',async()=>{
   const r=await run(code('n:=3+4; return fmt.Sprint(n)'));
   assert.equal(r.status,'success');assert.equal(r.stdout.trim(),'7');assert.equal(r.exitCode,0);
   assert.deepEqual(events.filter(x=>x.id===r.id).map(x=>x.status),['queued','compiling','running','success']);
   assert.equal(runner.active,null);assert.ok(r.durationMs>=0);
  });
  await t.test('语法错误停在编译阶段，保留错误输出',async()=>{
   const r=await run('package main\nfunc main( {');
   assert.equal(r.status,'failed');assert.equal(r.phase,'编译');assert.notEqual(r.exitCode,0);
   assert.match(r.stderr,/syntax error|expected/i);assert.equal(r.stdout,'');
  });
  await t.test('panic 是运行失败并能诊断',async()=>{
   const r=await run(code('panic("lesson-panic")'));
   assert.equal(r.status,'failed');assert.equal(r.phase,'运行');assert.notEqual(r.exitCode,0);
   assert.match(r.stderr,/panic: lesson-panic/);
  });
  await t.test('不退出的计算循环超时并回收进程',async()=>{
   const r=await run('package main\nfunc main(){ for {} }');
   assert.equal(r.status,'timeout');assert.equal(r.phase,'运行');assert.equal(runner.active,null);
  });
  await t.test('大量中文输出到达字节上限后停止且不无限累计',async()=>{
   const r=await run('package main\nimport("fmt";"strings")\nfunc main(){ for {fmt.Print(strings.Repeat("界",8192))} }');
   assert.equal(r.status,'output-limit');assert.ok(Buffer.byteLength(r.stdout+r.stderr)<=4096);
   assert.ok(r.stdout.length>0);assert.ok(!r.stdout.includes('\uFFFD'),'截断不能把完整中文损坏成替代字符');assert.equal(runner.active,null);
  });
  await t.test('运行时取消、单任务排他及再次取消',async()=>{
   const r=runner.start(fixture,'package main\nfunc main(){ for {} }','run');
   assert.throws(()=>runner.start(fixture,code('return "7"'),'run'),/已有任务/);
   await until(()=>r.status==='running'||runner.active===null);
   assert.equal(r.status,'running');assert.equal(await runner.cancel(r.id),true);
   await completed(runner,r);assert.equal(r.status,'cancelled');
   assert.equal(await runner.cancel(r.id),false);
  });
  await t.test('测试模式真正执行断言，成功与错误答案可区分',async()=>{
   const pass=await run(code('return "7"'),'test');
   assert.equal(pass.status,'success');assert.match(pass.stdout,/PASS/);
   const fail=await run(code('return "8"'),'test');
   assert.equal(fail.status,'failed');assert.match(fail.stdout,/FAIL/);assert.match(fail.stdout,/结果不符/);
  });
  await t.test('基准模式实际运行 Go benchmark',async()=>{
   const r=await run(code('return fmt.Sprint(3+4)'),'bench');
   assert.equal(r.status,'success');assert.match(r.stdout,/BenchmarkSolution/);assert.match(r.stdout,/ns\/op/);
  });
  await t.test('全部临时运行目录已回收',async()=>{
   assert.deepEqual(await readdir(join(dir,'.runtime','runs')),[]);
   assert.equal(runner.active,null);
  });
 }finally{
  if(runner.active){await runner.cancel(runner.active.record.id);await until(()=>runner.active===null);}
  process.chdir(previous);
  const absolute=resolve(dir);assert.ok(absolute.startsWith(resolve(tmpdir())+sep),'只清理本测试创建的临时目录');
  await rm(absolute,{recursive:true,force:true,maxRetries:4,retryDelay:100});
 }
});


