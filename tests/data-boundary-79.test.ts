import test from 'node:test';
import assert from 'node:assert/strict';
import {scenario,pathState,createSession,transition,changeInput,repairCheck,type Platform,type Scenario} from '../src/components/data-boundary-lab/lesson79/model';
for(const platform of ['unix','windows'] as Platform[])test(`79 ${platform}: lexical and filesystem boundaries remain distinct`,()=>{
 for(const id of ['normal','parent','absolute','inside','outside','prefix'] as Scenario[]){const s=scenario({platform,scenario:id});assert.equal(s.allowed,['normal','inside'].includes(id));assert.equal(s.local,['normal','inside','outside'].includes(id));}
 const outside=scenario({platform,scenario:'outside'});assert.equal(outside.local,true);assert.equal(outside.allowed,false);assert.equal(outside.link,'portal → ..');
 const prefix=scenario({platform,scenario:'prefix'});assert.ok(prefix.target.startsWith(prefix.root));assert.equal(prefix.allowed,false);
});
test('79 Unix backslash is a filename; Windows backslash traverses',()=>{
 const unix=scenario({platform:'unix',scenario:'backslash'}),windows=scenario({platform:'windows',scenario:'backslash'});assert.equal(unix.local,true);assert.equal(unix.allowed,true);assert.equal(windows.local,false);assert.equal(windows.allowed,false);
});
test('79 reveal stages, replay and condition changes',()=>{
 let s=createSession();assert.equal(transition(s,'next').step,0);s={...s,prediction:'allow',reason:'没有父目录段',locked:true};
 s=transition(s,'next');assert.equal(pathState(s.input,s.step).local,null);s=transition(s,'next');assert.equal(pathState(s.input,s.step).target,null);s=transition(s,'next');const final=pathState(s.input,s.step);assert.equal(final.allowed,false);assert.equal(final.route.length,3);s=transition(transition(s,'back'),'next');assert.deepEqual(pathState(s.input,s.step),final);
 s=changeInput(s,{platform:'windows',scenario:'inside'});assert.equal(s.step,0);assert.equal(s.prediction,'');assert.equal(s.reason,'');assert.equal(s.locked,false);assert.equal(transition(s,'next',true).step,1);assert.deepEqual(transition(s,'reset'),createSession());
});
test('79 repair must block symlink as well as lexical escape',()=>{assert.equal(repairCheck('clean').filter(c=>c.actual===c.expected).length,1);assert.equal(repairCheck('local').filter(c=>c.actual===c.expected).length,2);assert.ok(repairCheck('root').every(c=>c.actual===c.expected));});
