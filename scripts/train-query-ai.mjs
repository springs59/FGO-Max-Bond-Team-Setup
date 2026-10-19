import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { QUERY_FEATURES, QUERY_PROFILES, queryFeatures, fixedQueryPriority, inferQueryPolicy } from '../src/solver/query-ai.js'
import { makeSearchCase, trainingDataVersion } from './ai-search-cases.mjs'

// Train one bounded CART decision per query, NOT a per-candidate classifier.
// Labels minimize ranking/count error to exact legal optima. These surrogate
// labels do not constitute a speed claim or a safe score bound.
const trainCount=Number(process.env.FGO_QUERY_TRAIN_CASES||1024)
const testCount=Number(process.env.FGO_QUERY_TEST_CASES||160)
const splits={train:[],validation:[],sealed:[]}
for(const split of Object.keys(splits)){
  const count=split==='train'?trainCount:testCount
  for(let i=0;i<count;i++){
    const seed=({train:24000000,validation:25000000,sealed:26000000})[split]+i
    // Disjoint seeds AND domain families: synthetic training, larger synthetic
    // validation, unseen public-catalog servants/equipment for the sealed set.
    const {opts}=makeSearchCase(seed,{larger:split==='validation',real:split==='sealed'})
    let domain
    const result=solveInventoryCurves({...opts,aiMode:'off',onAiDomain:d=>{domain=d}})
    if(!result||!domain)continue
    const own=result.slots.filter(s=>s.f&&!s.s),counts=new Map()
    for(const s of own.filter(s=>s.ce)){const k=s.ce+':'+(s.mlb!==false);counts.set(k,(counts.get(k)||0)+1)}
    const rows=[]
    for(const g of domain.equipment){
      const keys=new Set(g.ids.map((id,j)=>id+':'+g.mlb[j]))
      const used=[...keys].reduce((n,k)=>n+(counts.get(k)||0),0)
      rows.push({kind:'equipment',x:g.features,y:used/Math.min(6*g.features[14],g.ids.length)})
    }
    const chosen=new Set(domain.servants.filter(r=>own.some(s=>s.svt===r.id&&(s.art||'default')===(r.form||'default'))).map(r=>JSON.stringify(r.features)))
    for(const r of domain.servants)rows.push({kind:'servant',x:r.features,y:Number(chosen.has(JSON.stringify(r.features)))})
    const loss=QUERY_PROFILES.map(p=>rows.reduce((n,r)=>n+(fixedQueryPriority(p,r.kind,r.x)-r.y)**2,0)/Math.max(1,rows.length))
    splits[split].push({x:queryFeatures(domain.equipment.map(g=>g.features),domain.servants.map(r=>r.features)),loss})
    if(i%128===0)console.log(`${split}: ${i}/${count}`)
  }
}
function leaf(rows){
  const sums=QUERY_PROFILES.map((_,p)=>rows.reduce((n,r)=>n+r.loss[p],0))
  const loss=Math.min(...sums)
  return {tree:{profile:sums.indexOf(loss)},loss}
}
function train(rows,depth=0){
  const parent=leaf(rows)
  if(depth>=4||rows.length<24)return parent.tree
  let best=null,bestLoss=parent.loss
  for(let f=0;f<QUERY_FEATURES.length;f++){
    const values=[...new Set(rows.map(r=>r.x[f]))].sort((a,b)=>a-b)
    for(let j=1;j<16;j++){
      const at=Math.floor(values.length*j/16)
      if(at<=0||at>=values.length)continue
      const threshold=(values[at-1]+values[at])/2
      const left=rows.filter(r=>r.x[f]<=threshold),right=rows.filter(r=>r.x[f]>threshold)
      if(left.length<8||right.length<8)continue
      const loss=leaf(left).loss+leaf(right).loss
      if(loss<bestLoss-1e-9){bestLoss=loss;best={feature:f,threshold,left,right}}
    }
  }
  return best?{feature:best.feature,threshold:best.threshold,left:train(best.left,depth+1),right:train(best.right,depth+1)}:parent.tree
}
if(splits.train.length<100)throw Error('Not enough feasible training queries')
const tree=train(splits.train)
const sha=createHash('sha256').update(JSON.stringify({tree,splits,trainingDataVersion})).digest('hex')
const policy={format:1,version:'query-once-'+sha.slice(0,12),features:QUERY_FEATURES,tree,
  training:{teacher:'exact-inventory-score-cost-optimum',sourceDataSha256:trainingDataVersion,
    feasibleQueries:Object.fromEntries(Object.entries(splits).map(([k,v])=>[k,v.length])),
    families:{train:'synthetic-small',validation:'synthetic-larger',sealed:'public-catalog'},
    seedStarts:{train:24000000,validation:25000000,sealed:26000000},sha256:sha}}
const metrics=Object.fromEntries(Object.entries(splits).map(([split,rows])=>{
  let loss=0,oracle=0;const profiles={}
  for(const r of rows){const name=inferQueryPolicy(policy,r.x).name,p=QUERY_PROFILES.findIndex(x=>x.name===name)
    loss+=r.loss[p];oracle+=Math.min(...r.loss);profiles[name]=(profiles[name]||0)+1}
  return [split,{queries:rows.length,meanSurrogateLoss:loss/rows.length,oracleLoss:oracle/rows.length,profiles}]
}))
writeFileSync('src/solver/query-ai-model.js','// Trained by scripts/train-query-ai.mjs; one decision per query.\nexport const QUERY_POLICY = '+JSON.stringify(policy)+'\n')
writeFileSync('docs/test-results/ai-query-once-training.json',JSON.stringify({version:policy.version,training:policy.training,metrics,
  caveat:'Query-level teacher-fit metrics only. Exactness and runtime performance require separate solver checks.'},null,2)+'\n')
console.log(JSON.stringify({version:policy.version,metrics}))
