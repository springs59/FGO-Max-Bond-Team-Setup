import {common} from './common.mjs'
export const description='命中重叠：全命中、特性命中和局部高加成的权衡'
export function make(seed,options){const {c,o,pick,real}=common(seed,{...options,scenario:'coverage'})
 o.costLimit=pick([40,65,95,113,null]);o.layouts=[6,3]
 if(!real)for(const ce of [...o.ownCes,...o.supportCes])for(const sk of ce.skills||[])for(const fn of sk.funcs||[])if(!fn.add){fn.tvals=pick([[],[{id:10}],[{id:11}],[{id:12}]]);fn.rate=pick([75,125,225,350])}
 return c}
