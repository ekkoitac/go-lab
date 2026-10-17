export type Owner = '入口团队' | '规则团队' | '数据团队' | '订单团队' | '支付团队' | '搜索平台';
export type NodeId = 'entry' | 'rule' | 'store' | 'payment' | 'searchApi' | 'searchIndex';
export type Change = 'price' | 'search';
export type Assignment = Record<NodeId, Owner>;
export const nodes: {id:NodeId;name:string;detail:string}[] = [
 {id:'entry',name:'订单入口',detail:'接收改价字段'}, {id:'rule',name:'订单规则',detail:'校验改价权限'},
 {id:'store',name:'订单存储适配器',detail:'保存价格与原因'}, {id:'payment',name:'支付结算',detail:'消费已确认金额'},
 {id:'searchApi',name:'搜索接口',detail:'接收搜索查询'}, {id:'searchIndex',name:'搜索索引',detail:'实现检索排序'},
];
export const technical: Assignment={entry:'入口团队',rule:'规则团队',store:'数据团队',payment:'支付团队',searchApi:'搜索平台',searchIndex:'搜索平台'};
export const capability: Assignment={...technical,entry:'订单团队',rule:'订单团队',store:'订单团队'};
export function affected(change:Change,sharedPrice:boolean):NodeId[]{
 return change==='search'?['searchApi','searchIndex']:sharedPrice?['entry','rule','store','payment']:['entry','rule','store'];
}
export function inspect(assignment:Assignment,change:Change,sharedPrice:boolean,step:number){
 const plan=affected(change,sharedPrice);
 const cursor=Math.max(0,Math.min(plan.length,Math.floor(Number.isFinite(step)?step:0)));
 const visited=plan.slice(0,cursor);
 const owners=[...new Set(visited.map(id=>assignment[id]))];
 const crossings=visited.slice(1).filter((id,i)=>assignment[id]!==assignment[visited[i]]).length;
 return {cursor,total:plan.length,visited,owners,crossings,done:cursor===plan.length,
   priceWriters:sharedPrice?['订单规则','支付结算']:['订单规则']};
}
export function eventFor(id:NodeId,sharedPrice:boolean){
 const events:Record<NodeId,string>={entry:'入口接受「改价原因」，请求结构发生变化。',rule:'订单规则校验改价权限与原因，业务规则发生变化。',store:'存储适配器保存新字段，持久化映射发生变化。',payment:sharedPrice?'支付也直接写价格字段，必须共同确认新校验规则，协调继续传播。':'支付只消费稳定金额契约，本次无须改变。',searchApi:'查询增加同义词参数，搜索接口发生变化。',searchIndex:'索引实现新的同义词检索，订单规则无须改变。'};
 return events[id];
}
export function transferFeedback(choice:string){
 return choice==='owner'?'正确。先让工单能力拥有状态规则与写入，再在内部保留入口、规则、存储分层；观察新状态能否由一个所有者完整交付。':'还要追踪「新增状态」由谁定义、谁写入。仅改服务名或增加代理，都没有减少一起变化的所有者；重新选择后验证。';
}
