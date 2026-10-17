import type {Progress} from './content/types';
// Server timestamps strictly increase per lesson; late HTTP responses must not roll back the UI.
export function mergeProgressSnapshots(current:Record<number,Progress>,incoming:Progress[]){
 const next={...current};
 for(const p of incoming){const existing=next[p.lessonId];if(!existing||p.updatedAt>=existing.updatedAt)next[p.lessonId]=p;}
 return next;
}
