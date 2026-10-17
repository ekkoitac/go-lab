export type Actor = '甲' | '乙';
export type Strategy = 'own' | 'rc' | 'rr' | 'serializable';
export type Effect = 'locked' | 'waiting' | 'read' | 'write' | 'kept' | 'committed' | 'aborted' | 'retry';
export type Phase = 'lock' | 'read' | 'decide' | 'commit' | 'done' | 'aborted';
export type Rows = Record<Actor, boolean>;
export type Tx = {phase:Phase;snapshot:Rows|null;readCount:number|null;pending:boolean|null;attempt:number;waiting:boolean;trace:string[]};
export type State = {strategy:Strategy;rows:Rows;lock:Actor|null;tx:Record<Actor,Tx>;event:string;effect:Effect|null;active:Actor|null};
export type Prediction = {effect:Effect;online:number;reason:string};
export type Run = {before:State;actor:Actor;prediction:Prediction;effect:Effect;online:number;evidence:string};
export type Timeline = {state:State;runs:Run[]};
export const strategies:Record<Strategy,string>={own:'只锁自己的行 · READ COMMITTED',rc:'共同排班行锁 · READ COMMITTED',rr:'共同排班行锁 · REPEATABLE READ',serializable:'SERIALIZABLE · 完整事务重试'};
export const effects:Record<Effect,string>={locked:'获得锁',waiting:'等待共同锁',read:'读到人数',write:'暂存下线',kept:'拒绝下线',committed:'提交成功',aborted:'事务中止',retry:'开启全新事务'};
export const actors:Actor[]=['甲','乙'];
export const online=(rows:Rows)=>Number(rows.甲)+Number(rows.乙);
const fresh=(attempt=1):Tx=>({phase:'lock',snapshot:null,readCount:null,pending:null,attempt,waiting:false,trace:[]});
export function initial(strategy:Strategy='own'):Timeline {
 if(!Object.hasOwn(strategies,strategy))throw new Error('未知策略');
 return {state:{strategy,rows:{甲:true,乙:true},lock:null,tx:{甲:fresh(),乙:fresh()},event:'两位医生均在线；每位事务先统计总人数，只有人数 > 1 才申请自己下线。',effect:null,active:null},runs:[]};
}
export function actionLabel(state:State,actor:Actor):string {
 const labels:Record<Phase,string>={lock:'申请锁',read:'新 SQL 统计在线人数',decide:'按读数决定是否下线',commit:'提交事务',done:'已完成',aborted:'完整事务重试'};
 return `${actor}：${labels[state.tx[actor].phase]}`;
}
/** Deterministic teaching model, not PostgreSQL runtime or full SSI implementation. */
export function advance(previous:State,actor:Actor):State {
 if(!actors.includes(actor))throw new Error('未知事务');
 if(previous.tx[actor].phase==='done')return previous;
 const state:State=structuredClone(previous),tx=state.tx[actor];
 const common=state.strategy==='rc'||state.strategy==='rr';
 const fixed=state.strategy==='rr'||state.strategy==='serializable';
 let effect:Effect,event:string;
 switch(tx.phase){
 case 'lock': {
   if(!tx.snapshot)tx.snapshot={...state.rows};
   if(common&&state.lock!==null&&state.lock!==actor){tx.waiting=true;effect='waiting';event=`${actor}等待${state.lock}的共同排班行锁；${fixed?'事务快照已建立为 '+online(tx.snapshot)+' 人，等待不会刷新它。':'尚未统计人数；获得锁后另发 SQL 才统计。'}`;break;}
   if(common)state.lock=actor;
   tx.waiting=false;tx.phase='read';effect='locked';event=`${actor}获得${common?'共同排班行锁（只锁、不更新）':'自己的医生行锁'}。${common?'下一步另发 SQL 重读。':'另一位可同时锁自己的不同记录。'}`;break;
 }
 case 'read': {
   const view=fixed?tx.snapshot!:state.rows;
   tx.readCount=online(view);tx.phase='decide';effect='read';event=`${actor}的新 SQL 读到 ${tx.readCount} 人；使用${fixed?'事务固定快照':'本条语句的新快照'}。当前已提交视图为 ${online(state.rows)} 人。`;break;
 }
 case 'decide':
   tx.pending=tx.readCount!>1?false:null;tx.phase='commit';effect=tx.pending===false?'write':'kept';
   event=tx.pending===false?`${actor}根据读到的 ${tx.readCount} 人暂存自己下线；尚未提交，其他事务不可见。`:`${actor}只读到 ${tx.readCount} 人，拒绝自己下线以保留至少一人。`;break;
 case 'commit': {
   const other:Actor=actor==='甲'?'乙':'甲';
   if(state.strategy==='serializable'&&tx.pending===false&&tx.snapshot![other]!==state.rows[other]){
     tx.phase='aborted';tx.pending=null;effect='aborted';event=`${actor}基于旧快照的下线与已提交事务构成写偏斜；本模型在提交处令它中止（40001），暂存写入作废。必须重跑完整事务。`;
   }else{
     if(tx.pending!==null)state.rows[actor]=tx.pending;
     tx.pending=null;tx.phase='done';effect='committed';event=`${actor}提交；已提交在线人数变为 ${online(state.rows)}。${online(state.rows)===0?'跨行不变量被破坏：各行更新合法并不足够。':'至少一位仍在线。'}`;
   }
   if(state.lock===actor)state.lock=null;
   break;
 }
 case 'aborted':state.tx[actor]=fresh(tx.attempt+1);effect='retry';event=`${actor}开启第 ${tx.attempt+1} 次完整事务：清除旧快照、旧读数与旧决定，重新从锁/读取开始。`;break;
 default:return previous;
 }
 state.active=actor;state.effect=effect;state.event=event;state.tx[actor].trace.push(event);return state;
}
export function step(timeline:Timeline,actor:Actor,prediction:Prediction):Timeline {
 if(!Object.hasOwn(effects,prediction.effect)||!Number.isInteger(prediction.online)||prediction.online<0||prediction.online>2||!prediction.reason.trim())throw new Error('请先预测动作结果、已提交人数并写出理由');
 const state=advance(timeline.state,actor);if(state===timeline.state)return timeline;
 return {state,runs:[...timeline.runs,{before:timeline.state,actor,prediction:{...prediction},effect:state.effect!,online:online(state.rows),evidence:state.event}]};
}
export function back(timeline:Timeline):Timeline {const last=timeline.runs.at(-1);return last?{state:last.before,runs:timeline.runs.slice(0,-1)}:timeline;}
