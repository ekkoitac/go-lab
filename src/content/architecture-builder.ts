import type {Lesson, ExperimentSpec, DiagramSpec, DecisionSpec} from './types';
import {questions, type QuizSeed} from './builders';
export type ArchitectureSeed = {
 id:number; title:string; scenario:string; objective?:string;
 constraints:string[]; options:DecisionSpec['options']; recommendation:string;
 pitfall:string; mechanism:string[]; boundary:string; revisitWhen:string[];
 mnemonic:string; analogy?:string; analogyLimit?:string; prerequisites?:number[];
 sources:Lesson['sources']; diagram:DiagramSpec[]; experiment:ExperimentSpec; quizzes:QuizSeed[];
 code?:{starter:string;solution:string;expectedOutput:string;starterOutput?:string;starterFailure?:'compile'|'panic'|'timeout';testCode:string};
};
export function architectureLesson(s:ArchitectureSeed):Lesson {
 const common = {
 id:s.id,version:1,module:Math.floor((s.id-1)/10),title:s.title,summary:s.recommendation,scenario:s.scenario,
 objective:s.objective??('依据业务约束解释「'+s.title+'」的选择、代价与验证方法。'),
 analogy:s.analogy??s.scenario,analogyLimit:s.analogyLimit??s.boundary,
 pitfall:s.pitfall,safe:s.recommendation,mechanism:s.mechanism,boundary:s.boundary,
 prerequisites:s.prerequisites??[],sources:s.sources,experiment:s.experiment,questions:questions(s.id,s.quizzes),diagrams:s.diagram,
 decision:{constraints:s.constraints,options:s.options,recommendation:s.recommendation,revisitWhen:s.revisitWhen,mnemonic:s.mnemonic},
 help:{example:s.scenario,diagram:s.diagram.map(d=>d.caption).join('\n'),steps:s.mechanism,try:s.experiment.instruction},
 feynman:{prompt:'写下你的选择、约束与理由、接受的代价、验证办法，以及什么时候重新决策。',checklist:['说明本题约束如何支持选择','指出替代方案的适用条件和当前代价','给出可观察的验证办法和重新评估条件'],reference:s.recommendation+'\n'+s.mechanism.join('\n')+'\n重新评估：'+s.revisitWhen.join('；')}
 };
 return s.code?{...common,practice:'go',code:s.code.starter,solution:s.code.solution,expectedOutput:s.code.expectedOutput,starterOutput:s.code.starterOutput,starterFailure:s.code.starterFailure,testCode:s.code.testCode}:{...common,practice:'decision'};
}

