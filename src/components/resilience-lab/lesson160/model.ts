export type RecoveryState={tick:number;capacity:number;cold:number;weight:number;budget:number;queue:number;arrived:number;deferred:number;completed:number;failed:number;warm:number;onlineCapacity:number;healthy:number;bad:number;ejected:boolean;lastHealthy:number;totalCompleted:number;totalFailed:number;reason:string};
export function initial(weight=100,cold=5):RecoveryState{return {tick:0,capacity:cold,cold,weight,budget:1,queue:0,arrived:0,deferred:0,completed:0,failed:0,warm:0,onlineCapacity:0,healthy:0,bad:0,ejected:false,lastHealthy:4,totalCompleted:0,totalFailed:0,reason:'依赖已恢复，冷容量尚未验证。选择流量权重，再采样一个窗口。'};}
export function configure(s:RecoveryState,patch:Partial<Pick<RecoveryState,'weight'|'budget'>>):RecoveryState{return {...s,...patch,healthy:0,bad:0,reason:'配置已改变；连续健康证据清零，下一窗口重新观察。'};}
export function advance(s:RecoveryState):RecoveryState{
 if(s.ejected)return {...s,tick:s.tick+1,arrived:0,deferred:50,completed:0,failed:s.queue,queue:0,warm:0,onlineCapacity:0,ejected:false,bad:0,healthy:0,totalFailed:s.totalFailed+s.queue,reason:'剔除窗口：本实例不接流量，旧排队请求失败；下个窗口按原权重重入。容量没有因等待而增加。'};
 const arrived=Math.round(50*s.weight/100),warm=Math.min(s.budget,s.capacity),onlineCapacity=s.capacity-warm;
 const pending=arrived+s.queue,completed=Math.min(pending,onlineCapacity),remaining=pending-completed,queue=Math.min(10,remaining),failed=remaining-queue;
 const good=queue===0&&failed===0&&arrived>0;
 const healthy=good?s.healthy+1:0,bad=queue>0||failed>0?s.bad+1:0,ejected=bad>=2;
 // Successful warm-up competes for this window's resources; overload prevents net capacity gain.
 const capacity=queue===0&&failed===0?Math.min(60,s.capacity+warm*2+Math.floor(completed/5)):s.capacity;
 return {...s,tick:s.tick+1,arrived,deferred:50-arrived,completed,failed,queue,warm,onlineCapacity,capacity,healthy,bad,ejected,lastHealthy:good?s.weight:s.lastHealthy,totalCompleted:s.totalCompleted+completed,totalFailed:s.totalFailed+failed,reason:ejected?'连续 2 个窗口不健康：下个窗口剔除。原权重不改，重入后会重复冲击。':good?`本窗口无排队、无失败；有效完成 ${completed} 千次。连续健康 ${healthy} 次，下一窗口容量 ${capacity} 千次。`:`线上只有 ${onlineCapacity} 千次容量，需求加旧排队 ${pending} 千次；排队 ${queue}，失败 ${failed}。过载未获得净预热收益。`};
}
export function raise(s:RecoveryState):RecoveryState{return s.healthy>=2?configure(s,{weight:Math.min(100,s.weight+10)}):s;}
export function rollback(s:RecoveryState):RecoveryState{return {...configure(s,{weight:s.lastHealthy,budget:1}),ejected:false,reason:`回到上次健康权重 ${s.lastHealthy}%（尚无证据时用 4% 探测），保留积压与现有容量；必须继续采样验证。`};}
export function compareAt(tick:number,weight:number,budget=1){let s={...initial(weight),budget};for(let i=0;i<tick;i++)s=advance(s);return s;}

