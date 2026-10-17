import assert from 'node:assert/strict'
import {proposeEquipmentSeeds} from './ai-search.js'
import {solveInventoryCurves} from './inventory-curve-solver.js'
const ce=(id,cost,rate,traits=[])=>({id,cost,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,add:0,eventId:0,tvals:traits.map(id=>({id})),andTvals:[]}]}))})
const g={items:[ce(1,9,100),ce(2,9,100)],rates:[100],flat:0}
const seeds=proposeEquipmentSeeds([g],new Map([[g,.99]]),2,20,6,[16,16,18])
assert.deepEqual(seeds,[[0]],'a seed must reserve the required party budget')
const servants=[7,8,9,0].map((cost,i)=>({id:i+1,collectionNo:i+1,cost,traitIds:[10+i%2]}))
const ownCes=[ce(101,1,100),ce(102,9,200,[10]),ce(103,9,200,[10]),ce(104,3,50)]
const formsOf=s=>[{key:'default',cost:s.cost,traitIds:s.traitIds},{key:'light',cost:Math.max(0,s.cost-3),traitIds:[11]}]
const keys=r=>r?Object.fromEntries(r.plans.map(p=>{const s=p.slots.find(x=>x.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]})):null
let comparisons=0,reused=0,budgetPruned=0
for(const base of [0,815,2400])for(const costLimit of [0,1,8,15,20,40,null])for(const layouts of [[0],[6,3]]){
 const opts={servants,ownCes,supportCes:ownCes,formsOf,base,costLimit,layouts,minimumOwn:2,
   requiredIds:[1,2],requiredSeats:{1:'front',2:'back'},fixedPositions:{2:4},emptyPositions:[5],allSupportAlternatives:true,
   stateOf:s=>({maxed:s.id===3,aura:s.id===3?250:0}),bonuses:{1:{party:.05},2:{totalSecondLayer:.5}}}
 const off=solveInventoryCurves({...opts,aiMode:'off'}),on=solveInventoryCurves({...opts,aiMode:'on'})
 assert.deepEqual(keys(on),keys(off),'required identities/forms/empty seats and all support strata: '+JSON.stringify({base,costLimit,layouts}))
 comparisons++
 if(!on)continue
 assert.ok(on.certificate.ai.initialLowerBound<=on.score)
 assert.equal(on.certificate.ai.finalLowerBound,on.score)
 assert.ok(on.certificate.ai.initialLowerBoundCost<=costLimit||costLimit==null)
 reused+=on.certificate.ai.seedReused;budgetPruned+=on.certificate.ai.budgetPruned
}
assert.ok(reused>0,'exact initial seeds should be reused by the later search')
assert.ok(budgetPruned>0,'the distinct-identity resource bound should reject impossible branches')
console.log(`Verified AI bounds: ${comparisons} constrained comparisons, all support/position scores and COST ties preserved, ${reused} seed reuses passed`)
