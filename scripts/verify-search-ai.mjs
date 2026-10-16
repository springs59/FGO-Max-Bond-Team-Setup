import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'
import { makeSearchCase } from './ai-search-cases.mjs'

const root=process.env.FGO_AI_BASELINE
if(!root)throw Error('Set FGO_AI_BASELINE to a clean native-v2.0.0 worktree for an independent baseline')
const {solveInventoryCurves:original}=await import(pathToFileURL(root+'/src/solver/inventory-curve-solver.js'))
const cases=Array.from({length:48},(_,i)=>makeSearchCase(2200000+i,{real:i%3===0,larger:i>=40}))
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]
const totals={original:[],off:[],on:[],auto:[]},records=[]
for(let i=0;i<cases.length;i++){
  const {opts,id}=cases[i],trials={original:[],off:[],on:[],auto:[]},nodes={}
  for(let run=0;run<3;run++){
    const modes=['original','off','on','auto'];modes.push(...modes.splice(0,run%4))
    let truth
    for(const mode of modes){
      const start=performance.now(),result=mode==='original'?original(opts):solveInventoryCurves({...opts,aiMode:mode})
      trials[mode].push(performance.now()-start)
      const facts=result?[result.score,result.cost]:null
      if(truth===undefined)truth=facts;else assert.deepEqual(facts,truth,id+' '+mode)
      nodes[mode]={nodes:result?.certificate.nodes||0,evaluated:result?.certificate.evaluated||0,
        pruned:result?.certificate.pruned||0,ai:result?.certificate.ai}
    }
  }
  const times=Object.fromEntries(Object.entries(trials).map(([k,v])=>[k,median(v)]))
  for(const mode of Object.keys(totals))totals[mode].push(times[mode])
  records.push({id,real:cases[i].real,larger:i>=40,base:opts.base,costLimit:opts.costLimit,
    identities:opts.servants.length,ceCopies:opts.ownCes.length,times,nodes})
  if(i%5===0)console.log(`independent baseline parity and timing: ${i}/${cases.length}`)
}
const summarize=(rows,mode)=>{const ms=rows.map(r=>r.times[mode]);return {sumMs:ms.reduce((a,b)=>a+b,0),medianMs:median(ms),p95Ms:percentile(ms,.95)}}
const report={model:SEARCH_MODEL.version,baseline:'6320a8ffd31c444fbc76a64e14e576f759e1de1c',
  passed:true,queries:records.length,trialsPerQuery:3,allPrimaryAndCostTiesMatch:true,
  summaries:Object.fromEntries(['all','catalog','synthetic','larger'].map(kind=>{
    const rows=records.filter(r=>kind==='all'||kind==='catalog'&&r.real||kind==='synthetic'&&!r.real||kind==='larger'&&r.larger)
    return [kind,Object.fromEntries(Object.keys(totals).map(mode=>[mode,summarize(rows,mode)]))]
  })),records}
mkdirSync('docs/test-results',{recursive:true})
writeFileSync('docs/test-results/ai-200-performance.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({queries:report.queries,summaries:report.summaries},null,2))
