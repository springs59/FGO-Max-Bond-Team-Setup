import assert from 'node:assert/strict'
import {makeSearchCase} from '../../scripts/ai-search-cases.mjs'
import {solveInventoryCurves} from './inventory-curve-solver.js'

const objective=r=>r?[r.score,r.cost]:null
const alternatives=r=>r?Object.fromEntries(r.plans.map(p=>{
  const support=p.slots.find(s=>s.s)
  return [(support?.ce||0)+':'+(support?.p||0),[p.score,p.cost]]
})):null
let feasible=0,witnesses=0,filtered=0
// Generated rule combinations and current public catalog rows are compared to
// the unchanged exact kernel, without fixed catalog-dependent expected scores.
for(let i=0;i<48;i++){
  const {opts,id}=makeSearchCase(9918000+i,{real:i%3===0,larger:i>=36})
  opts.allSupportAlternatives=i%2===0
  const original=solveInventoryCurves({...opts,aiMode:'on',aiFramework:'off'})
  const framework=solveInventoryCurves({...opts,aiMode:'on',aiFramework:'on'})
  assert.deepEqual(objective(framework),objective(original),id+' score and minimum COST')
  if(opts.allSupportAlternatives)
    assert.deepEqual(alternatives(framework),alternatives(original),id+' support/position coverage')
  if(!framework)continue
  feasible++
  const a=framework.certificate.ai,b=original.certificate.ai
  assert.ok(a.initialLowerBound>=b.initialLowerBound,id+' verified initial bound')
  if(a.initialLowerBound===b.initialLowerBound)
    assert.ok(a.initialLowerBoundCost<=b.initialLowerBoundCost,id+' initial bound COST')
  witnesses+=a.frameworkWitnesses;filtered+=a.prefilterRejected
}
assert.ok(feasible>0);assert.ok(witnesses>0);assert.ok(filtered>0)
console.log(JSON.stringify({frameworkDomains:48,feasible,witnesses,filtered,passed:true}))
