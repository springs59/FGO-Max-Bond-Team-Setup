import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { makeGeneralCase, materializeGeneral, semanticFingerprint, GENERAL_SPLITS } from './general-ai-cases.mjs'
import { solveGeneral,resultFacts } from './general-ai-solver.mjs'
import { createGeneralRuntime,validWorkModel } from './general-ai-runtime.mjs'
import { createTieView } from './general-ai-ties.mjs'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
const summary=JSON.parse(readFileSync('experiments/ai-general/reports/training.json')),model=JSON.parse(readFileSync(summary.selected))
assert.ok(validWorkModel(model))
const bad=structuredClone(model);bad.w1[0].pop();assert.equal(validWorkModel(bad),false)
for(const [a,sa]of Object.entries(GENERAL_SPLITS))for(const [b,sb]of Object.entries(GENERAL_SPLITS))if(a!==b){const keys=new Set(sa.families.map(x=>x.slice().sort().join('+')));assert.ok(sb.families.every(x=>!keys.has(x.slice().sort().join('+'))))}
const opts=materializeGeneral(makeGeneralCase('train',19).opts),permuted=structuredClone(makeGeneralCase('train',19).opts)
permuted.servants.reverse();permuted.supportCes.reverse();permuted.ownCes.reverse();Object.values(permuted.forms).forEach(a=>a.reverse())
assert.equal(semanticFingerprint(permuted),semanticFingerprint(makeGeneralCase('train',19).opts),'semantic hash must ignore member/effect ordering')
const forced={enabled:true,modelVersion:model.version,minRawStock:0,minGroups:0,logGain:0,minLogWork:0},runtime=createGeneralRuntime(model,forced),off=createGeneralRuntime(model,{...forced,enabled:false})
const originals={writeFileSync:fs.writeFileSync,appendFileSync:fs.appendFileSync,createWriteStream:fs.createWriteStream}
let writes=0
for(const key of Object.keys(originals))fs[key]=()=>{writes++;throw Error('A query attempted disk output')}
syncBuiltinESMExports()
try{
 for(let i=0;i<36;i++){
  const c=makeGeneralCase('validation',i),o=materializeGeneral(c.opts),truth=resultFacts(solveInventoryCurves({...o,aiMode:'off'}),o.allSupportAlternatives)
  for(let policy=0;policy<5;policy++)assert.deepEqual(resultFacts(solveGeneral(o,{policy}).result,o.allSupportAlternatives),truth)
  assert.deepEqual(resultFacts(runtime.solve(o).result,o.allSupportAlternatives),truth)
  assert.deepEqual(resultFacts(off.solve(o).result,o.allSupportAlternatives),truth)
 }
}finally{Object.assign(fs,originals);syncBuiltinESMExports()}
assert.equal(writes,0)
// Closed-form equal-score cases expose representatives that a cheapest-only DP
// drops. All higher-COST equal-score gear and all physical assignments remain.
const servants=Array.from({length:4},(_,i)=>({id:99000000+i,cost:1,traitIds:[]})),ce=(id,cost)=>({id,cost,accountMlb:true,skills:[{condLimitCount:4,funcs:[{target:'ptFull',rate:0,add:0,eventId:0,tvals:[],andTvals:[]}]}]})
const tie={servants,ownCes:[ce(88000001,1),ce(88000002,2)],supportCes:[],base:100,costLimit:10,stateOf:()=>({maxed:false,aura:0}),formsOf:s=>[{key:'default',cost:s.cost,traitIds:[]}],bonuses:{},layouts:[6],emptyPositions:[2,3,4,5],minimumOwn:1}
const best=solveInventoryCurves({...tie,aiMode:'off'}),view=createTieView(tie,best.score)
assert.equal(view.materialized,false)
const one=[...view];assert.equal(one.length,12);assert.deepEqual([...new Set(one.map(p=>p.cost))].sort(),[1,2,3])
const two=[...createTieView({...tie,emptyPositions:[3,4,5]},240)];assert.equal(two.length,84)
const pinned=[...createTieView({...tie,requiredIds:[servants[0].id],fixedPositions:{[servants[0].id]:1}},120)];assert.equal(pinned.length,3)
const stock=[...createTieView({...tie,ownCes:[ce(88000001,1),ce(88000001,1),ce(88000002,2)],emptyPositions:[3,4,5]},240)];assert.equal(stock.length,96)
console.log('General AI: disjoint compositions, permutation-invariant semantic fingerprints, 36 complete exact checks across all orders/routing, zero query disk writes, and equal-score cases 12/84/3/96 passed')
