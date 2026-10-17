export type Config = {recommendation:'stale'|'default'; contract:'honest'|'fake'; remote:'paid'|'unpaid'; lookup:boolean};
export type State = {stage:number; remote:'paid'|'unpaid'; local:'unknown'|'paid'|'unpaid'; http:number|null; recommendation:string; display:string; reconcile:boolean; evidence:string[]; loss:string; risk:boolean; reason:string};
export const baseline:Config={recommendation:'stale',contract:'fake',remote:'unpaid',lookup:true};
export function simulate(c:Config):State[]{
 const start:State={stage:0,remote:c.remote,local:'unknown',http:null,recommendation:'等待推荐',display:'等待支付结果',reconcile:false,evidence:[],loss:'尚未选择可接受损失',risk:false,reason:'远端结果由实验条件固定，但本地尚未收到任何支付证据。'};
 const timeout:State={...start,stage:1,evidence:['支付请求已发出','推荐超时','支付响应超时'],reason:'超时只证明没有及时收到响应；远端可能已扣款，也可能未扣款。本地仍为未知。'};
 const fallback:State={...timeout,stage:2,http:200,recommendation:c.recommendation==='stale'?'陈旧推荐 · 10分钟前':'缺省热门 · 非个性化',display:c.contract==='fake'?'支付成功 · 允许发货':'支付处理中 · 暂停发货',reconcile:c.contract==='honest',loss:c.recommendation==='stale'?'牺牲推荐时效；支付结果仍需等待':'牺牲推荐个性化；支付结果仍需等待',risk:c.contract==='fake',evidence:[...timeout.evidence,`推荐采用${c.recommendation==='stale'?'陈旧':'缺省'}数据并显式标记`,c.contract==='fake'?'错误规则：把 HTTP 200 当作支付凭证':'保存交易号，登记待核对'],reason:c.contract==='fake'?'页面宣称成功，但本地仍未知；HTTP 200 仅说明接口响应，不能支撑发货。':'推荐损失已标记；支付保留未知，用户等待核对。HTTP 200 的响应体明确为 processing。'};
 const final:State=c.contract==='fake'?{...fallback,stage:3,reason:'核对队列为空，假成功一直未被纠正。即使碰巧已扣款，也仍没有本地支付证据。'}:!c.lookup?{...fallback,stage:3,evidence:[...fallback.evidence,'查询支付渠道也超时'],reason:'核对失败不改写事实：本地仍未知，继续待核对并暂停发货；不能凭等待时间判失败。'}:{...fallback,stage:3,local:c.remote,display:c.remote==='paid'?'支付已确认 · 允许发货':'支付未完成 · 不发货',reconcile:false,risk:false,evidence:[...fallback.evidence,`支付渠道权威终态凭证：${c.remote==='paid'?'已扣款':'未扣款'}`],reason:'收到与交易号匹配的权威终态凭证，才把本地未知变为已确认结果。'};
 return [start,timeout,fallback,final];
}
