import {makeSearchCase,randomSource} from '../../ai-search-cases.mjs'
export function common(seed,{split='train',scenario='general'}={}){
 const mix=n=>{n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);return (n^(n>>>16))>>>0}
 const r=randomSource(mix(seed^0x5a17)),int=(a,b)=>a+Math.floor(r()*(b-a+1)),pick=xs=>xs[int(0,xs.length-1)]
 const real=split==='sealed',larger=split!=='train'||scenario==='scale'
 const c=makeSearchCase(mix(seed),{real,larger}),o=c.opts,original=o.stateOf
 c.rngSeed=c.seed;c.seed=seed
 o.stateOf=s=>original(s)||{};o.allSupportAlternatives=false
 if(split==='ood'){
  o.base=pick([0,1,37,3500,20000]);o.costLimit=pick([8,19,55,113,null])
  for(const b of Object.values(o.bonuses)){b.totalSecondLayer=pick([.25,.75,1.5,3]);b.party=pick([0,.03,.17])}
 }
 return {c,o,r,int,pick,split,real,larger}
}
export function serializable(o){
 const x={...o,forms:Object.fromEntries(o.servants.map(s=>[s.id,o.formsOf(s)])),states:Object.fromEntries(o.servants.map(s=>[s.id,o.stateOf(s)]))}
 delete x.formsOf;delete x.stateOf;return x
}
export function context(o){return {minimumOwn:o.minimumOwn,requiredIds:o.requiredIds,requiredSeats:o.requiredSeats,fixedPositions:o.fixedPositions,emptyPositions:o.emptyPositions,
 layouts:o.layouts,allSupportAlternatives:o.allSupportAlternatives,requireSupportEquipment:o.requireSupportEquipment,costLimit:o.costLimit,identitiesCount:o.servants.length}}
