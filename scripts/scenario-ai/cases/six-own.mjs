import {common} from './common.mjs'
export const description='己方编队：禁止助战、四至六人、保留锁定空位'
export function make(seed,options){const {c,o,pick}=common(seed,{...options,scenario:'six-own'})
 o.layouts=[0];o.minimumOwn=Math.min(o.servants.length,pick([4,5,6]));o.emptyPositions=o.minimumOwn<6&&o.servants.length>=6?[6]:[]
 o.requiredIds=[];o.requiredSeats={};o.costLimit=pick([40,65,95,113,130,null]);return c}
