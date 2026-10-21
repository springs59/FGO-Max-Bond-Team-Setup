import * as general from './general.mjs'
import * as tightCost from './tight-cost.mjs'
import * as coverage from './coverage.mjs'
import * as event from './event.mjs'
import * as sixOwn from './six-own.mjs'
import * as pinned from './pinned.mjs'
import * as inventory from './inventory.mjs'
import * as scale from './scale.mjs'
export const SCENARIOS={general,'tight-cost':tightCost,coverage,event,'six-own':sixOwn,pinned,inventory,scale}
export function makeScenario(scenario,seed,split='train'){
 const c=SCENARIOS[scenario].make(seed,{split})
 if(split==='ood'){
  const o=c.opts;o.layouts=[0];o.minimumOwn=Math.min(4,o.servants.length);o.requiredIds=[o.servants[0].id]
  o.requiredSeats={...o.requiredSeats,[o.servants[0].id]:'front'};o.emptyPositions=[6];o.allSupportAlternatives=false
 }
 // A fixed position implies both required identity and required seat. Keep
 // those core-query invariants when combining independently written scripts.
 c.opts.requiredIds=[...new Set([...(c.opts.requiredIds||[]),...Object.keys(c.opts.fixedPositions||{}).map(Number)])]
 for(const [id,p] of Object.entries(c.opts.fixedPositions||{}))c.opts.requiredSeats[id]=p<=3?'front':'back'
 return {...c,id:split+'-'+scenario+'-'+seed,scenario,split}
}
