export const actions={expand:'新增 full_name（Expand）',compat:'部署兼容版 + 旧写同步触发器',capture:'读取一行回填快照',newWrite:'新实例写入「新名字」',oldWrite:'旧实例写入「旧版更新」',backfill:'按版本条件回填',unsafeBackfill:'错误示范：盲目回填旧快照',validate:'校验两列与最新业务值',switchRead:'新实例切读 full_name',retire:'退出全部旧实例',closeWindow:'结束应用回滚窗口',contract:'独立收缩：安全删除旧列',drop:'错误示范：直接删除旧列',rollback:'将应用回滚到旧版'} as const;
export type Action=keyof typeof actions;
export type Effect='ok'|'blocked'|'damage';
export const effects:Record<Effect,string>={ok:'动作成功，未新增破坏',blocked:'前置条件不满足，被阻止',damage:'操作执行，但兼容性或数据受损'};
export interface State{oldColumn:boolean;newColumn:boolean;contracted:boolean;oldValue:string|null;newValue:string|null;latest:string;revision:number;oldActive:boolean;compatible:boolean;bridge:boolean;readNew:boolean;rollbackOpen:boolean;validated:boolean;snapshot:{value:string;revision:number}|null;event:string;effect:Effect}
export function initial(alternate=false):State{return {oldColumn:true,newColumn:false,contracted:false,oldValue:alternate?'林设计师':'小林',newValue:null,latest:alternate?'林设计师':'小林',revision:0,oldActive:true,compatible:false,bridge:false,readNew:false,rollbackOpen:true,validated:false,snapshot:null,event:'旧实例在线，只认识 display_name；数据库尚无 full_name。',effect:'ok'};}
export function readOld(s:State){return !s.oldActive?'已退出':s.oldColumn?s.oldValue:'错误：display_name 不存在';}
export function readNew(s:State){return !s.compatible?'未部署':s.readNew?(s.newColumn?s.newValue:'错误：full_name 不存在'):(s.oldColumn?s.oldValue:'错误：兼容读依赖旧列');}
export function consistent(s:State){return s.newColumn&&s.newValue===s.latest&&(!s.oldColumn||s.oldValue===s.latest);}
export function advance(before:State,action:Action):State{
 const s:State={...before,snapshot:before.snapshot?{...before.snapshot}:null,effect:'ok'};
 const block=(event:string):State=>({...s,effect:'blocked',event});
 switch(action){
  case 'expand':if(s.newColumn)return block('full_name 已存在，无需重复扩展。');s.newColumn=true;s.event='新增可空 full_name；旧列保留，旧实例继续读写。';break;
  case 'compat':if(!s.oldColumn||!s.newColumn)return block('兼容部署需要两列都存在，先执行 Expand。');s.compatible=true;s.bridge=true;s.event='新版本在一个事务中写两列；旧版本只写旧列，由数据库触发器同步到新列。触发器不自动回填历史行。';break;
  case 'capture':if(!s.oldColumn||!s.newColumn)return block('读取回填快照需要两列存在。');s.snapshot={value:s.oldValue!,revision:s.revision};s.event=`回填任务读取旧值「${s.oldValue}」和版本 ${s.revision}，尚未写回。现在可插入并发写。`;break;
  case 'newWrite':if(!s.compatible||!s.newColumn)return block('尚未部署兼容版本或新列缺失。');if(!s.oldColumn&&!s.contracted)return {...s,effect:'damage',event:'兼容版本仍提交双列 SQL，但旧列被直接删除，整个写事务失败。独立收缩需同时切换为仅写新列。'};s.latest='新名字';s.revision++;s.newValue=s.latest;if(s.oldColumn)s.oldValue=s.latest;s.validated=false;s.event='新实例事务提交：写 full_name，并在旧列存在时同时写 display_name；业务版本递增。';break;
  case 'oldWrite':if(!s.oldActive)return block('旧实例已退出，不能再从它发起写入。');if(!s.oldColumn)return {...s,effect:'damage',event:'旧实例写入失败：display_name 已被删除。重试无法恢复列。'};s.latest='旧版更新';s.oldValue=s.latest;s.revision++;s.validated=false;if(s.bridge&&s.newColumn)s.newValue=s.latest;s.event=s.bridge?'旧实例只写 display_name；数据库触发器在同一事务内同步 full_name。':'旧实例只写 display_name；没有触发器时不会自动同步新列。';break;
  case 'backfill':case 'unsafeBackfill':
   if(!s.newColumn||!s.snapshot)return block('先新增新列并读取回填快照。');
   if(action==='backfill'&&!s.bridge)return block('先建立覆盖旧写路径的一致性机制，防止回填后旧写让新列过期。');
   if(action==='backfill'&&(s.snapshot.revision!==s.revision||s.newValue!==null)){s.event=`条件更新跳过：快照版本 ${s.snapshot.revision}，当前版本 ${s.revision}；只填空值且版本相等，保留并发新写。`;s.snapshot=null;break;}
   s.newValue=s.snapshot.value;s.validated=false;s.event=action==='unsafeBackfill'?`盲写快照「${s.snapshot.value}」到 full_name，未检查当前版本。`:`版本相等且 full_name 为空，回填「${s.snapshot.value}」。`;s.snapshot=null;if(s.newValue!==s.latest){s.effect='damage';s.event+=' 新列已覆盖为过期值；重新写入或按最新版本修复后再校验。';}break;
  case 'validate':if(!s.bridge||!consistent(s))return block('校验失败：需旧写同步机制生效，且两列都等于最新业务值。先补齐数据或修复差异。');s.validated=true;s.event='校验通过：full_name 非空，两列与最新业务值一致；本模型只有一行，生产需覆盖全量和持续写入。';break;
  case 'switchRead':if(!s.compatible||!s.validated||!consistent(s))return block('切读前必须兼容部署且通过当前数据校验。');s.readNew=true;s.event='新实例已切读 full_name；旧实例仍读 display_name，旧写触发器继续同步。';break;
  case 'retire':if(!s.readNew)return block('先验证并切读新列，再退出旧实例。');s.oldActive=false;s.event='在线旧实例归零；回滚窗口仍开放，仍需保留旧列和兼容写。';break;
  case 'closeWindow':if(s.oldActive||!s.readNew)return block('需确认旧实例归零且新实例已切读，才能结束回滚窗口。');s.rollbackOpen=false;s.event='应用回滚窗口明确结束；不能再承诺回滚到只认识旧列的版本。';break;
  case 'contract':if(s.oldActive||s.rollbackOpen||!s.readNew||!s.validated||!consistent(s))return block('禁止收缩：需旧实例归零、回滚窗口结束、切读完成，并通过最新校验。');s.oldColumn=false;s.oldValue=null;s.bridge=false;s.contracted=true;s.event='独立收缩完成：删除旧列和同步触发器。应用切换为仅写新列；这是数据库破坏性变更边界。';break;
  case 'drop':if(!s.oldColumn)return block('旧列已不存在。');s.oldColumn=false;s.oldValue=null;s.bridge=false;s.effect='damage';s.event='直接删旧列：旧实例查询与写入失败，兼容读取也会失败；仍开放的回滚承诺已破坏。';break;
  case 'rollback':if(!s.rollbackOpen)return block('回滚窗口已关闭，禁止部署旧版；需要另行制定恢复方案。');s.oldActive=true;s.compatible=false;s.readNew=false;s.event=s.oldColumn?'应用已回滚；旧列还在，旧实例继续服务。已新增的数据库列不会因代码回滚消失。':'代码部署成功，但数据库旧列不存在：旧实例无法服务，代码回滚没有恢复模式。';if(!s.oldColumn)s.effect='damage';break;
 }
 return s;
}
export const safePath:Action[]=['expand','compat','capture','newWrite','backfill','validate','switchRead','retire','closeWindow','contract'];
export interface Prediction{effect:Effect;reason:string}
export interface Run{action:Action;before:State;after:State;prediction:Prediction}
export function record(state:State,action:Action,prediction:Prediction):Run{if(!prediction.reason.trim())throw Error('请先填写理由');return {action,before:state,after:advance(state,action),prediction:{...prediction}};}
