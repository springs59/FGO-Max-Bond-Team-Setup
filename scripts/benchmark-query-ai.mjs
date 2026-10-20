import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'
import { makeSearchCase } from './ai-search-cases.mjs'

const baselineRoot=process.argv[2]
if(!baselineRoot)throw Error('Pass a clean baseline worktree path')
const {solveInventoryCurves:baseline}=await import(pathToFileURL(baselineRoot+'/src/solver/inventory-curve-solver.js'))
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]
const records=[]
for(let i=0;i<16;i++){
  const {opts,id}=makeSearchCase(28000000+i,{real:i%3===0,larger:i>=12})
  opts.allSupportAlternatives=i%4===0
  const times={previousAi:[],singleAi:[],off:[]},calls={},stats={}
  let truth
  for(let trial=0;trial<3;trial++){
    const modes=['previousAi','singleAi','off'];modes.push(...modes.splice(0,trial))
    for(const mode of modes){
      const began=performance.now()
      const result=mode==='previousAi'?baseline({...opts,aiMode:'on'}):solveInventoryCurves({...opts,aiMode:mode==='off'?'off':'on'})
      times[mode].push(performance.now()-began)
      const objective=result?[result.score,result.cost]:null
      if(truth===undefined)truth=objective;else assert.deepEqual(objective,truth,id+' '+mode)
      const ai=result?.certificate.ai
      calls[mode]=ai?.inferenceCalls??ai?.ranked??0
      if(mode==='singleAi'&&result)assert.equal(ai.inferenceCalls,1)
      stats[mode]={nodes:result?.certificate.nodes||0,evaluated:result?.certificate.evaluated||0,inferenceMs:ai?.inferenceMs||0}
    }
  }
  records.push({id,base:opts.base,costLimit:opts.costLimit,allSupportAlternatives:opts.allSupportAlternatives,
    objective:truth,timesMs:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,median(v)])),calls,stats})
}
const summary=Object.fromEntries(['previousAi','singleAi','off'].map(mode=>[mode,{
  sumOfCaseMediansMs:records.reduce((n,r)=>n+r.timesMs[mode],0),
  medianCaseMs:median(records.map(r=>r.timesMs[mode])),
  feasibleQueryInferenceCalls:records.filter(r=>r.objective).map(r=>r.calls[mode]),
}]))
const report={model:SEARCH_MODEL.version,queries:records.length,trialsPerQuery:3,passed:true,summary,records,
  caveat:'Small local sample; timings are noisy and are not a universal speed guarantee. Previous calls use the old per-candidate inference counter.'}
writeFileSync('docs/test-results/ai-query-once-performance.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({queries:records.length,passed:true,summary}))
