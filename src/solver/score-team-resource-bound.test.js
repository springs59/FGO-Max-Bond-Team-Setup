import assert from 'node:assert/strict'
import {createEquipmentResourceBound} from './score-team-resource-bound.js'
import {createScoreTeamSearch} from '../recommend.js'
import {wideFixture} from '../../scripts/all-score-teams-wide-fixtures.mjs'

// Independent bounded knapsack: the relaxation must never undershoot an
// actual completion, including repeated copies, free items and tiny budgets.
let seed=20261022
const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n}
for(let i=0;i<2000;i++){
  const types=Array.from({length:rand(7)},()=>({cost:rand(9),left:rand(4),gain:rand(20000)}))
  const slots=rand(7),budget=rand(30),constant=rand(10000),known=rand(10000),support=rand(10000),multiplier=1+rand(2)
  const bound=createEquipmentResourceBound({constant,ownTypes:types,gainOf:x=>x.gain,supportGain:support,multiplier})
  let maximum=0
  function brute(at,left,cost,gain){
    if(at===types.length){maximum=Math.max(maximum,gain);return}
    const x=types[at]
    for(let count=0;count<=Math.min(left,x.left);count++)if(cost+count*x.cost<=budget)brute(at+1,left-count,cost+count*x.cost,gain+count*x.gain)
  }
  brute(0,slots,0,0)
  assert.ok(bound(slots,budget,known)>=Math.floor((constant+known+support+maximum)/1000)*multiplier,`admissibility ${i}`)
  // Stock is live, not a frozen copy made during compilation.
  for(const x of types)x.left=0
  assert.equal(bound(slots,budget,known),Math.floor((constant+known+support)/1000)*multiplier)
}
const huge=[{cost:Number.MAX_SAFE_INTEGER,left:2,gain:Number.MAX_SAFE_INTEGER}]
const unsafe=createEquipmentResourceBound({constant:0,ownTypes:huge,gainOf:x=>x.gain})
assert.equal(unsafe(2,Infinity),Infinity,'Unsafe sums disable pruning')
assert.equal(createEquipmentResourceBound({constant:0,ownTypes:[{cost:-1,left:1}],gainOf:()=>1}),null)
assert.equal(createEquipmentResourceBound({constant:0,ownTypes:[],gainOf:()=>0})(1,0),0)
const fractional=createEquipmentResourceBound({constant:999,ownTypes:[{cost:3,left:1}],gainOf:()=>2})
assert.equal(fractional(1,2),1,'Fractional milli-score is rounded upwards')

const key=r=>JSON.stringify([r.score,r.packed])
for(const id of ['conditional','self-flat','six-own','prefer','pins-stock-aura','active-event','grand','fixed-npc','CN-small','JP-small','CN-medium','JP-medium','dense-zero']){
  const opts={...wideFixture(id).opts,aiMode:'off'}
  const results=[]
  for(const resources of [false,true]){
    const q=createScoreTeamSearch({...opts,scoreTeamAudit:{resources}}),best=[]
    for(const e of q.iterator)if(e.type==='team'){
      q.hydrate(e.record)
      if(!best.length||e.record.score>best[0].score)best.length=0
      if(!best.length||e.record.score===best[0].score)best.push(e.record)
    }
    assert.equal(q.state.complete,true)
    results.push({score:q.state.bestScore,records:best.map(key).sort()})
  }
  assert.deepEqual(results[1],results[0],id+' all equal-score groups survive combined bounds')
}
console.log('Hybrid resource bounds: 2,000 independent knapsack oracles and 13 complete query domains retain every best group; stock, rounding, free equipment and overflow passed')
