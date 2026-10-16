import assert from 'node:assert/strict'
import { SEARCH_MODEL } from './ai-model.js'
import { AI_FEATURES, validSearchModel, createLearnedSearch, searchFeatures } from './ai-search.js'
import { solveInventoryCurves } from './inventory-curve-solver.js'
import { makeSearchCase } from '../../scripts/ai-search-cases.mjs'
import { recommendTeam } from '../recommend.js'
import { referenceRecommendTeam, objectivesEqual, planObjective } from '../reference-solver.js'

assert.equal(validSearchModel(SEARCH_MODEL),true,'a trained model must ship with the runtime')
assert.equal(searchFeatures().length,AI_FEATURES.length)
for(const model of [null,{}, {...SEARCH_MODEL,featureVersion:-1}, {...SEARCH_MODEL,heads:{}}, {...SEARCH_MODEL,features:1},
  {...SEARCH_MODEL,heads:{...SEARCH_MODEL.heads,equipment:{...SEARCH_MODEL.heads.equipment,b1:'invalid'}}}]) {
  const search=createLearnedSearch({model,mode:'on',size:100})
  assert.equal(search.stats.enabled,false)
  const items=[{id:1},{id:2}]
  assert.equal(search.order(items,()=>searchFeatures()),items,'invalid models must preserve baseline traversal')
}
let feasible=0,ranked=0
for(let i=0;i<160;i++){
  const {opts,id}=makeSearchCase(1800000+i,{real:i%3===0})
  const off=solveInventoryCurves({...opts,aiMode:'off'}),on=solveInventoryCurves({...opts,aiMode:'on'})
  assert.equal(Boolean(on),Boolean(off),id)
  if(!off)continue;feasible++
  assert.equal(on.score,off.score,id+' exact primary objective')
  assert.equal(on.cost,off.cost,id+' exact cost tie')
  assert.ok(on.cost<=opts.costLimit||opts.costLimit==null)
  ranked+=on.certificate.ai.ranked
  if(i<30){
    const a=solveInventoryCurves({...opts,aiMode:'off',allSupportAlternatives:true})
    const b=solveInventoryCurves({...opts,aiMode:'on',allSupportAlternatives:true})
    const keys=result=>Object.fromEntries(result.plans.map(p=>{const s=p.slots.find(s=>s.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]}))
    assert.deepEqual(keys(b),keys(a),id+' every support/position optimum survives reordering')
  }
}
assert.ok(feasible>60);assert.ok(ranked>100)
for(let seed=0;seed<12;seed++){
  const servants=[1,2,3].map((id)=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,
    cost:id,traitIds:[10+id%2]}))
  const ces=[{id:101,cost:2,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{
    target:'ptFull',rate:condLimitCount?200:100,add:0,tvals:[{id:10}],andTvals:[]}]}))}]
  const opts={base:815+seed,servants,ces,costLimit:seed%2?7:10,allowSupport:seed%3!==0,
    mode:'free',optimizeBy:seed%2?'prefer':'total',preferSvtIds:seed%2?[1]:[],
    skipResultCache:true,solverAudit:{index:false},aiMode:'on'}
  const a=recommendTeam(opts),b=referenceRecommendTeam(opts)
  assert.ok(objectivesEqual(a,b),JSON.stringify({seed,a:planObjective(a),b:planObjective(b)}))
}
console.log(`AI traversal: ${feasible} held-out domains, ${ranked} priorities, all support alternatives, 12 independent reference queries, malformed-model fallback passed`)
