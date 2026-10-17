export type Field = {id: string; name: string; exported: boolean; tag: '' | 'external' | '-'; external: string; omit: boolean; value: string};
export type Decision = {id: string; field: string; key: string; included: boolean; reason: string; value: string};
export const initialFields = (): Field[] => [
  {id:'status',name:'Status',exported:false,tag:'external',external:'status',omit:false,value:'paid'},
  {id:'token',name:'Token',exported:true,tag:'-',external:'token',omit:false,value:'secret'},
  {id:'note',name:'Note',exported:true,tag:'external',external:'note',omit:true,value:''},
];
export function fieldName(f:Field) {return f.exported ? f.name : f.name[0].toLowerCase()+f.name.slice(1);}
export function decide(f:Field):Decision {
  const field=fieldName(f),key=f.tag==='external'?f.external:field;
  const reason=!f.exported?'未导出：标签不能让小写字段公开。':f.tag==='-'?'显式排除：json:"-" 始终跳过。':f.omit&&f.value===''?'空字符串且设置 omitempty：省略。':`导出且未排除：以 ${key} 为键输出${f.value===''?'空字符串':''}。`;
  return {id:f.id,field,key,included:f.exported&&f.tag!=='-'&&!(f.omit&&f.value===''),reason,value:f.value};
}
export function snapshot(fields:Field[],step:number) {
  const cursor=Math.max(0,Math.min(fields.length,Math.trunc(step)));
  const decisions=fields.slice(0,cursor).map(decide);
  const output=Object.fromEntries(decisions.filter(d=>d.included).map(d=>[d.key,d.value]));
  return {cursor,done:cursor===fields.length,decisions,output};
}
export function codeLine(f:Field) {
  const tag=f.tag==='-'?'-':(f.tag==='external'?f.external:'')+(f.omit?',omitempty':'');
  return `${fieldName(f)} string${tag?' `json:'+JSON.stringify(tag)+'`':''} // 值 ${JSON.stringify(f.value)}`;
}
export function matchesKeys(prediction:string,output:Record<string,string>) {
  const clean=(items:string[])=>[...new Set(items.map(x=>x.trim()).filter(Boolean))].sort().join(',');
  return clean(prediction==='无' ? [] : prediction.split(/[,，]/))===clean(Object.keys(output));
}
/** The repair checks the durable contract as well as the current sample output. */
export function repairedOrderContract(fields:Field[]) {
  return fields.find(f=>f.id==='token')?.tag==='-' &&
    JSON.stringify(snapshot(fields,fields.length).output)===JSON.stringify({status:'shipped',note:''});
}
