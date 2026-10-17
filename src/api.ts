let token='';
export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T>{if(!token){const res=await fetch('/api/session');if(!res.ok)throw Error('本机服务未连接');token=(await res.json()).token;}
 const res=await fetch('/api'+path,{method,headers:{'content-type':'application/json','x-lab-token':token},body:body===undefined?undefined:JSON.stringify(body)});const data=await res.json().catch(()=>({error:'本机服务返回了无法读取的数据'}));if(!res.ok){if(res.status===401)token='';throw Error(data.error??'请求失败');}return data as T;}
