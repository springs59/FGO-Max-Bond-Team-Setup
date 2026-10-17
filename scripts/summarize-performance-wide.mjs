import {readFileSync,writeFileSync} from 'node:fs'
const [input,output]=process.argv.slice(2)
if(!input||!output)throw Error('Usage: node scripts/summarize-performance-wide.mjs raw.json summary.json')
const raw=JSON.parse(readFileSync(input)),names=Object.keys(raw.versions||{'2.0.0':{},'2.1.2':{},'2.1-interval':{}})
const q=(a,p)=>a.length?a.toSorted((a,b)=>a-b)[Math.min(a.length-1,Math.floor(p*a.length))]:null
const med=a=>!a.length?null:a.length%2?q(a,.5):(q(a,.5)+q(a,.5-1/a.length))/2
const records=raw.records.map(r=>{
 const stats=Object.fromEntries(names.map(name=>{
  const runs=r.runs.filter(x=>x.name===name&&x.status==='ok'),ms=runs.map(x=>r.kind==='core'?x.ms:x.wallMs)
  return [name,{medianMs:med(ms),trialsMs:ms,minMs:ms.length?Math.min(...ms):null,maxMs:ms.length?Math.max(...ms):null,
   facts:runs[0]?.facts??null,error:runs[0]?.error||null,valid:r.kind==='core'?Boolean(runs[0]?.facts):runs[0]?.valid,
   ai:runs[0]?.certificate?.ai||runs[0]?.ai||null,
   seedMedianMs:med(runs.map(x=>x.certificate?.ai?.seedMs??x.ai?.seedMs??0)),
   inferenceMedianMs:med(runs.map(x=>x.certificate?.ai?.inferenceMs??x.ai?.inferenceMs??0)),
   nodes:runs[0]?.certificate?.nodes,evaluations:runs[0]?.certificate?.evaluated,cacheHits:runs.filter(x=>x.cacheHit).length,
   maxObservedHeapMiB:Math.max(0,...runs.map(x=>x.heapUsed||0))/1048576,
   retainedStrata:Object.keys(runs[0]?.alternatives||{}).length}]
 }))
 return {id:r.id,kind:r.kind,cohort:r.cohort,region:r.region,sha256:r.sha256,domain:r.domain,complete:r.complete,
  objectivesMatch:r.objectivesMatch,alternativesMatch:r.alternativesMatch,
  requestedAlternativesMatch:r.kind==='core'&&r.domain.allSupportAlternatives?r.alternativesMatch:null,stats,
  ratio212:stats['2.1.2'].medianMs/stats['2.0.0'].medianMs,
  ratioInterval:stats['2.1-interval'].medianMs/stats['2.0.0'].medianMs,
  ratioWorkspace:stats['2.1-workspace']?stats['2.1-workspace'].medianMs/stats['2.0.0'].medianMs:null}
})
function group(rows){
 const complete=rows.filter(r=>r.complete),same=complete.filter(r=>r.objectivesMatch)
 const aggregate=rs=>Object.fromEntries(names.map(name=>{
  const ms=rs.map(r=>r.stats[name].medianMs)
  return [name,{sumOfQueryMediansMs:ms.reduce((a,b)=>a+b,0),medianQueryMs:med(ms),p95QueryMs:q(ms,.95),
   maxQueryMs:ms.length?Math.max(...ms):null,maxObservedHeapMiB:Math.max(0,...rs.map(r=>r.stats[name].maxObservedHeapMiB)),
   cacheHits:rs.reduce((s,r)=>s+r.stats[name].cacheHits,0)}]
 }))
 const comparisons=Object.fromEntries(names.slice(1).map(name=>{
  const base=same.reduce((s,r)=>s+r.stats['2.0.0'].medianMs,0),next=same.reduce((s,r)=>s+r.stats[name].medianMs,0)
  const ratios=same.map(r=>r.stats[name].medianMs/r.stats['2.0.0'].medianMs)
  return [name,{pairedSumRatio:next/base,pairedRatioMedian:med(ratios),faster:same.filter(r=>r.stats[name].medianMs<r.stats['2.0.0'].medianMs).length,
   slower:same.filter(r=>r.stats[name].medianMs>r.stats['2.0.0'].medianMs).length,pairedConditions:same.length}]
 }))
 return {conditions:rows.length,complete:complete.length,matching:same.length,valid:same.filter(r=>r.stats['2.0.0'].valid).length,
  requestedAlternativesDifferences:rows.filter(r=>r.requestedAlternativesMatch===false).map(r=>r.id),allCompleted:aggregate(complete),matchingOnly:aggregate(same),comparisons}
}
const groups={}
for(const kind of ['core','worker']){
 const rows=records.filter(r=>r.kind===kind)
 groups[kind]=group(rows)
 for(const cohort of new Set(rows.map(r=>r.cohort)))groups[kind+':'+cohort]=group(rows.filter(r=>r.cohort===cohort))
 groups[kind+':unlimited-cost']=group(rows.filter(r=>r.domain.costLimit==null))
 for(const [label,min,max]of [['under-1ms',0,1],['1-10ms',1,10],['10-100ms',10,100],['100-1000ms',100,1000],['over-1s',1000,Infinity]])
  groups[kind+':baseline-'+label]=group(rows.filter(r=>r.stats['2.0.0'].medianMs>=min&&r.stats['2.0.0'].medianMs<max))
}
const summary={schema:1,status:raw.status,startedAt:raw.startedAt,endedAt:raw.endedAt,rounds:raw.rounds,warmups:raw.warmups,
 queryTimeout:raw.queryTimeout,method:raw.method,versions:raw.versions,environment:raw.environment,
 limitations:'Finite predefined domains, not exhaustive enumeration of every possible condition. Core and production-request timing must not be pooled. Node Worker heap samples are post-query observations, not peak RAM. Browser persistence is measured separately. All errors, mismatches and pending cases remain visible; primary-only auxiliary candidate maps need not be exact per-support optima. AI requested on can be inactive on non-vector paths. No precompute expansion.',
 groups,mismatches:records.filter(r=>!r.objectivesMatch),auxiliaryDifferences:records.filter(r=>r.alternativesMatch===false).map(r=>({id:r.id,allSupportAlternatives:r.domain.allSupportAlternatives})),
 slowExamples:records.filter(r=>r.stats['2.0.0'].medianMs>=1).toSorted((a,b)=>(b.stats['2.1-interval'].medianMs-b.stats['2.0.0'].medianMs)-(a.stats['2.1-interval'].medianMs-a.stats['2.0.0'].medianMs)).slice(0,15).map(r=>r.id),records}
writeFileSync(output,JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify({status:summary.status,groups:{core:groups.core,worker:groups.worker},mismatches:summary.mismatches.map(r=>r.id)},null,2))
