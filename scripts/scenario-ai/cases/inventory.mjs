import {common} from './common.mjs'
export const description='库存与形态：礼装份数、满破状态、从者不同形态的资源限制'
export function make(seed,options){const {c,o,r,pick}=common(seed,{...options,scenario:'inventory'})
 o.ownCes=o.ownCes.filter((ce,i)=>i%2===0||r()<.25).map(ce=>({...ce,accountMlb:r()>.5}))
 o.costLimit=pick([20,40,65,95,113]);return c}
