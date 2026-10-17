import type {Frame} from '../content/types';
export type SceneChange={label:string;before?:string;after?:string};
// Labels identify meanings; n0/n1 may be reused for different cards in the next frame.
export function sceneChanges(current:Frame,previous?:Frame):SceneChange[]{
 if(!previous)return [];
 const changes:SceneChange[]=[];
 for(const node of current.nodes){
  const before=previous.nodes.find(n=>n.id===node.id&&n.label===node.label)??previous.nodes.find(n=>n.label===node.label);
  if(!before||before.value!==node.value)changes.push({label:node.label,before:before?.value,after:node.value});
 }
 for(const node of previous.nodes)if(!current.nodes.some(n=>n.label===node.label))changes.push({label:node.label,before:node.value});
 return changes;
}
