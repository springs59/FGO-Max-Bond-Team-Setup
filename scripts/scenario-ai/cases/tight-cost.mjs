import {common} from './common.mjs'
export const description='紧预算：保留从者预算，比较廉价覆盖与高加成礼装'
export function make(seed,options){const {c,o,int,pick,real}=common(seed,{...options,scenario:'tight-cost'})
 o.costLimit=pick([3,4,5,8,12,18,24,32]);o.minimumOwn=1;o.requiredIds=[];o.requiredSeats={};o.emptyPositions=[];o.layouts=[6,3]
 if(!real){o.servants[0].cost=0;o.servants[0].forms=[]}
 return c}
