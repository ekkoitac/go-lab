export type Layer40='storage'|'service'|'http';
export interface Policy40 {log:boolean;wrap:boolean;attempts:number}
export interface Config40 {failures:number;audit:boolean;layers:Record<Layer40,Policy40>}
export interface State40 {request:number;active:Layer40|null;physicalAttempts:number;diagnosticLogs:string[];auditEvents:string[];error:string;responses:number;phase:'ready'|'call'|'failure'|'propagate'|'respond'|'done';reason:string}
export const layerNames40:Record<Layer40,string>={storage:'存储层',service:'服务层',http:'HTTP 边界'};
export const default40:Config40={failures:1,audit:false,layers:{storage:{log:true,wrap:true,attempts:1},service:{log:true,wrap:true,attempts:1},http:{log:true,wrap:false,attempts:1}}};
export const repaired40=(c:Config40):Config40=>({...c,layers:{storage:{...c.layers.storage,log:false,wrap:true,attempts:1},service:{...c.layers.service,log:false,wrap:true,attempts:1},http:{...c.layers.http,log:true,attempts:3}}});
export function trace40(c:Config40):State40[]{
 let s:State40={request:0,active:null,physicalAttempts:0,diagnosticLogs:[],auditEvents:[],error:'',responses:0,phase:'ready',reason:'每个独立请求最终失败。按调用链向下尝试，错误向上传播；日志在各层自己的尝试预算耗尽后记录。'};
 const out=[s];const push=(patch:Partial<State40>)=>{s={...s,...patch,diagnosticLogs:patch.diagnosticLogs??[...s.diagnosticLogs],auditEvents:patch.auditEvents??[...s.auditEvents]};out.push(s);};
 const propagate=(layer:Layer40)=>{const p=c.layers[layer];const prefix={storage:'db read',service:'order',http:'HTTP request'}[layer];const error=p.wrap?prefix+': '+s.error:s.error;push({active:layer,phase:'propagate',error,diagnosticLogs:p.log?[...s.diagnosticLogs,'请求 '+s.request+' · '+layerNames40[layer]+' · '+error]:s.diagnosticLogs,reason:layerNames40[layer]+'尝试预算耗尽，'+(p.wrap?'补充 '+prefix+' 上下文，':'保留已有错误，')+(p.log?'记录一条诊断日志后返回。':'返回错误，不重复记录。')});};
 for(let request=1;request<=c.failures;request++){
  push({request,active:'http',phase:'call',error:'',auditEvents:c.audit?[...s.auditEvents,'请求 '+request+' · 访问操作审计']:s.auditEvents,reason:'进入独立请求 '+request+'。'+(c.audit?'记录独立访问操作审计；它不属于故障诊断日志。':'此次请求与其他请求是独立失败。')});
  for(let h=1;h<=c.layers.http.attempts;h++){
   push({active:'http',phase:'call',reason:'HTTP 总尝试 '+h+'/'+c.layers.http.attempts+'：调用服务（总尝试次数含初次）。'});
   for(let v=1;v<=c.layers.service.attempts;v++){
    push({active:'service',phase:'call',reason:'服务总尝试 '+v+'/'+c.layers.service.attempts+'：调用存储。'});
    for(let d=1;d<=c.layers.storage.attempts;d++)push({active:'storage',phase:'failure',physicalAttempts:s.physicalAttempts+1,error:'offline',reason:'存储总尝试 '+d+'/'+c.layers.storage.attempts+'：实际访问失败，根因为 offline。'});
    propagate('storage');
   }
   propagate('service');
  }
  propagate('http');
  push({active:'http',phase:'respond',responses:s.responses+1,reason:'HTTP 边界给请求 '+request+' 返回 503；保留错误上下文用于诊断。'});
 }
 push({active:null,phase:'done',reason:'完成 '+c.failures+' 个独立失败：实际访问 '+s.physicalAttempts+' 次，诊断日志 '+s.diagnosticLogs.length+' 条，独立审计 '+s.auditEvents.length+' 条。'});
 return out;
}
