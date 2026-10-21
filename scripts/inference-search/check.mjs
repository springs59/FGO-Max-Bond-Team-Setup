import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {readFileSync} from 'node:fs'
import {brotliDecompressSync} from 'node:zlib'
import {makeSearchCase} from '../ai-search-cases.mjs'
import {validatePlan} from '../version-report-validate.mjs'
import {CONFIGS} from './configs.mjs'
const work=resolve(process.argv[2]),loaded={}
for(const root of ['query','adaptive']){
 const url=p=>pathToFileURL(work+'/variants/'+root+'/src/'+p)
 loaded[root]={...await import(url('solver/ai-search.js')),...await import(url('solver/query-ai.js')),
  ...await import(url('solver/ai-model.js')),...await import(url('solver/query-models.js')),
  ...await import(url('solver/inventory-curve-solver.js')),...await import(url('recommend.js'))}
}
const configs=Object.entries(CONFIGS).filter(([k])=>k!=='off')
const fingerprints=x=>x?[x.score,x.cost,Object.entries(Object.fromEntries(x.plans.map(p=>{const s=p.slots.find(x=>x.s);return[(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]}))).sort(([a],[b])=>a.localeCompare(b))]:null
let comparisons=0,planChecks=0;const calls={}
for(let i=0;i<40;i++){
 const raw=makeSearchCase(171800000+i,{real:i%2===0,larger:false}).opts
 const opts={...raw,forms:Object.fromEntries(raw.servants.map(s=>[s.id,raw.formsOf(s)])),states:Object.fromEntries(raw.servants.map(s=>[s.id,raw.stateOf(s)])),allSupportAlternatives:true};delete opts.formsOf;delete opts.stateOf
 const functions={formsOf:s=>opts.forms[s.id],stateOf:s=>opts.states[s.id]||{}}
 const expected=loaded.query.solveInventoryCurves({...opts,...functions,aiMode:'off'})
 for(const [key,c]of configs){
  const mod=loaded[c.root],session=mod.createQuerySession(),model={...mod.selectQueryModel(mod.SEARCH_MODEL,c.model),inferenceUse:c.use,inferenceInterval:c.interval}
  const actual=mod.solveInventoryCurves({...opts,...functions,aiMode:'on',aiModel:model,querySession:session})
  assert.deepEqual(fingerprints(actual),fingerprints(expected),key+' exact score/COST/all alternatives '+i)
  if(actual){validatePlan(opts,actual,true);planChecks++;for(const p of actual.plans||[]){validatePlan(opts,p,true);planChecks++}}
  calls[key]=Math.max(calls[key]||0,session.inferenceCalls);comparisons++
 }
}
const corpus=JSON.parse(brotliDecompressSync(readFileSync(resolve(process.argv[3]))))
for(const id of ['special-11','special-4','changed-support-equipment-4']){
 const opts=corpus.find(c=>c.id===id).opts
 const expected=loaded.query.recommendTeam({...opts,aiMode:'off',skipResultCache:true})
 const facts=x=>x?.ok?[x.total,x.costUsed,x.preferBond||0,x.bond15Count||0,x.priorityScore||0]:null
 for(const [key,c]of configs){
  const mod=loaded[c.root],model={...mod.selectQueryModel(mod.SEARCH_MODEL,c.model),inferenceUse:c.use,inferenceInterval:c.interval}
  const actual=mod.recommendTeam({...opts,aiMode:'on',aiModel:model,skipResultCache:true})
  assert.deepEqual(facts(actual),facts(expected),key+' production fallback objectives '+id)
  if(actual.ok)validatePlan(opts,actual,false)
  calls[key]=Math.max(calls[key]||0,actual.queryStats?.aiInferenceCalls||0);comparisons++
 }
}
for(const k of ['H_branch','T_branch','N_branch'])assert.ok(calls[k]>1,k+' must genuinely perform multiple model inferences')
console.log(JSON.stringify({passed:true,configurations:configs.length,comparisons,independentPlanChecks:planChecks,maxCalls:calls}))
