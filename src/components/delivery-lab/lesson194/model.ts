export type MigrationAction = 'expand' | 'compat' | 'capture' | 'backfill' | 'verify' | 'switch' | 'retire' | 'close' | 'contract' | 'write' | 'confirm' | 'unsafe';
export interface NameRow { id: number; full: string | null; given: string | null; family: string | null; version: number; migratedVersion: number | null; confirmed: boolean; }
export interface MigrationState { expanded: boolean; compatibleWrites: boolean; oldColumn: boolean; readNew: boolean; oldApi: number; background: number; rollbackOpen: boolean; verified: boolean; rows: NameRow[]; snapshot: NameRow[] | null; message: string; }
export function initialState(): MigrationState { return { expanded:false,compatibleWrites:false,oldColumn:true,readNew:false,oldApi:2,background:1,rollbackOpen:true,verified:false,rows:[{id:1,full:'王小明',given:null,family:null,version:1,migratedVersion:null,confirmed:true},{id:2,full:'Madonna',given:null,family:null,version:1,migratedVersion:null,confirmed:false}],snapshot:null,message:'旧 API 与夜间任务都依赖 full_name；先增加新列。' }; }
function parts(row:NameRow) { return row.id===1 ? {given:row.version===1?'小明':'小敏',family:'王'} : {given:'Madonna',family:''}; }
export function blockers(s:MigrationState):string[] { return [!s.readNew?'尚未切换新读路径':'',!s.verified?'当前数据尚未核验':'',s.oldApi?'旧 API 尚未退出':'',s.background?'旧后台任务尚未退出':'',s.rollbackOpen?'回滚窗口仍开放':''].filter(Boolean); }
export function transition(state:MigrationState, action:MigrationAction):MigrationState {
 const s:MigrationState={...state,rows:state.rows.map(r=>({...r})),snapshot:state.snapshot?.map(r=>({...r}))??null};
 const say=(message:string)=>({...s,message});
 if(action==='expand'){s.expanded=true;return say('Expand：仅新增可空字段，旧列保留；旧 API 与后台任务仍可读取。');}
 if(action==='compat'){if(!s.expanded)return say('受阻：先新增字段，再安装兼容写路径。');s.compatibleWrites=true;return say('兼容写已安装：本模型用同一事务维护两种表示，且覆盖旧写入口。两次独立 SQL 不自动等于原子双写。');}
 if(action==='confirm'){s.rows[1].confirmed=true;s.verified=false;return say('已获本人确认：Madonna 为 given_name，family_name 允许空字符串。产品规则保留原文，不能机械按空格拆姓名。');}
 if(action==='capture'){if(!s.expanded)return say('受阻：没有新字段，不能回填。');s.snapshot=s.rows.map(r=>({...r}));return say('已读取回填批次及行版本；此刻尚未写入，试着插入一次并发改名。');}
 if(action==='write'){
  if(!s.oldColumn)return say('旧写失败：full_name 已删除；退休的旧写入口不能再运行。');
  const row=s.rows[0];row.version++;row.full=row.version===2?'王小敏':'王小敏';s.verified=false;
  if(s.compatibleWrites){Object.assign(row,parts(row));row.migratedVersion=row.version;return say('旧入口并发改名：行版本递增，同一事务同步新列。旧回填快照现在过期。');}
  return say('旧入口只更新 full_name；新列未同步。核验应发现差异，不能直接切读。');
 }
 if(action==='backfill'||action==='unsafe'){
  if(!s.snapshot)return say('受阻：先读取回填批次。');
  let skipped=0,pending=0,written=0;
  for(const source of s.snapshot){const row=s.rows.find(r=>r.id===source.id)!;if(!row.confirmed){pending++;continue;}if(action==='backfill'&&row.version!==source.version){skipped++;continue;}Object.assign(row,parts(source));row.migratedVersion=source.version;written++;}
  s.verified=false;s.snapshot=null;
  return say(`回填写入 ${written} 行；版本冲突跳过 ${skipped} 行；姓名语义待确认 ${pending} 行。${action==='unsafe'?'无条件覆盖可能把新列退回旧值，核验版本可发现。':'跳过项可重新读取后幂等重试。'}`);
 }
 if(action==='verify'){
  const bad=s.rows.filter(r=>!r.confirmed||r.migratedVersion!==r.version||r.given!==parts(r).given||r.family!==parts(r).family);
  s.verified=s.expanded&&s.compatibleWrites&&bad.length===0;
  return say(s.verified?'核验通过：每行来源版本和语义映射一致，兼容写覆盖后续写入。':`核验未通过：${bad.length} 行缺失、过期或语义未确认${!s.compatibleWrites?'；兼容写尚未安装':''}。先修复再切读。`);
 }
 if(action==='switch'){if(!s.verified)return say('受阻：先核验当前数据与兼容写策略。');s.readNew=true;return say('Migrate：新实例切换到新列读取；旧读路径仍保留供旧任务和回滚使用。');}
 if(action==='retire'){s.oldApi=0;s.background=0;return say('已完成调用者审计：旧 API 与夜间任务均迁移退出。回滚版本仍是潜在旧读者。');}
 if(action==='close'){s.rollbackOpen=false;return say('已确认约定的回滚窗口结束；不再承诺旧二进制可回退。');}
 if(action==='contract'){const why=blockers(s);if(why.length)return say(`禁止收缩：${why.join('；')}。`);s.oldColumn=false;s.rows=s.rows.map(r=>({...r,full:null}));return say('Contract：旧列已移除。新读正常；旧二进制不再兼容，不能只回切应用。');}
 return s;
}
export function nextAction(s:MigrationState):MigrationAction { if(!s.expanded)return 'expand';if(!s.compatibleWrites)return 'compat';if(!s.rows[1].confirmed)return 'confirm';if(s.rows.some(r=>r.migratedVersion!==r.version))return s.snapshot?'backfill':'capture';if(!s.verified)return 'verify';if(!s.readNew)return 'switch';if(s.oldApi||s.background)return 'retire';if(s.rollbackOpen)return 'close';return 'contract'; }
export const actionLabels:Record<MigrationAction,string>={expand:'新增字段',compat:'启用事务兼容写',capture:'读取回填批次',backfill:'按版本安全回填',verify:'核验当前数据',switch:'切换新读',retire:'审计并退出旧读写者',close:'结束回滚窗口',contract:'尝试删除旧列',write:'插入并发改名',confirm:'确认单名映射',unsafe:'无版本保护回填'};
