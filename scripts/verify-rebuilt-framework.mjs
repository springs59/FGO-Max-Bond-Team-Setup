import assert from 'node:assert/strict'
import {wideCases} from './performance-wide-cases.mjs'
import {makeSearchCase} from './ai-search-cases.mjs'
import {solveInventoryCurves} from '../src/solver/inventory-curve-solver.js'
import {recommendTeam} from '../src/recommend.js'
const cases=wideCases()
for(const [id,states,initial] of [['random-25',170538,6319],['random-31',882004,1922]]){
 const {opts}=cases.find(c=>c.id===id)
 const r=solveInventoryCurves({...opts,formsOf:s=>opts.forms[s.id],stateOf:s=>opts.states[s.id]||{},aiMode:'on',aiDiagnostics:true})
 assert.equal(r.certificate.ai.dpStatesVisited,states,id+' matches prior recorded state count')
 assert.equal(r.certificate.ai.initialLowerBound,initial,id+' matches prior recorded initial bound')
 console.log(JSON.stringify({id,score:r.score,cost:r.cost,states,initial,matchedPriorRecord:true}))
}
const c=cases.find(c=>c.id==='request-CN-240-false')
const r=recommendTeam({...c.opts,aiMode:'on',aiDiagnostics:true,skipResultCache:true})
assert.equal(r.total,7527);assert.equal(r.costUsed,95)
assert.equal(r.resultStatus.ai.dpStatesVisited,189117)
assert.equal(r.resultStatus.ai.initialLowerBound,7527)
console.log(JSON.stringify({id:c.id,score:r.total,cost:r.costUsed,states:r.resultStatus.ai.dpStatesVisited,matchedPriorRecord:true}))
const objectives=r=>r?[r.score,r.cost]:null
const alternatives=r=>r?Object.fromEntries(r.plans.map(p=>{const s=p.slots.find(s=>s.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]})):null
for(let i=0;i<48;i++){
 const {opts,id}=makeSearchCase(9918000+i,{real:i%3===0,larger:i>=36})
 opts.allSupportAlternatives=i%2===0
 const off=solveInventoryCurves({...opts,aiMode:'on',aiFramework:'off'}),on=solveInventoryCurves({...opts,aiMode:'on',aiFramework:'on'})
 assert.deepEqual(objectives(on),objectives(off),id)
 if(opts.allSupportAlternatives)assert.deepEqual(alternatives(on),alternatives(off),id+' support/position coverage')
 if(on){assert.ok(on.certificate.ai.initialLowerBound>=off.certificate.ai.initialLowerBound)
  if(on.certificate.ai.initialLowerBound===off.certificate.ai.initialLowerBound)
   assert.ok(on.certificate.ai.initialLowerBoundCost<=off.certificate.ai.initialLowerBoundCost)}
}
console.log('48 forced-path comparisons passed; reconstruction matches three earlier diagnostic records, but is not the original commit/hash.')
