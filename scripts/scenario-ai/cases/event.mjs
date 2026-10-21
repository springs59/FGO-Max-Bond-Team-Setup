import {common} from './common.mjs'
export const description='活动共性：自身加成、全队加成、满羁绊光环的联合收益'
export function make(seed,options){const {c,o,pick}=common(seed,{...options,scenario:'event'})
 for(const s of o.servants)o.bonuses[s.id]={totalSecondLayer:pick([0,.5,1,2]),party:pick([0,.05,.1])}
 o.costLimit=pick([55,80,95,113,null]);return c}
