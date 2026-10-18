export type Strategy31 = 'copy' | 'index' | 'reference';
export interface Item31 {price:number;stockRef:string}
export interface State31 {items:Item31[];heap:Record<string,number>;current:Item31|null;index:number;phase:'ready'|'copy'|'write'|'done';reason:string}
export interface Config31 {prices:number[];stock:number;percent:number;strategy:Strategy31}
export const initial31=(c:Config31):State31=>({items:c.prices.map((price,i)=>({price,stockRef:'stock'+i})),heap:Object.fromEntries(c.prices.map((_,i)=>['stock'+i,c.stock])),current:null,index:-1,phase:'ready',reason:'原切片保存结构体；Stock 字段保存指向库存整数的地址。'});
export function next31(s:State31,c:Config31):State31{
 if(s.phase==='done')return s;
 const n:State31={...s,items:s.items.map(x=>({...x})),heap:{...s.heap},current:s.current?{...s.current}:null};
 if(s.phase==='ready'||s.phase==='write'){
  const index=s.index+1;
  if(index>=s.items.length)return {...n,phase:'done',current:null,reason:'遍历结束。副本不会自动写回；沿指针写入的共享整数仍保留改动。'};
  return {...n,index,current:{...n.items[index]},phase:'copy',reason:'复制 items['+index+']：Price 数值被复制；Stock 地址也被复制，两份地址仍指向同一库存。'};
 }
 if(!n.current)return n;
 if(c.strategy==='reference'){const ref=n.current.stockRef;n.heap[ref]+=1;n.reason='执行 *item.Stock += 1：沿复制地址 '+ref+' 修改共享库存为 '+n.heap[ref]+'；Price 不变。';}
 else{const target=c.strategy==='copy'?n.current:n.items[n.index];const before=target.price;target.price=Math.trunc(before*c.percent/100);n.reason=c.strategy==='copy'?'item.Price：'+before+' → '+target.price+'；只写副本，原元素仍为 '+n.items[n.index].price+'。':'items['+n.index+'].Price：'+before+' → '+target.price+'；直接写原存储，已复制的 item.Price 仍为 '+n.current.price+'。';}
 return {...n,phase:'write'};
}
export function trace31(c:Config31):State31[]{const out=[initial31(c)];while(out.at(-1)!.phase!=='done')out.push(next31(out.at(-1)!,c));return out;}
export const code31:Record<Strategy31,string>={copy:'item.Price = item.Price * percent / 100',index:'items[i].Price = items[i].Price * percent / 100',reference:'*item.Stock += 1'};
