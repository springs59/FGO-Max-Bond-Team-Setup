import {common} from './common.mjs'
export const description='位置约束：必带身份、前后排、固定位置、空位同时生效'
export function make(seed,options){const {c,o,pick}=common(seed,{...options,scenario:'pinned'})
 const [a,b]=o.servants;o.layouts=[6];o.requiredIds=[a.id,b.id];o.requiredSeats={[a.id]:'front',[b.id]:'back'};o.fixedPositions={[a.id]:1,[b.id]:4}
 o.emptyPositions=pick([[],[5]]);o.minimumOwn=2;o.costLimit=pick([25,40,65,95,113,null]);return c}
