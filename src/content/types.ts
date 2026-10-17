export type QuestionKind = 'choice'|'multi'|'order'|'fill'|'match'|'locate';
export type QuestionStage = 'predict'|'mechanism'|'boundary'|'repair'|'transfer'|'retest';
export type Question = {id:string;stage:QuestionStage;kind:QuestionKind;prompt:string;options:{id:string;text:string;explanation:string}[];answer:string[];explanation:string};
export type SceneNode = {id:string;label:string;value:string;x:number;y:number;w?:number;active?:boolean;tone?:'good'|'bad'|'neutral'};
export type Frame = {label:string;detail:string;nodes:SceneNode[];edges?:{from:string;to:string;label?:string}[]};
export type ExperimentSpec = {kind:'memory'|'scope'|'string'|'interface'|'timeline'|'scheduler'|'channel'|'pipeline'|'graph'|'bars';title:string;instruction:string;scenarios:{label:string;frames:Frame[]}[]};
export type LessonBase = {id:number;version:number;module:number;title:string;summary:string;scenario:string;objective:string;analogy:string;analogyLimit:string;pitfall:string;safe:string;mechanism:string[];boundary:string;prerequisites:number[];sources:{title:string;url:string}[];experiment:ExperimentSpec;questions:Question[];help:{example:string;diagram:string;steps:string[];try:string};feynman:{prompt:string;checklist:string[];reference:string};versionNote?:string;diagrams?:DiagramSpec[];decision?:DecisionSpec};
export type Attempt = {questionId:string;answer:string[];correct:boolean;assisted:boolean;at:string;version:number};
export type Progress = {lessonId:number;version:number;step:number;visited:boolean;completed:boolean;favorite:boolean;draft?:string;attempts:Attempt[];revealed:string[];helpUsed:string[];reviewLevel:number;nextReview?:string;feynman?:string;feynmanChecks?:string[];updatedAt:string};
export const moduleNames=['值与变量','数组、切片与 map','结构体与抽象','控制流与错误','并发与同步','Channel 与取消','I/O、时间与 HTTP','数据与边界','测试与工具链','性能与工程实践'];
export const moduleDescriptions=['读懂每一个值背后的规则','看见数据共享与复制的边界','把类型和行为组织清楚','让执行顺序与失败变得可控','在交错的执行中保持正确','让任务有序流动，也有序结束','处理真实世界的不确定性','守住数据进入系统的边界','用证据建立对代码的信心','把能运行的程序变成可靠服务'];

export type DiagramSpec={title:string;source:string;caption:string;kind:'architecture'|'flow'|'sequence'|'state'|'dependency'};
export type DecisionSpec={constraints:string[];options:{title:string;benefits:string;costs:string;when:string}[];recommendation:string;revisitWhen:string[];mnemonic:string};
export type GoLesson=LessonBase & {practice?:'go';code:string;solution:string;expectedOutput:string;starterOutput?:string;starterFailure?:'compile'|'panic'|'timeout';testCode?:string};
export type DecisionLesson=LessonBase & {practice:'decision';code?:never;solution?:never;expectedOutput?:never;starterOutput?:never;starterFailure?:never;testCode?:never};
export type Lesson=GoLesson|DecisionLesson;
export function isCodeLesson(lesson:Lesson):lesson is GoLesson{return lesson.practice!=='decision';}
moduleNames.push('系统边界与演进','API 与协议','并发与资源治理','数据库与事务','缓存与消息','稳定性与故障隔离','性能与容量','可观测性与诊断','安全与多租户','交付与架构治理');
moduleDescriptions.push('根据业务边界选择演进方向','让契约在变化中保持可用','让并发服从资源与生命周期','在一致性与吞吐之间有据取舍','处理重复、延迟和失效窗口','让故障停止扩散并有序恢复','从证据推导性能与容量决策','把用户影响连接到诊断证据','明确身份、资源和数据边界','让每次变更可验证、可追踪');
