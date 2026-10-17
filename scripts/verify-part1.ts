import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import m1 from '../src/content/module01';
import m2 from '../src/content/module02';
import m3 from '../src/content/module03';
const lessons=[...m1,...m2,...m3];
const base=await fs.mkdtemp(path.join(os.tmpdir(),'go100-part1-'));
let passed=0;
const failures:string[]=[];
const run=(file:string)=>new Promise<{code:number|null;out:string;err:string}>((resolve)=>{const proc=spawn('go',['run',file],{cwd:base,env:{...process.env,GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off',GOWORK:'off',CGO_ENABLED:'0'},windowsHide:true});let out='',err='';proc.stdout.on('data',b=>out+=b);proc.stderr.on('data',b=>err+=b);proc.on('error',e=>resolve({code:-1,out,err:String(e)}));proc.on('close',code=>resolve({code,out:out.trim(),err}));});
for(const l of lessons){
 for(const mode of ['starter','solution'] as const){
  const file=path.join(base,`${l.id}-${mode}.go`);await fs.writeFile(file,mode==='starter'?l.code:l.solution);
  const result=await run(file); const failure=mode==='starter'?l.starterFailure:undefined;
  const expected=mode==='starter'?l.starterOutput:l.expectedOutput;
  const ok=failure?result.code!==0&&(failure==='panic'?result.err.includes('panic:'):!result.err.includes('panic:')):result.code===0&&result.out===expected;
  if(ok) passed++;else failures.push(`${l.id} ${mode}: expected ${failure??JSON.stringify(expected)}; got ${JSON.stringify(result)}`);
 }
}
console.log(JSON.stringify({lessons:lessons.length,checks:passed+failures.length,passed,failures,temporaryDirectory:base},null,2));
if(failures.length) process.exitCode=1;
