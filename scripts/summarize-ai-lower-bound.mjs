import {readFileSync,writeFileSync} from 'node:fs'
const [input,output]=process.argv.slice(2)
if(!input||!output)throw Error('Usage: node scripts/summarize-ai-lower-bound.mjs input.json summary.json')
const raw=JSON.parse(readFileSync(input,'utf8'))
if(!raw.passed)throw Error('Cannot summarize an incomplete or failed comparison')
const rows=raw.records.map(r=>{
  const a=r.runs.find(x=>x.name==='before'),b=r.runs.find(x=>x.name==='after')
  return {id:r.id,identities:r.identities,costLimit:r.costLimit,beforeMs:r.beforeMs,afterMs:r.afterMs,ratio:r.ratio,
    beforeTrialsMs:r.runs.filter(x=>x.name==='before').map(x=>x.ms),afterTrialsMs:r.runs.filter(x=>x.name==='after').map(x=>x.ms),
    exact:a.facts,lowerBefore:a.certificate?.ai.seedBestScore??null,lowerAfter:b.certificate?.ai.seedBestScore??null,
    nodesBefore:a.certificate?.nodes??null,nodesAfter:b.certificate?.nodes??null,
    evaluationsBefore:a.certificate?.evaluated??null,evaluationsAfter:b.certificate?.evaluated??null,
    seedReused:b.certificate?.ai.seedReused??0,budgetPruned:b.certificate?.ai.budgetPruned??0,
    dpStatePruned:b.certificate?.ai.dpStatePruned??0,initialUpperBound:b.certificate?.ai.initialUpperBound??null,
    retainedStrata:Object.keys(b.alternatives||{}).length}
})
let seed=20261017
const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
const ratios=[]
for(let b=0;b<10000;b++){
  let old=0,next=0
  for(let i=0;i<rows.length;i++){const r=rows[Math.floor(rand()*rows.length)];old+=r.beforeMs;next+=r.afterMs}
  ratios.push(next/old)
}
ratios.sort((a,b)=>a-b)
const feasible=rows.filter(r=>r.exact),summary={
  passed:true,baselineCommit:raw.baselineCommit??'13d8fa7ed273c0f86c2babd9b2b6bc9c78767519',count:raw.count,rounds:raw.rounds,offset:raw.offset,
  method:'Alternated source versions in separate persistent Node Workers; one declared excluded warmup; cold core queries with AI on, no result cache; timed solver only. Same score/COST and retained support/position objectives checked on every recorded trial. Bootstrap resamples paired query medians, not individual rounds.',
  performance:{...raw.summary,ratio95CI:[ratios[250],ratios[9750]]},
  bounds:{feasible:feasible.length,improved:feasible.filter(r=>r.lowerAfter>(r.lowerBefore??-Infinity)).length,
    equal:feasible.filter(r=>r.lowerAfter===r.lowerBefore).length,worse:feasible.filter(r=>(r.lowerAfter??-Infinity)<(r.lowerBefore??-Infinity)).length,
    seedOptimumBefore:feasible.filter(r=>r.lowerBefore===r.exact[0]).length,seedOptimumAfter:feasible.filter(r=>r.lowerAfter===r.exact[0]).length,
    seedReuses:rows.reduce((s,r)=>s+r.seedReused,0),resourcePrunes:rows.reduce((s,r)=>s+r.budgetPruned,0),
    dpStatesPruned:rows.reduce((s,r)=>s+r.dpStatePruned,0)},
  limitations:'Finite seeded synthetic/public-catalog conditions on one environment. Solver-only timing excludes UI, loading, cloning and IndexedDB. Not an Android timing result, a universal speed guarantee, or full enumeration of equal-score identities. No training or precompute expansion.',
  records:rows}
writeFileSync(output,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({performance:summary.performance,bounds:summary.bounds},null,2))
