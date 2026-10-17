import {allLessons,getLesson} from '../src/content/catalog';
import {isCodeLesson} from '../src/content/types';
import {Runner} from '../server/runner';
const ids=process.argv.slice(2).filter(x=>/^\d+$/.test(x)).map(Number),testOnly=process.argv.includes('--test-only');
const selected=ids.length?await Promise.all([...new Set(ids)].map(getLesson)):await allLessons(),lessons=selected.filter(isCodeLesson);
const requestedWorkers=Number(process.argv.find(x=>x.startsWith('--workers='))?.split('=')[1]??1);
const workers=Number.isInteger(requestedWorkers)?Math.max(1,Math.min(4,requestedWorkers)):1;
let pass=0,fail=0,cursor=0;
console.log('代码课 '+lessons.length+'；决策课 '+(selected.length-lessons.length)+'（不计入 Go 验证）');
async function verify(l:typeof lessons[number]){const runner=new Runner();
 const checks=testOnly?[{name:'test',code:l.solution,mode:'test' as const}]:[{name:'starter',code:l.code,mode:'run' as const},{name:'solution',code:l.solution,mode:'run' as const},{name:'test',code:l.solution,mode:'test' as const}];
 for(const c of checks){
  const r=runner.start(l,c.code,c.mode);while(runner.active)await new Promise(r=>setTimeout(r,40));
  const failure=c.name==='starter'?l.starterFailure:undefined,expected=c.name==='starter'?l.starterOutput:l.expectedOutput;
  const ok=failure==='timeout'?r.status==='timeout':failure==='compile'?r.status==='failed'&&r.phase==='编译':failure==='panic'?r.exitCode!==0&&/panic|fatal error/.test(r.stderr):r.status==='success'&&(c.mode==='test'||r.stdout.trim()===expected?.trim());
  if(ok){pass++;console.log('PASS',l.id,c.name);}else{fail++;console.error('FAIL',l.id,c.name,JSON.stringify({status:r.status,phase:r.phase,expected,stdout:r.stdout,stderr:r.stderr}));}
 }
}
await Promise.all(Array.from({length:workers},async()=>{while(cursor<lessons.length){const l=lessons[cursor++];await verify(l);}}));
console.log(JSON.stringify({codeLessons:lessons.length,decisionLessons:selected.length-lessons.length,pass,fail}));if(fail)process.exitCode=1;
