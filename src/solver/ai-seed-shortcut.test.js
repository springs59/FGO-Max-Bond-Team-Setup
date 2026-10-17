import assert from 'node:assert/strict'
import { solveInventoryCurves } from './inventory-curve-solver.js'
import { makeSearchCase } from '../../scripts/ai-search-cases.mjs'

const keys = result => result ? Object.fromEntries(result.plans.map(p=>{
  const s=p.slots.find(s=>s.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]
})) : null
let checked=0,stops=0
function check(opts,label){
  const full=solveInventoryCurves({...opts,aiMode:'on',aiSeedMode:'full'})
  const fast=solveInventoryCurves({...opts,aiMode:'on'})
  assert.equal(Boolean(fast),Boolean(full),label)
  checked++
  if(!full)return
  assert.deepEqual([fast.score,fast.cost],[full.score,full.cost],label+' final objective')
  assert.deepEqual(keys(fast),keys(full),label+' every retained support/position score and COST')
  const a=fast.certificate.ai,b=full.certificate.ai
  assert.equal(a.initialLowerBound,b.initialLowerBound,label+' initial lower-bound score cannot weaken')
  assert.equal(a.initialLowerBoundCost,b.initialLowerBoundCost,label+' initial lower-bound COST cannot worsen')
  assert.equal(a.initialBoundCoverage,b.initialBoundCoverage,label+' initial coverage cannot shrink')
  stops+=a.seedCertifiedStops
  return fast
}
for(let i=0;i<64;i++){
  const {opts,id}=makeSearchCase(7100000+i,{real:i%3===0,larger:i>=48})
  opts.allSupportAlternatives=i%2===0
  check(opts,id)
}
const servants=Array.from({length:7},(_,i)=>({id:i+1,cost:0,traitIds:[]}))
const ce={id:101,cost:0,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate:100,add:0,eventId:0,tvals:[],andTvals:[]}]}))}
const opts={servants,ownCes:[ce,ce,ce],supportCes:[ce],formsOf:s=>[{key:'default',cost:s.cost,traitIds:[]}],base:0,
  stateOf:s=>({maxed:true,aura:s.id%2?250:0}),layouts:[6,3],allSupportAlternatives:true}
const zero=check(opts,'zero-score varying aura, zero COST, all support strata')
assert.ok(zero.certificate.ai.seedCertifiedStops>0,'the certified shortcut must actually run')
assert.ok(zero.certificate.ai.seedPendingRechecks>0,'partly explored seed lists cannot enter the exhaustive memo')
assert.equal(zero.certificate.ai.seedReused,0,'formal search must not skip partly explored seeds')
assert.ok(zero.certificate.evaluated>zero.certificate.ai.seedCertifiedStops,'formal search must evaluate seeds again')
check({...opts,base:815,stateOf:()=>({maxed:false,aura:0})},'positive scores, all equal costs')
check({...opts,layouts:[0],requiredIds:[1,2],requiredSeats:{1:'back',2:'back'},emptyPositions:[2,3,6]},'required back members still require one own front member')
let callbacks=0
const exhaustive=solveInventoryCurves({...opts,aiMode:'on',onEvaluatedPlan:()=>callbacks++})
assert.equal(exhaustive.certificate.ai.seedCertifiedStops,0,'candidate-enumeration callers retain their full seed callbacks')
assert.ok(callbacks>0)
assert.ok(stops>0)
console.log(`AI seed shortcut: ${checked} domains, unchanged initial bounds/COST/coverage, final objectives, partial-seed rechecks and full callbacks passed; ${stops} certified stops`)
