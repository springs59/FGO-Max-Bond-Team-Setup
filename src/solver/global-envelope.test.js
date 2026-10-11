import assert from 'node:assert/strict'
import {buildGlobalEnvelope,globalWinnerAt,globalCurveValue} from './global-envelope.js'
let seed=7611
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
const meta={supports:[{flat:0},{flat:50},{flat:0}]}
let checked=0
for(let round=0;round<12;round++) {
  const records=Array.from({length:75},()=>{
    const layout=random(3),support=layout?random(3):0,n=layout?5:6,k=random(n)
    const rates=Array.from({length:6},(_,i)=>i<n-k?1000+random(30)*25:0)
    return [layout,support,random(7),n,3,k,0,random(169),...rates]
  })
  for(const opts of[{cost:113,portraitCap:1,capped:0},{cost:168,portraitCap:6,capped:-1},{cost:80,portraitCap:3,capped:-1,layout:2},{cost:130,portraitCap:0,capped:-1,support:0}]) {
    const e=buildGlobalEnvelope(records,meta,opts)
    const points=new Set(Array.from({length:2501},(_,i)=>i))
    for(let r=0;r<e.period;r++)for(const[q]of e.hulls[r]||[]){points.add(q*e.period+r);if(q)points.add((q-1)*e.period+r)}
    for(const base of points){const id=globalWinnerAt(e,base);if(!e.ids.length){assert.equal(id,null);continue}let score=-1,cost=Infinity;for(const j of e.ids){const value=globalCurveValue(records[j],meta,base);if(value>score||value===score&&records[j][7]<cost){score=value;cost=records[j][7]}}assert.equal(globalCurveValue(records[id],meta,base),score);assert.equal(records[id][7],cost);checked++}
  }
}
const c=[2,1,1,1,1,0,0,1,1275,0,0,0,0,0]
const base=123456789123
assert.equal(globalCurveValue(c,meta,base),Number((BigInt(base)*1240n/1000n)*1275n/1000n+100n))
assert.throws(()=>globalCurveValue(c,meta,-1))
assert.throws(()=>globalCurveValue(c,meta,Number.MAX_SAFE_INTEGER))
console.log(`global-envelope.test.js ok: ${checked} exact point and transition checks`)
