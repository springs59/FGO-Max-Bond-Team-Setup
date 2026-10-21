import {common} from './common.mjs'
export const description='规模与压缩：更多身份共享加成特征，考察排序与成本压缩'
export function make(seed,options){const {c,o,r,pick,real}=common(seed,{...options,scenario:'scale'})
 if(!real){const source=o.servants.slice();o.servants.push(...source.slice(0,4).map((s,i)=>({...s,id:s.id+10000,collectionNo:s.collectionNo+10000,name:s.name+' extra',cost:pick([0,3,7,12,16])})))}
 o.costLimit=pick([40,65,95,113,null]);o.requiredIds=[];o.requiredSeats={};o.minimumOwn=1
 // Bound offline label cost independently of the later full-catalog stress.
 o.ownCes=o.ownCes.slice(0,8);return c}
