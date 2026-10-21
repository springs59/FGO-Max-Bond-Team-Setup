import {common} from './common.mjs'
export const description='普通混合：加成、COST 与覆盖率共同决定队伍'
export function make(seed,options){const {c}=common(seed,{...options,scenario:'general'});return c}
