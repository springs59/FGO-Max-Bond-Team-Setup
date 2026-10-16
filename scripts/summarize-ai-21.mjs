import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {randomSource} from './ai-search-cases.mjs'
const read=p=>JSON.parse(readFileSync(p))
const quantile=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]:null
const median=xs=>quantile(xs,.5),sum=xs=>xs.reduce((a,b)=>a+b,0)
function summarizeRaw(report) {
  const result={status:report.status,startedAt:report.startedAt,endedAt:report.endedAt,
    versions:report.versions,timeoutMs:report.timeoutMs,environment:report.environment,catalogCounts:report.catalogCounts,groups:{}}
  const groups={all:report.records,core:report.records.filter(r=>r.id.startsWith('core-')),worker:report.records.filter(r=>r.id.startsWith('worker-'))}
  for(const cohort of new Set(report.records.map(r=>r.cohort)))groups['core/'+cohort]=groups.core.filter(r=>r.cohort===cohort)
  for(const [group,rows]of Object.entries(groups)) {
    if(!rows.length)continue
    const complete=rows.filter(r=>r.runs.every(x=>x.status==='ok')),
      consistent=complete.filter(r=>new Set(r.runs.map(x=>JSON.stringify(x.facts))).size===1),
      feasible=consistent.filter(r=>r.runs[0].facts!==null)
    const time=(row,version)=>median(row.runs.filter(x=>x.version===version).map(x=>row.id.startsWith('core-')?x.ms:x.wallMs))
    const versions=Object.keys(report.versions),statistics={}
    for(const version of versions) {
      const all=rows.flatMap(r=>r.runs.filter(x=>x.version===version)),ok=all.filter(x=>x.status==='ok'),
        paired=consistent.map(r=>time(r,version)),valid=feasible.map(r=>time(r,version))
      statistics[version]={attempts:all.length,completed:ok.length,timeouts:all.filter(x=>x.status==='timeout').length,
        errors:all.filter(x=>!['ok','timeout'].includes(x.status)).length,
        pairedMedianMs:median(paired),pairedP95Ms:quantile(paired,.95),pairedSumOfMediansMs:sum(paired),
        feasibleMedianMs:median(valid),feasibleP95Ms:quantile(valid,.95),feasibleSumOfMediansMs:sum(valid),
        maxObservedWorkerHeapMiB:ok.length?Math.max(...ok.map(x=>x.heapUsed||0))/1048576:null,
        // Censored totals are lower bounds at the test's time budget, not a
        // substitute for the unknown completion time of timed-out searches.
        budgetChargedMs:sum(all.map(x=>x.status==='timeout'?report.timeoutMs:x.ms??x.wallMs??0))}
    }
    const comparisons={}
    if(versions.includes('2.1'))for(const baseline of versions.filter(x=>x!=='2.1')) {
      const pairs=feasible.map(r=>[time(r,baseline),time(r,'2.1')]),rand=randomSource(9911),boot=[]
      if(pairs.length)for(let b=0;b<2000;b++) {
        let old=0,newer=0
        for(let i=0;i<pairs.length;i++){const p=pairs[Math.floor(rand()*pairs.length)];old+=p[0];newer+=p[1]}
        if(old)boot.push(newer/old)
      }
      comparisons[baseline]={feasiblePairs:pairs.length,newTimeOverBaseline:sum(pairs.map(p=>p[1]))/sum(pairs.map(p=>p[0]))||null,
        bootstrap95:[quantile(boot,.025),quantile(boot,.975)],
        fasterByMoreThan5Percent:pairs.filter(p=>p[1]<p[0]*.95).length,
        slowerByMoreThan5Percent:pairs.filter(p=>p[1]>p[0]*1.05).length}
    }
    result.groups[group]={queries:rows.length,fullyCompleted:complete.length,matching:consistent.length,
      feasible:feasible.length,infeasible:consistent.length-feasible.length,incomplete:rows.length-complete.length,
      actualMismatches:complete.filter(r=>!consistent.includes(r)).map(r=>({id:r.id,runs:r.runs.map(x=>({version:x.version,facts:x.facts}))})),statistics,comparisons}
  }
  const aiRuns=report.records.filter(r=>r.id.startsWith('core-')).flatMap(r=>r.runs).filter(x=>x.version==='2.1'&&x.certificate?.ai?.enabled)
  const seeded=aiRuns.filter(r=>r.certificate.ai.seedFeasible>0)
  result.ai={enabledRuns:aiRuns.length,seedFeasibleRuns:seeded.length,
    seedAlreadyOptimalRuns:seeded.filter(r=>r.certificate.ai.seedBestScore===r.facts?.[0]).length,
    medianSeedMs:median(aiRuns.map(r=>r.certificate.ai.seedMs)),p95SeedMs:quantile(aiRuns.map(r=>r.certificate.ai.seedMs),.95),
    medianInferenceMs:median(aiRuns.map(r=>r.certificate.ai.inferenceMs))}
  return result
}
const output={large:summarizeRaw(read('docs/test-results/ai-21-large.json'))}
if(existsSync('docs/test-results/ai-21-ablation.json'))output.ablation=summarizeRaw(read('docs/test-results/ai-21-ablation.json'))
if(existsSync('docs/test-results/ai-21-browser.json')) {
  const raw=read('docs/test-results/ai-21-browser.json'),groups={}
  for(const kind of ['cold','retained','restart','changed']) {
    const paired=[]
    for(let i=0;i<raw.count;i++) {
      const records=raw.records.filter(r=>r.i===i),versions=['2.0.0','2.0.9','2.1'],rows={}
      for(const version of versions){const xs=records.filter(r=>r.version===version).map(r=>r.measurements?.find(x=>x.kind===kind));rows[version]=xs}
      const all=Object.values(rows).flat(),complete=all.length===raw.rounds*3&&all.every(r=>r?.status==='ok')
      paired.push({i,complete,match:complete&&new Set(all.map(r=>JSON.stringify(r.facts))).size===1,
        times:Object.fromEntries(versions.map(v=>[v,rows[v].filter(x=>x?.status==='ok').map(x=>x.ms)])),rows})
    }
    const good=paired.filter(r=>r.match)
    groups[kind]={queries:paired.length,matching:good.length,incomplete:paired.filter(r=>!r.complete).length,
      mismatches:paired.filter(r=>r.complete&&!r.match),versions:Object.fromEntries(['2.0.0','2.0.9','2.1'].map(version=>{
        const values=good.map(r=>median(r.times[version])),all=paired.flatMap(r=>r.rows[version]).filter(Boolean)
        return [version,{attempts:all.length,completed:all.filter(r=>r.status==='ok').length,timeouts:all.filter(r=>r.status==='timeout').length,
          errors:all.filter(r=>!['ok','timeout'].includes(r.status)).length,cacheHits:all.filter(r=>r.cacheHit).length,
          pairedSumOfMediansMs:sum(values),medianMs:median(values),p95Ms:quantile(values,.95)}]
      }))}
  }
  output.browser={status:raw.status,browser:raw.browser,count:raw.count,rounds:raw.rounds,
    topLevelErrors:raw.records.filter(r=>r.status==='error'),groups}
}
writeFileSync('docs/test-results/ai-21-summary.json',JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify({large:output.large.groups.core,worker:output.large.groups.worker,ai:output.large.ai,browser:output.browser?.groups},null,2))
